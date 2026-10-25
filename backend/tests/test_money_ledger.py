"""Accounting fixture plus transaction/concurrency tests on actual migrations.

AEGIS_LEDGER_TEST_DATABASE_URL is restricted to a disposable local database.
Without it the same domain cases exercise SQLite compatibility only.
"""

import os
import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import quote

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

from app.models.finance_ledger import (
    JournalEntry,
    Posting,
    LedgerDraft,
    LedgerNotification,
    LedgerIdempotency,
    LedgerAccount,
)
from app.models.user import User
from app.services import money_ledger as ledger


@pytest.fixture(scope="module")
def sessions(tmp_path_factory):
    root = Path(__file__).resolve().parents[1]
    url = os.environ.get("AEGIS_LEDGER_TEST_DATABASE_URL")
    admin, schema = None, None
    if url:
        parsed = make_url(url)
        assert (
            parsed.get_backend_name() == "postgresql"
            and parsed.database == "aegis_ledger_test"
            and parsed.host in {"127.0.0.1", "localhost"}
        ), "Use only the dedicated disposable local ledger test database"
        admin = create_engine(url)
        schema = "ledger_test_" + uuid.uuid4().hex
        with admin.begin() as conn:
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        url += (
            ("&" if "?" in url else "?") + "options=" + quote("-csearch_path=" + schema)
        )
    else:
        url = "sqlite:///" + str(tmp_path_factory.mktemp("ledger") / "ledger.db")
    env = {**os.environ, "DATABASE_URL": url, "DEBUG": "true"}
    output = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
    )
    assert output.returncode == 0, output.stderr[-6000:]
    engine = create_engine(url)
    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def fk(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")

    try:
        yield sessionmaker(bind=engine, expire_on_commit=False)
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as conn:
                conn.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            admin.dispose()


@pytest.fixture
def setup(sessions):
    with sessions() as db:
        user = User(
            id=str(uuid.uuid4()),
            email=uuid.uuid4().hex + "@example.com",
            username=uuid.uuid4().hex,
        )
        db.add(user)
        db.commit()
        accounts = {}
        for name, subtype in [
            ("bank", "bank"),
            ("savings", "savings"),
            ("cash", "cash"),
            ("card", "card"),
        ]:
            accounts[name] = ledger.create_account(
                db, user.id, {"name": name, "subtype": subtype}, name
            )["id"]
        ledger.create_openings(
            db,
            user.id,
            {
                "reviewed": True,
                "cutoff_at": "2026-10-18T12:00:00+07:00",
                "accounts": [
                    {"account_id": accounts[k], "signed_balance_minor": str(n)}
                    for k, n in {
                        "bank": 2000000,
                        "savings": 3000000,
                        "cash": 100000,
                        "card": 200000,
                    }.items()
                ],
            },
            "openings",
        )
        db.commit()
        return user.id, accounts


def draft_payload(kind, amount, **fields):
    return {
        "type": kind,
        "amount_minor": str(amount),
        "currency": "THB",
        "occurred_on": "2026-10-19",
        "date_precision": "day",
        "description": uuid.uuid4().hex,
        **fields,
    }


def post(db, owner, kind, amount, **fields):
    draft = ledger.create_draft(db, owner, draft_payload(kind, amount, **fields))
    assert draft["validation_errors"] == [], draft
    result = ledger.confirm_draft(
        db, owner, draft["id"], draft["version"], str(uuid.uuid4())
    )
    db.commit()
    return result


def numbers(db, owner, accounts):
    data = ledger.balances(db, owner)
    values = {a["id"]: int(a["balance_minor"]) for a in data["accounts"]}
    spending = sum(
        int(r["expense_effect_minor"]) for r in ledger.financial_transactions(db, owner)
    )
    return [values[accounts[k]] for k in ["bank", "savings", "cash", "card"]] + [
        int(data["net_position_minor"]),
        spending,
    ]


def test_sdd_accounting_fixture(sessions, setup):
    owner, accounts = setup
    with sessions() as db:
        assert numbers(db, owner, accounts) == [
            2000000,
            3000000,
            100000,
            200000,
            4900000,
            0,
        ]
        post(
            db,
            owner,
            "expense",
            15000,
            source_account_id=accounts["cash"],
            category="food",
        )
        assert numbers(db, owner, accounts) == [
            2000000,
            3000000,
            85000,
            200000,
            4885000,
            15000,
        ]
        post(
            db,
            owner,
            "transfer",
            100000,
            source_account_id=accounts["bank"],
            target_account_id=accounts["savings"],
        )
        assert numbers(db, owner, accounts) == [
            1900000,
            3100000,
            85000,
            200000,
            4885000,
            15000,
        ]
        expense = post(
            db, owner, "card_purchase", 50000, source_account_id=accounts["card"]
        )
        assert numbers(db, owner, accounts) == [
            1900000,
            3100000,
            85000,
            250000,
            4835000,
            65000,
        ]
        post(
            db,
            owner,
            "card_repayment",
            70000,
            source_account_id=accounts["bank"],
            target_account_id=accounts["card"],
        )
        assert numbers(db, owner, accounts) == [
            1830000,
            3100000,
            85000,
            180000,
            4835000,
            65000,
        ]
        post(
            db,
            owner,
            "refund",
            20000,
            target_account_id=accounts["card"],
            original_expense_entry_id=expense["journal_id"],
        )
        assert numbers(db, owner, accounts) == [
            1830000,
            3100000,
            85000,
            160000,
            4855000,
            45000,
        ]
        rows = db.execute(
            text(
                "SELECT journal_id, SUM(amount_minor), COUNT(*) FROM ledger_postings WHERE owner_id=:owner GROUP BY journal_id"
            ),
            {"owner": owner},
        ).all()
        assert all(total == 0 and count >= 2 for _, total, count in rows)


@pytest.mark.parametrize(
    "value", [0.1, True, "nan", "1.001", "1e100", "92233720368547758.08"]
)
def test_exact_parser_rejects_loss(value):
    with pytest.raises(ledger.MoneyError):
        ledger.decimal_to_minor(value)


def test_satang_income_fee_and_refund_correction(sessions, setup):
    owner, a = setup
    with sessions() as db:
        assert ledger.decimal_to_minor("150.25") == "15025"
        post(db, owner, "income", 50000, target_account_id=a["bank"])
        post(
            db,
            owner,
            "transfer",
            10000,
            source_account_id=a["bank"],
            target_account_id=a["cash"],
            fee_minor="25",
        )
        expense = post(db, owner, "expense", 10000, source_account_id=a["cash"])
        refund = post(
            db,
            owner,
            "refund",
            3000,
            target_account_id=a["cash"],
            original_expense_entry_id=expense["journal_id"],
        )
        result = ledger.correct_entry(
            db,
            owner,
            refund["journal_id"],
            {
                "correction_effective_on": "2026-10-20",
                "reason": "Reviewed actual refund",
                "replacement": draft_payload(
                    "refund",
                    6000,
                    target_account_id=a["cash"],
                    original_expense_entry_id=expense["journal_id"],
                ),
            },
            "correct",
        )
        db.commit()
        assert result["replacement_journal_id"]
        rows = ledger.financial_transactions(db, owner)
        assert sum(int(r["expense_effect_minor"]) for r in rows) == 4025
        assert [
            r["occurred_on"]
            for r in rows
            if r["journal_entry_id"]
            in {result["reversal_journal_id"], result["replacement_journal_id"]}
        ] == ["2026-10-20"] * 2
        with pytest.raises(ledger.MoneyError, match="Resolve the linked refund"):
            ledger.correct_entry(
                db,
                owner,
                expense["journal_id"],
                {"correction_effective_on": "2026-10-20", "reason": "Blocked"},
                "blocked",
            )
        db.rollback()


def test_draft_versions_and_idempotency(sessions, setup):
    owner, a = setup
    with sessions() as db:
        before = ledger.balances(db, owner)
        draft = ledger.create_draft(
            db, owner, draft_payload("expense", 15000, source_account_id=a["cash"])
        )
        assert ledger.balances(db, owner) == before
        changed = ledger.edit_draft(
            db, owner, draft["id"], 1, {"amount_minor": "15025"}
        )
        with pytest.raises(ledger.MoneyError) as exc:
            ledger.confirm_draft(db, owner, draft["id"], 1, "old")
        assert exc.value.code == "STALE_DRAFT"
        result = ledger.confirm_draft(db, owner, changed["id"], 2, "confirm")
        db.commit()
        replay = ledger.confirm_draft(db, owner, changed["id"], 2, "confirm")
        assert replay["journal_id"] == result["journal_id"]
        assert replay["replayed"]
        with pytest.raises(ledger.MoneyError) as exc:
            ledger.confirm_draft(db, owner, changed["id"], 1, "confirm")
        assert exc.value.code == "IDEMPOTENCY_CONFLICT"
        assert (
            db.query(JournalEntry).filter_by(source_draft_id=draft["id"]).count() == 1
        )


def test_cutoff_zero_opening_and_account_semantics(sessions, setup):
    owner, a = setup
    with sessions() as db:
        payload = draft_payload(
            "expense", 1, source_account_id=a["cash"], occurred_on="2026-10-18"
        )
        draft = ledger.create_draft(db, owner, payload)
        assert draft["validation_errors"][0]["code"] == "AMBIGUOUS_CUTOFF"
        with pytest.raises(ledger.MoneyError):
            ledger.confirm_draft(db, owner, draft["id"], 1, "ambiguous")
        draft = ledger.edit_draft(
            db, owner, draft["id"], 1, {"cutoff_resolution": "after"}
        )
        ledger.confirm_draft(db, owner, draft["id"], 2, "reviewed")
        db.commit()
        zero = ledger.create_account(
            db, owner, {"name": "Zero", "subtype": "cash"}, "zero"
        )
        ledger.create_openings(
            db,
            owner,
            {
                "reviewed": True,
                "cutoff_at": "2026-10-18T12:00:00+07:00",
                "accounts": [{"account_id": zero["id"], "signed_balance_minor": "0"}],
            },
            "zero-opening",
        )
        db.commit()
        with pytest.raises(ledger.MoneyError) as exc:
            ledger.create_openings(
                db,
                owner,
                {
                    "reviewed": True,
                    "cutoff_at": "2026-10-18T12:00:00+07:00",
                    "accounts": [
                        {"account_id": zero["id"], "signed_balance_minor": "10"}
                    ],
                },
                "second-opening",
            )
        assert exc.value.code == "OPENING_EXISTS"


def test_rollback_after_posting_leaves_no_partial_effect(sessions, setup, monkeypatch):
    owner, a = setup
    with sessions() as db:
        draft = ledger.create_draft(
            db, owner, draft_payload("expense", 100, source_account_id=a["cash"])
        )
        db.commit()
        before = ledger.balances(db, owner)
        original = ledger._save

        def fail(*args, **kwargs):
            if args[2] == "confirm_draft":
                raise RuntimeError("injected before outer commit")
            return original(*args, **kwargs)

        monkeypatch.setattr(ledger, "_save", fail)
        with pytest.raises(RuntimeError):
            ledger.confirm_draft(db, owner, draft["id"], 1, "failure")
        db.rollback()
        assert ledger.balances(db, owner) == before
        assert db.get(LedgerDraft, draft["id"]).status == "pending"
        assert (
            db.query(JournalEntry).filter_by(source_draft_id=draft["id"]).count() == 0
        )
        assert db.query(LedgerNotification).filter_by(draft_id=draft["id"]).count() == 0
        assert (
            db.query(LedgerIdempotency).filter_by(owner_id=owner, key="failure").count()
            == 0
        )


def test_postgresql_concurrent_confirmation_and_refund_cap(sessions, setup):
    owner, a = setup
    with sessions() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("Real PostgreSQL row locks required")
        draft = ledger.create_draft(
            db, owner, draft_payload("expense", 10000, source_account_id=a["cash"])
        )
        db.commit()

    def confirm(key):
        with sessions() as db:
            try:
                result = ledger.confirm_draft(db, owner, draft["id"], 1, key)
                db.commit()
                return result["journal_id"]
            except ledger.MoneyError as exc:
                db.rollback()
                return exc.code

    with ThreadPoolExecutor(2) as pool:
        ids = list(pool.map(confirm, ["a", "b"]))
    assert ids[0] == ids[1]
    with sessions() as db:
        drafts = [
            ledger.create_draft(
                db,
                owner,
                draft_payload(
                    "refund",
                    7000,
                    target_account_id=a["cash"],
                    original_expense_entry_id=ids[0],
                ),
            )
            for _ in range(2)
        ]
        db.commit()

    def refund(draft):
        with sessions() as db:
            try:
                result = ledger.confirm_draft(db, owner, draft["id"], 1, draft["id"])
                db.commit()
                return result["status"]
            except ledger.MoneyError as exc:
                db.rollback()
                return exc.code

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(refund, drafts))
    assert sorted(results) == ["OVER_REFUND", "posted"]


def test_database_guards(sessions, setup):
    owner, a = setup
    with sessions() as db:
        posted = post(db, owner, "expense", 100, source_account_id=a["cash"])
        with pytest.raises(DBAPIError):
            db.execute(
                text(
                    "UPDATE ledger_postings SET amount_minor=999 WHERE journal_id=:id"
                ),
                {"id": posted["journal_id"]},
            )
            db.commit()
        db.rollback()
        if db.get_bind().dialect.name != "postgresql":
            return
        with pytest.raises(DBAPIError):
            row = Posting(
                owner_id=owner,
                journal_id=posted["journal_id"],
                account_id=a["cash"],
                amount_minor=1,
            )
            db.add(row)
            db.commit()
        db.rollback()
        with pytest.raises(DBAPIError):
            db.add(
                JournalEntry(
                    owner_id=owner,
                    kind="expense",
                    occurred_on=date(2026, 10, 19),
                    precision="day",
                    description="unbalanced",
                )
            )
            db.commit()
        db.rollback()
        with pytest.raises(DBAPIError):
            account = db.get(LedgerAccount, a["cash"])
            account.kind = "liability"
            db.commit()
        db.rollback()


@pytest.mark.parametrize("value", ["0", "-1", str(2**63), "nan", 1.0, True])
def test_public_payments_reject_invalid_minor(value):
    with pytest.raises(ledger.MoneyError):
        ledger.minor(value, positive=True)


def test_probable_duplicate_ignores_description_and_allows_reviewed_distinct(
    sessions, setup
):
    owner, a = setup
    with sessions() as db:
        first = post(
            db,
            owner,
            "expense",
            1234,
            source_account_id=a["cash"],
            description="Typed coffee",
        )
        candidate = ledger.create_draft(
            db,
            owner,
            draft_payload(
                "expense",
                1234,
                source_account_id=a["cash"],
                description="Different OCR merchant",
            ),
        )
        assert candidate["validation_errors"][0]["code"] == "POSSIBLE_DUPLICATE"
        changed = ledger.edit_draft(
            db, owner, candidate["id"], 1, {"duplicate_resolution": "distinct"}
        )
        result = ledger.confirm_draft(db, owner, changed["id"], 2, "reviewed-distinct")
        db.commit()
        assert first["journal_id"] != result["journal_id"]


def test_classification_preserves_inverse_and_incomplete_direction_is_reviewed(
    sessions, setup
):
    owner, a = setup
    with sessions() as db:
        incomplete = ledger.create_draft(db, owner, {"currency": "THB"})
        assert incomplete["validation_errors"][0]["code"] == "MISSING_DIRECTION"
        original = post(
            db, owner, "expense", 123, source_account_id=a["cash"], category="food"
        )
        correction = ledger.correct_entry(
            db,
            owner,
            original["journal_id"],
            {"correction_effective_on": "2026-10-20", "reason": "Cancelled"},
            "inverse",
        )
        db.commit()
        for identity in [original["journal_id"], correction["reversal_journal_id"]]:
            with pytest.raises(ledger.MoneyError) as exc:
                ledger.classify_entry(
                    db,
                    owner,
                    identity,
                    {
                        "category": "transport",
                        "trip_id": None,
                        "tags": [],
                        "reason": "Must reject",
                    },
                    identity,
                )
            assert exc.value.code == "INACTIVE_CLASSIFICATION"
        rows = ledger.financial_transactions(db, owner)
        assert (
            sum(int(r["expense_effect_minor"]) for r in rows if r["category"] == "food")
            == 0
        )


def test_postgresql_economic_identity_correction_lineage(sessions, setup, monkeypatch):
    from app.config import get_settings

    owner, a = setup
    monkeypatch.setattr(
        get_settings(), "finance_trusted_reference_schemes", ["fixture_issuer"]
    )
    with sessions() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("Real PostgreSQL collision boundary required")
        payload = draft_payload(
            "expense",
            500,
            source_account_id=a["cash"],
            economic_identity={
                "scheme": "fixture_issuer",
                "reference": "fixture-payment-1",
                "account_context": a["cash"],
                "trustworthy": True,
            },
        )
        drafts = [ledger.create_draft(db, owner, payload) for _ in range(2)]
        db.commit()

    def worker(draft):
        with sessions() as db:
            try:
                result = ledger.confirm_draft(db, owner, draft["id"], 1, draft["id"])
                db.commit()
                return result["journal_id"]
            except ledger.MoneyError as exc:
                db.rollback()
                return exc.code

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(worker, drafts))
    assert results.count("ECONOMIC_DUPLICATE") == 1
    original = next(x for x in results if x != "ECONOMIC_DUPLICATE")
    with sessions() as db:
        replacement = ledger.correct_entry(
            db,
            owner,
            original,
            {
                "correction_effective_on": "2026-10-20",
                "reason": "Corrected amount",
                "replacement": draft_payload(
                    "expense", 450, source_account_id=a["cash"]
                ),
            },
            "replace",
        )
        db.commit()
        assert (
            ledger.economic_lineage(db, owner, original)["effective_journal_id"]
            == replacement["replacement_journal_id"]
        )
        ledger.correct_entry(
            db,
            owner,
            replacement["replacement_journal_id"],
            {"correction_effective_on": "2026-10-21", "reason": "Fully reversed"},
            "reverse-replacement",
        )
        db.commit()
        assert ledger.economic_lineage(db, owner, original)["state"] == "fully_reversed"
        fresh = ledger.create_draft(
            db, owner, {**payload, "duplicate_resolution": "distinct"}
        )
        with pytest.raises(ledger.MoneyError) as exc:
            ledger.confirm_draft(db, owner, fresh["id"], 1, "must-not-release")
        assert exc.value.code == "ECONOMIC_DUPLICATE"


def test_postgresql_confirm_cancel_edit_race(sessions, setup):
    owner, a = setup
    with sessions() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("Real PostgreSQL row locks required")
        draft = ledger.create_draft(
            db, owner, draft_payload("expense", 777, source_account_id=a["cash"])
        )
        db.commit()

    def action(kind):
        with sessions() as db:
            try:
                if kind == "confirm":
                    ledger.confirm_draft(db, owner, draft["id"], 1, "raced-confirm")
                elif kind == "edit":
                    ledger.edit_draft(
                        db, owner, draft["id"], 1, {"amount_minor": "778"}
                    )
                else:
                    ledger.cancel_draft(db, owner, draft["id"], 1)
                db.commit()
                return "ok"
            except ledger.MoneyError as exc:
                db.rollback()
                return exc.code

    with ThreadPoolExecutor(3) as pool:
        outcomes = list(pool.map(action, ["confirm", "edit", "cancel"]))
    assert outcomes.count("ok") == 1
    with sessions() as db:
        row = db.get(LedgerDraft, draft["id"])
        count = (
            db.query(JournalEntry)
            .filter_by(owner_id=owner, source_draft_id=draft["id"])
            .count()
        )
        assert count == (1 if row.status == "posted" else 0)
