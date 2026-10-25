# Fresh container installation check

October 2, 2026. Local, fictional fixtures only. Linux/amd64; Docker 29.8. A successful local image build/start is not remote CI, a public deployment or real LINE delivery.

## Result and source

Both repaired images built and ran as non-root users. The backend's default entrypoint migrated an empty PostgreSQL 16 database to `a1002cf00004`, then started four API workers with Redis. The ordinary ARQ worker also booted against that database/Redis; its log proves startup, not PDF rendering or LINE delivery. The frontend standalone server baked the same-origin `/api/*` rewrite to the `backend` network alias. See [runtime versions, image IDs and source comparison](runtime-proof.json), [configuration checks](compose-config-checks.json), [container states](container-states.json) and [receipt](receipt.json).

Final input manifest: `0855752f343c865fb21a092896dbee73b4f6ad4be2e10fcc89b3ac410dd41a41`. [Exact inputs](inputs-final.json) include runtime source/assets, dependencies/locks, container configuration and CI build paths. Application, tests and migration files match the earlier independently reviewed `c96f75fc…` manifest; only its test-workflow entry changed. Packaging files have their own manifest. Old build attempts remain retained.

[Final proxy/API probe](install-probe-final.json) combines executed checkpoints from R3/R5 and a final read/guard verification, without silently recreating prior records. It proves:

- Seven public/app routes and 23 static assets return 200; anonymous cash API access rejects 401 and login sets an HttpOnly session cookie. Changelog release history is visible after hydration, with no captured browser warning/error: [screenshot](changelog-browser.png), [DOM](changelog-browser-dom.txt), [console](changelog-browser-console.json).
- Missing opening cash stays unknown. Matching an already recorded 100 receipt keeps cash 5,100 and reduces projected closing from 5,300 to 5,200.
- CSV preview posts no cash; same-key confirmation returns the original result without a duplicate. Confirmed cash is 5,034.75. A 100 reserve changes the reserve figure without changing that cash. An explicit schedule end remains enforced; a separate open schedule adds 12 occurrences while preserving existing IDs.
- Business matching adds zero cash and leaves 800 unpaid. Thirteen-week review returns 13 weeks. A saved 5,000 forecast versus recorded 5,500 attributes 500 to the opening change and zero to unexplained; later mutations preserve its payload. A retry aimed at another document rejects 409. Another owner cannot read the workspace/snapshot.
- Signed fictional LINE capture changes no cash before confirmation; duplicate events/confirmation add one movement. Confirmation reduces cash to 5,014.75; undo returns it to 5,034.75 while retaining the original and linked reversal. Provider delivery is unconfigured; the unauthenticated drain rejects 401. No provider token, real channel or external message was used.

## Repairs and retained failures

The original backend image built but could not start: installing directly from `pyproject.toml` selected SQLAlchemy 2.1.2, whose bare PostgreSQL URL selects an absent psycopg3 driver. The reviewed lock uses SQLAlchemy 2.0.49/psycopg2. Backend Docker and CI now export the lock with `--locked` and install pinned hash-checked requirements. [First startup failure](api-start-first.log), [repaired backend build](backend-build-r2.log), [upstream default-driver change](https://docs.sqlalchemy.org/en/21/changelog/migration_21.html). This repairs the build resolution; application/DB source and lock contents were not changed.

The first frontend attempt ended with exit 130, cause unknown. A single deliberate retry produced the actionable `/changelog` ENOENT: the frontend-only build context omitted root `CHANGELOG.md`. The frontend Dockerfile now builds from the repository root and copies the canonical changelog into builder/runner. A Dockerfile-specific deny-by-default context admits frontend files/changelog while excluding local dependencies, outputs and environment files. Makefile, Compose and both publishing matrices use the same context. [Failed retry](frontend-build-r2.log), [repaired build](frontend-build-r3.log). No publishing job was triggered.

The same single owner-authorized independent reviewer inspected these packaging changes and found no actionable findings. Its offline exports independently confirmed 84 runtime and 103 CI requirements pinned and hashed. See [review ledger](../independent-review.md).

The first probe could not reach the host: containers on the internal-only network reported null published ports in this Docker environment. Attaching only the web container to a separate host-facing bridge enabled its existing loopback mapping; API/DB/Redis stayed internal. Failed harness assumptions were corrected from actual source/runtime: HTML separates `v` and version text; explicit schedule ends cannot be extended; CSV rows use `status`; absent delivery authorization rejects 401 before token availability. Original failed logs/JSON are retained. These fixture/network corrections are not application bugs or waived financial assertions.

## Repeating this bounded check

1. Use a new dated evidence directory, image tags, labeled network/container names and free loopback web port. Preserve prior logs. Verify the exact input manifest before builds.
2. From the repository root, build backend with `-f backend/Dockerfile backend` and frontend with `-f frontend/Dockerfile .`. The frontend build needs the root changelog; changing its proxy destination requires rebuilding.
3. Use a fresh PostgreSQL database and Redis with task-only dummy values. Do not load a real environment file. Enable cash only in this fixture, use a non-secret dummy JWT key and fake LINE signature secret, and leave provider/delivery tokens unset.
4. Start backend once, observe fresh migrations/health and recorded runtime versions; start the standalone web image with the `backend` alias reachable. Check actual published-port state before a host probe. Keep the DB/API private and publish only the web port on loopback.
5. Exercise the fictional personal/business/capture story through the web proxy. Match the actual contract rather than assuming field names or extending beyond an explicit schedule end. Retain a failed checkpoint and continue from known state when safe; do not blindly replay writes.
6. Save logs, versions, source hashes, browser proof and scope limits. Stop/remove only the exact task-labeled containers and their disposable volumes/networks; retain reviewed images/evidence. Keep the existing owner preview untouched.

Not executed: full Compose bring-up, dev-overlay hot reload, public TLS/proxy setup, ARM64 image build, remote CI/security/publish jobs, production load, a customer migration, real mobile/LINE delivery or owner comprehension. Base images/build tools are not fully digest-pinned. No claim of launched self-hosted or managed subscriptions follows from this rehearsal.

Final resource state: [cleanup receipt](cleanup.json) proves removal of only the five exact labeled release-check containers and their disposable volumes/networks. Their stopped state was observed after interruption before removal; it is not a fresh running-health claim. [ARQ log](worker-start-and-stop.log) shows idle startup and zero completed jobs. Its inherited HTTP API healthcheck is unsuitable for a worker; worker health/job execution is not certified. The original pilot database and reviewed images are preserved; the original transient preview definitions are absent and the preview is currently stopped.

## Worker heartbeat repair after reconciliation

The later Compose worker override replaces the image's HTTP probe with `arq --check app.worker.WorkerSettings`. A separate [executed disposable rehearsal](worker-health.json) proved no worker → exit 1, running worker → Docker healthy/manual exit 0, and graceful stop → exit 1; effective Compose configuration also matched. Its empty Redis/SQLite containers and internal network were removed. No job or provider delivery was invoked. The same authorized reviewer reported no actionable findings at Compose hash `0477670786f5490d958845c8a4300a3840df26b8267292fcb9f2e7a4d9ef9553`.

This verifies heartbeat availability, not rendered jobs or immediate detection of a hung/abruptly failed worker: the existing ARQ heartbeat interval/expiry is about an hour. [ARQ's heartbeat contract](https://arq-docs.helpmanual.io/#health-checks). No application, image-source or dependency change followed the original build; [the operational delta](worker-health-delta.json) records only `docker-compose.yml`, separately from the retained original build inputs. The earlier statement about worker health describes the pre-repair checkpoint; this later check closes only the specific heartbeat criterion.
