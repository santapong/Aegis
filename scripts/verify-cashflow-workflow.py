"""Finite local verification stages; evidence never substitutes for review or release."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STAGES = {
    "cash_sqlite": (
        "backend",
        [
            ".venv/bin/pytest",
            "-q",
            "tests/test_cashflow.py",
            "tests/test_cashflow_m2.py",
            "tests/test_cashflow_m3.py",
            "tests/test_cashflow_m4.py",
            "tests/test_cashflow_review.py",
        ],
        False,
    ),
    "cash_postgres": (
        "backend",
        [
            ".venv/bin/pytest",
            "-q",
            "tests/test_cashflow.py",
            "tests/test_cashflow_m2.py",
            "tests/test_cashflow_m3.py",
            "tests/test_cashflow_m4.py",
            "tests/test_cashflow_review.py",
        ],
        True,
    ),
    "backend": ("backend", [".venv/bin/pytest", "-q"], False),
    "frontend_types": ("frontend", ["node_modules/.bin/tsc", "--noEmit"], False),
    "frontend_session": (
        "frontend",
        ["node", "../scripts/verify-cash-client-session.mjs"],
        False,
    ),
    "frontend_build": ("frontend", ["npm", "run", "build"], False),
    "cash_lint": (
        "backend",
        [
            "ruff",
            "check",
            "app/services/cashflow",
            "app/services/transaction_scope.py",
            "app/routers/cashflow.py",
            "app/models/cashflow.py",
            "app/schemas/cashflow.py",
            "tests/test_cashflow.py",
            "tests/test_cashflow_m2.py",
            "tests/test_cashflow_m3.py",
            "tests/test_cashflow_m4.py",
            "tests/test_cashflow_review.py",
        ],
        False,
    ),
    "line_lint": (
        "backend",
        [
            "ruff",
            "check",
            "app/routers/line_finance.py",
            "app/services/line_finance.py",
            "app/services/line_finance_worker.py",
            "app/models/line_finance.py",
            "app/schemas/line_finance.py",
            "tests/test_line_finance.py",
            "tests/test_cashflow_m4.py",
            "tests/test_cashflow_review.py",
        ],
        False,
    ),
}


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def sources():
    paths = set()
    for pattern in [
        "backend/app/**/*.py",
        "backend/tests/**/*.py",
        "backend/alembic/**/*.py",
        "frontend/src/**/*",
        "frontend/next.config.ts",
        "frontend/package.json",
        "backend/pyproject.toml",
        "scripts/*cash*.py",
        "scripts/*cash*.mjs",
        ".github/workflows/test.yml",
    ]:
        paths.update(p for p in ROOT.glob(pattern) if p.is_file())
    return {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(paths)
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, required=True, help="New directory for this run"
    )
    parser.add_argument(
        "--stages",
        nargs="+",
        choices=list(STAGES),
        default=["cash_sqlite", "cash_postgres", "frontend_session", "frontend_build"],
    )
    args = parser.parse_args()
    assert not args.output.exists(), (
        "Retain previous results; select a fresh output directory"
    )
    assert len(args.stages) == len(set(args.stages)), "Run each selected stage once"
    args.output.mkdir(parents=True)
    baseline = sources()
    (args.output / "sources.json").write_text(json.dumps(baseline, indent=2) + "\n")
    source_hash = hashlib.sha256(
        json.dumps(baseline, sort_keys=True).encode()
    ).hexdigest()
    report = {
        "started_at": timestamp(),
        "source_hash": source_hash,
        "stages": [],
        "independent_review": "pending",
        "real_line_pilot": "pending",
        "remote_ci": "pending",
        "release": "pending",
    }
    env = dict(os.environ)
    env.update(
        DEBUG="true",
        JWT_SECRET="local-cash-test-secret-padding-32-chars",
        DATABASE_URL="sqlite://",
        NEXT_PUBLIC_API_URL="",
        AEGIS_DIST_DIR=".next-cashflow-release",
        NEXT_TELEMETRY_DISABLED="1",
    )
    env.pop("AEGIS_CASH_TEST_DATABASE_URL", None)
    failed = False
    try:
        for name in args.stages:
            folder, command, postgres = STAGES[name]
            stage_env = dict(env)
            if postgres:
                # This is the existing fictional task-local database. The fixture
                # creates/removes its own schema and guards the database name.
                stage_env["AEGIS_CASH_TEST_DATABASE_URL"] = (
                    "postgresql://postgres:aegis-local-test-only@127.0.0.1:5548/aegis_cash_test"
                )
            if sources() != baseline:
                raise RuntimeError(
                    "Sources changed during verification; start a new run"
                )
            executable = ROOT / folder / command[0]
            assert executable.is_file() or shutil.which(command[0]), (
                f"Missing {command[0]}"
            )
            item = {"stage": name, "command": command, "started_at": timestamp()}
            report["stages"].append(item)
            with (args.output / f"{name}.log").open("w") as log:
                process = subprocess.Popen(
                    command,
                    cwd=ROOT / folder,
                    env=stage_env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                )
                item["pid"] = process.pid
                (args.output / "result.json").write_text(
                    json.dumps(report, indent=2) + "\n"
                )
                print(f"{name}: started (pid {process.pid})", flush=True)
                item["exit_code"] = process.wait()
            item["finished_at"] = timestamp()
            item["source_unchanged"] = sources() == baseline
            failed = item["exit_code"] != 0 or not item["source_unchanged"]
            (args.output / "result.json").write_text(
                json.dumps(report, indent=2) + "\n"
            )
            print(f"{name}: {'failed' if failed else 'passed'}", flush=True)
            if failed:
                break
    except (AssertionError, RuntimeError) as error:
        failed = True
        report["error"] = str(error)
    report.update(finished_at=timestamp(), selected_stages_passed=not failed)
    (args.output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
