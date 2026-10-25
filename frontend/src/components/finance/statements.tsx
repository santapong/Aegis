"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  financeAPI,
  formatTHB,
  newCommandKey,
  parseTHB,
  type FinanceAccount,
  type FinanceStatement,
  type FinanceStatementRow,
  type Operation,
} from "@/lib/finance-api";
import { FinanceError } from "./shared";
import { operationLabels } from "./draft-form";
import s from "./finance.module.css";

type StatementImport = Parameters<typeof financeAPI.importStatement>[0];

export function Statements({
  accounts,
  owner,
}: {
  accounts: FinanceAccount[];
  owner: string;
}) {
  const client = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [statementId, setStatementId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [rowsText, setRowsText] = useState("");
  const [review, setReview] = useState<StatementImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inFlight = useRef(false);
  const account = accounts.find((row) => row.id === accountId);
  const history = useQuery({
    queryKey: ["finance", owner, "statements", accountId],
    queryFn: () => financeAPI.statements(accountId),
    enabled: !!accountId,
    retry: false,
  });
  const statement = useQuery({
    queryKey: ["finance", owner, "statement", statementId],
    queryFn: () => financeAPI.statement(statementId),
    enabled: !!statementId,
    retry: false,
  });
  function prepare(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!account || !start || !end || start > end)
        throw new Error("Choose an account and a valid statement period.");
      const rows = rowsText
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line, index) => {
          const [
            day = "",
            amount = "",
            reference = "",
            description = "",
            status = "posted",
            ...extra
          ] = line.split("\t").map((field) => field.trim());
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
            day < start ||
            day > end ||
            extra.length
          )
            throw new Error(
              `Statement row ${index + 1}: use a date in the selected period and five tab-separated columns.`,
            );
          if (!["posted", "pending"].includes(status))
            throw new Error(
              `Statement row ${index + 1}: status must be posted or pending.`,
            );
          const minor = parseTHB(amount, true);
          return {
            stable_key: `${index + 1}:${day}:${minor}:${reference}`.slice(
              0,
              200,
            ),
            occurred_on: day,
            amount_minor: minor,
            reference,
            description,
            status: status as "posted" | "pending",
          };
        });
      if (!rows.length || rows.length > 500)
        throw new Error(
          "Paste between 1 and 500 statement rows for this review.",
        );
      setReview({
        account_id: accountId,
        request_key: newCommandKey(),
        period_start: start,
        period_end: end,
        opening_balance_minor: parseTHB(opening, true),
        closing_balance_minor: parseTHB(closing, true),
        rows,
      });
    } catch (e) {
      setError(e);
    }
  }
  async function save() {
    if (!review || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await financeAPI.importStatement(review);
      setStatementId(saved.id);
      setReview(null);
      await client.invalidateQueries({ queryKey: ["finance", owner] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <section
      className={`${s.panel} ${s.stack}`}
      aria-labelledby="statements-title"
    >
      <div>
        <h2 id="statements-title">Compare a statement</h2>
        <p className={s.muted}>
          Import a reviewed statement snapshot, match known movements, then
          review proposals for unmatched rows. Importing and matching do not
          post money or invent a balancing entry.
        </p>
      </div>
      <label className={s.field}>
        Statement account
        <select
          value={accountId}
          disabled={busy || !!review}
          onChange={(event) => {
            setAccountId(event.target.value);
            setStatementId("");
            setError(null);
          }}
        >
          <option value="">Choose an opened account</option>
          {accounts
            .filter((row) => row.opening)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.subtype}
              </option>
            ))}
        </select>
      </label>
      {account && (
        <>
          <p className={s.notice}>
            {account.subtype === "card"
              ? "For this card statement, debt is negative and a credit balance is positive. A purchase is a negative movement; repayment or refund is positive. This differs from the amount-owed field used during account setup."
              : "Use positive balances for money held and negative balances for overdrafts. Incoming movements are positive; outgoing payments are negative."}{" "}
            All amounts below are THB.
          </p>
          {history.isError && <FinanceError error={history.error} />}
          {history.data && history.data.length > 0 && (
            <label className={s.field}>
              Previously imported statements
              <select
                value={statementId}
                onChange={(event) => setStatementId(event.target.value)}
              >
                <option value="">Choose an imported statement</option>
                {history.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.period_start} → {row.period_end} · closing{" "}
                    {formatTHB(row.closing_balance_minor)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <details>
            <summary>Import a statement for review</summary>
            {review ? (
              <div className={s.stack}>
                <p className={s.notice}>
                  {account.name} · {review.period_start} to {review.period_end}
                  <br />
                  {review.rows.length} rows · opening{" "}
                  {formatTHB(review.opening_balance_minor)} · closing{" "}
                  {formatTHB(review.closing_balance_minor)}
                </p>
                <p className={s.muted}>
                  This saves a statement for comparison. Financial postings
                  require a separate draft confirmation.
                </p>
                <div className={s.actions}>
                  <button
                    type="button"
                    className={s.button}
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    Confirm statement import
                  </button>
                  <button
                    type="button"
                    className={`${s.button} ${s.secondary}`}
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Edit statement
                  </button>
                </div>
              </div>
            ) : (
              <form className={s.form} onSubmit={prepare}>
                <fieldset disabled={busy} className={s.form}>
                  <div className={s.fields}>
                    <label className={s.field}>
                      Period starts
                      <input
                        required
                        type="date"
                        value={start}
                        onInput={(event) => setStart(event.currentTarget.value)}
                        onChange={(event) => setStart(event.target.value)}
                      />
                    </label>
                    <label className={s.field}>
                      Period ends
                      <input
                        required
                        type="date"
                        value={end}
                        onInput={(event) => setEnd(event.currentTarget.value)}
                        onChange={(event) => setEnd(event.target.value)}
                      />
                    </label>
                    <label className={s.field}>
                      Opening signed balance · THB
                      <input
                        required
                        inputMode="decimal"
                        value={opening}
                        onChange={(event) => setOpening(event.target.value)}
                        placeholder={
                          account.subtype === "card" ? "-2000.00" : "20000.00"
                        }
                      />
                    </label>
                    <label className={s.field}>
                      Closing signed balance · THB
                      <input
                        required
                        inputMode="decimal"
                        value={closing}
                        onChange={(event) => setClosing(event.target.value)}
                      />
                    </label>
                  </div>
                  <label className={s.field}>
                    Paste statement rows from a spreadsheet
                    <textarea
                      required
                      value={rowsText}
                      onChange={(event) => setRowsText(event.target.value)}
                      rows={6}
                      placeholder={
                        "2026-10-20\t-150.00\tSLIP-01\tLunch\tposted"
                      }
                    />
                    <small>
                      Five columns separated by tabs, without a header: date
                      (YYYY-MM-DD), signed movement in THB, reference,
                      description, status (posted or pending). Keep blank
                      reference/description columns. Pending holds are retained
                      separately.
                    </small>
                  </label>
                  <button type="submit" className={s.button}>
                    Review statement import
                  </button>
                </fieldset>
              </form>
            )}
          </details>
        </>
      )}
      {error != null && <FinanceError error={error} />}
      {statement.isFetching && (
        <p role="status">Loading statement comparison…</p>
      )}
      {statement.isError && (
        <FinanceError
          error={statement.error}
          retry={() => void statement.refetch()}
        />
      )}
      {statement.data && (
        <StatementComparison
          statement={statement.data}
          accounts={accounts}
          onUpdated={async () => {
            await client.invalidateQueries({ queryKey: ["finance", owner] });
          }}
        />
      )}
    </section>
  );
}

function StatementComparison({
  statement,
  accounts,
  onUpdated,
}: {
  statement: FinanceStatement;
  accounts: FinanceAccount[];
  onUpdated: () => Promise<void>;
}) {
  return (
    <div className={s.stack}>
      <h3>
        {statement.reconciled
          ? "Statement reconciled"
          : "Statement has unresolved differences"}
      </h3>
      <dl className={s.detail}>
        <div>
          <dt>Statement closing balance</dt>
          <dd className={s.amount}>
            {formatTHB(statement.closing_balance_minor)}
          </dd>
        </div>
        <div>
          <dt>Tracked balance at period end</dt>
          <dd className={s.amount}>
            {statement.tracked_closing_balance_minor === null
              ? "Unknown · no opening by this date"
              : formatTHB(statement.tracked_closing_balance_minor)}
          </dd>
        </div>
        <div>
          <dt>Statement − tracked difference</dt>
          <dd className={s.amount}>
            {statement.difference_minor === null
              ? "Unknown · review opening cutoff"
              : formatTHB(statement.difference_minor)}
          </dd>
        </div>
        <div>
          <dt>Statement arithmetic difference</dt>
          <dd className={s.amount}>
            {formatTHB(statement.statement_arithmetic_difference_minor)}
          </dd>
        </div>
      </dl>
      {statement.rows.map((row) => (
        <StatementLine
          key={`${row.id}:${row.draft_id}:${row.matched_journal_id}`}
          row={row}
          statementId={statement.id}
          account={accounts.find(
            (account) => account.id === statement.account_id,
          )}
          accounts={accounts}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function StatementLine({
  row,
  statementId,
  account,
  accounts,
  onUpdated,
}: {
  row: FinanceStatementRow;
  statementId: string;
  account?: FinanceAccount;
  accounts: FinanceAccount[];
  onUpdated: () => Promise<void>;
}) {
  const [candidate, setCandidate] = useState("");
  const [type, setType] = useState<Operation>(
    account?.subtype === "card"
      ? BigInt(row.amount_minor) < BigInt(0)
        ? "card_purchase"
        : "card_repayment"
      : BigInt(row.amount_minor) < BigInt(0)
        ? "expense"
        : "income",
  );
  const [counterparty, setCounterparty] = useState("");
  const [original, setOriginal] = useState("");
  const [distinct, setDistinct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function act(match: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (match)
        await financeAPI.matchStatementRow(statementId, row.id, candidate);
      else
        await financeAPI.draftStatementRow(statementId, row.id, {
          type,
          keep_distinct: distinct,
          counterparty_account_id: counterparty || null,
          original_expense_entry_id: original || null,
        });
      await onUpdated();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`${s.account} ${s.stack}`}>
      <div className={s.row}>
        <div>
          <h3>
            {row.occurred_on} · {row.description || "Statement row"}
          </h3>
          <p className={s.muted}>
            {row.status} · {row.reference || "No reference"}
          </p>
        </div>
        <strong className={s.amount}>{formatTHB(row.amount_minor)}</strong>
      </div>
      {row.matched_journal_id ? (
        <p className={s.muted}>
          Matched to an existing journal. No new financial entry was created.
        </p>
      ) : row.draft_id ? (
        <Link
          className={s.link}
          href={`/review?draft=${encodeURIComponent(row.draft_id)}`}
        >
          Review this row’s pending proposal
        </Link>
      ) : row.status === "pending" ? (
        <p className={s.muted}>
          Pending hold: retained for comparison and excluded from posted
          statement movements.
        </p>
      ) : (
        <>
          {row.candidate_journal_ids.length > 0 && (
            <>
              <label className={s.field}>
                Possible existing movement
                <select
                  value={candidate}
                  onChange={(event) => setCandidate(event.target.value)}
                >
                  <option value="">
                    Choose a journal after checking its reference
                  </option>
                  {row.candidate_journal_ids.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={busy || !candidate}
                onClick={() => void act(true)}
              >
                Match existing movement
              </button>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={distinct}
                  onChange={(event) => setDistinct(event.target.checked)}
                />
                <span>
                  I checked the possible matches; this row is a separate real
                  movement.
                </span>
              </label>
            </>
          )}
          <label className={s.field}>
            Proposal type
            <select
              value={type}
              disabled={busy}
              onChange={(event) => setType(event.target.value as Operation)}
            >
              {Object.entries(operationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {["transfer", "card_repayment"].includes(type) && (
            <label className={s.field}>
              Other owned account
              <select
                value={counterparty}
                disabled={busy}
                onChange={(event) => setCounterparty(event.target.value)}
              >
                <option value="">Choose the other account</option>
                {accounts
                  .filter((item) => item.opening && item.id !== account?.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {type === "refund" && (
            <label className={s.field}>
              Original expense journal reference
              <input
                value={original}
                disabled={busy}
                onChange={(event) => setOriginal(event.target.value)}
              />
            </label>
          )}
          <button
            type="button"
            className={s.button}
            disabled={
              busy || (row.candidate_journal_ids.length > 0 && !distinct)
            }
            onClick={() => void act(false)}
          >
            Create proposal for unmatched row
          </button>
          <p className={s.muted}>
            The proposal must be reviewed and confirmed separately before
            balances change.
          </p>
        </>
      )}
      {error != null && <FinanceError error={error} />}
    </article>
  );
}
