# LINE and budget acceptance with Robot Framework

These are real HTTP acceptance cases against an isolated PostgreSQL-backed
Aegis API. They do not wrap pytest or replace the API with response fixtures.
The Python keyword library keeps cookies, link commands and confirmation
capabilities internal, so the Robot report has readable scenarios without
printing them as keyword arguments. All users, balances and identifiers are
fictional. No test sends a request to LINE or an AI provider.

Install the application's locked test dependencies and `requirements.txt` in
an isolated environment. Start a new disposable local PostgreSQL database named
`aegis_robot_test`, run the current Alembic migrations there, and start
`robot_server.py` with `AEGIS_ROBOT_FIXTURE=1`. Its guarded bootstrap rejects
ordinary database names or remote database hosts. Supply only test credentials
and keep actual provider/delivery keys absent. The `/__robot__/clock` route is
defined only in this test module, protected by a test-controller header and a
loopback source check; it is never added to the production application.

The acceptance runner requires `AEGIS_ROBOT_DATABASE_URL` to identify that same
disposable database, `PYTHONPATH` including `backend`, and the API at loopback
port8000. Run:

```sh
python -m robot --outputdir robot-results --name "Aegis LINE and Budgets" \
  --loglevel WARN backend/tests/robot/line_budgets.robot
```

The output is native Robot Framework `report.html`, `log.html` and `output.xml`.
Do not copy a production database or real LINE credentials into this setup.
The test clock advances server-side setup/action time; it does not establish
an elapsed24-hour phone soak. The test server lifts auth rate limits for
fixture creation, so this suite does not qualify production rate limiting.

The fixture preserves one final fictional account for a visible browser login.
It has one THB10,000 tracking account and one unreviewed THB5,000 monthly budget.
Its fixed test-only login exists only in the disposable database and is removed
with the test stack. It is not a real account or a customer credential.

Use real PostgreSQL regression tests in `test_budget_currency_postgres.py` for
controlled contention in both serial orders. They observe `pg_blocking_pids`
and require the dedicated `AEGIS_CASH_TEST_DATABASE_URL` fixture. SQLite runs
skip those cases explicitly.

The October25 execution/limits and Horizon integration candidate are recorded
in `docs/validation/2026-10-25-robot/TASKS.md` and its adjacent results. The
candidate does not merge or deploy the parallel Horizon worktree.


The subsequent develop integration is recorded in
`docs/validation/2026-10-25-develop-integration/README.md`. To exercise the
browser-facing topology, start the built frontend in the same isolated network
namespace (port3000) and run `frontend_proxy.robot` with the same library/env.
Direct API acceptance does not cover collection slash handling in the proxy.
