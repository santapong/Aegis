# Isolated verification proposal — 25 October 2026

Source: `feature/line-money-ledger-20261022`, base `e2c4a9c`, with existing dirty
work preserved. The test bundle must be allowlisted backend/frontend source,
tests, scripts, public assets and lockfiles, with a hash manifest. Exclude all
environment files, credentials, saved databases, `.git`, dependency trees and
previous preview outputs. Source remains local and unpushed.

Local Kali headroom at preflight was 6.7–7.2 GiB available on a 31.2 GiB host,
below the service-test default reserve. No full Aegis build/test stack is admitted
there. Pi read-only preflight found approximately 12 GiB available, 57.6°C, low
load, n8n health/readiness 200 and no failed system units. Its cgroup controllers
still omit memory; a hard aggregate memory cap is unavailable.

Proposed execution, requiring approval for this new soft-guard test run:

- Use fresh containers labeled `codex.task=aegis-line-tools-20261025`, based on
  existing ARM64 Python/backend and Node images. Do not exec tests inside the
  retained phone pilot or use its database. Test fixtures use in-memory SQLite.
- Run one phase at a time, CPU quota at most 1 core, low CPU shares, PID cap 128,
  each phase at most 10 minutes and total at most 30 minutes. No host ports for
  backend checks; no workflow activation, provider calls or channel changes.
- A host watchdog starts first, samples every 5 seconds, and stops only these
  named test containers if summed RSS exceeds 1.5 GiB, available RAM drops below
  8 GiB, temperature reaches 70°C, or a firmware fault appears. Python also has a
  1 GiB address-space ceiling. These are soft aggregate safeguards, not a kernel
  memory cap. Recheck admission and actual CPU/PID controls before execution.
- Dependency/source/artifact growth stays below 1 GiB; logs below 50 MiB, with
  monitoring/cancellation. Fetch only missing pinned test dependencies during
  preparation, then disconnect test networking. No production credentials.
- Backend command: `python -m pytest backend/tests/test_line_onboarding_tools.py
  backend/tests/test_finance_integration.py backend/tests/test_finance_reads.py
  -q`; no parallel pytest workers. Run the currency-review stale-facts case and
  existing confirmation/replay/expiry boundaries in this selection.
- Frontend: existing lockfile install (reuse an appropriate isolated cache if
  available), `tsc --noEmit --incremental false`, then a small fake-data
  component preview/check of the actual changed components. No full production
  build unless the scoped check identifies a need and the same budget fits.
- Verify inactive, credential-free rich-menu/workflow exports; retain a fresh
  menu image and source hashes. Provider provisioning and real phone scanning
  remain pending.

At finish, retain safe logs/results, stop the watchdog, remove only this run's
containers/temporary dependencies, confirm cancellation/cleanup, and repeat
n8n health/readiness plus Pi resource observations. Retain source/evidence for
review. Neither passing tests nor the procedure establish a resource-saving or
learning benefit without a supported comparison.
