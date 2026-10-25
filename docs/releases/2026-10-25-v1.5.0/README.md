# Aegis v1.5.0 — release preparation

User authorized merging, a tagged release and Vercel deployment. A later steering
message requested locating the updated logo: the Union identity in the parallel
Horizon worktree was newer than the first develop integration. It is now included
without overwriting the verified LINE/budget and proxy changes.

Current branch: release/v1.5.0, based on develop8e6c5aa. This is a prepared release;
no v1.5.0 tag, main update or production deployment is claimed yet. Canonical
work record: TASKS.md.

The24h setup/QR/menu and monthly budget features, exact ledger and cash planning
remain documented in the earlier integration report. Existing LINE phone pilot
activation is separate and remains paused. Operator configuration and explicit
account/currency/opening reviews continue to govern financial cutover.

Release checks include a pinned Next15.5.28/sharp0.35.5 build, Union artwork and
metadata, tracked THB dashboard labels, actual PostgreSQL contention, Robot HTTP
acceptance and same-origin proxy behavior. Local97-page build/types,9 PostgreSQL contention cases and21Robot tests passed. Browser Union light/dark, trackedTHB labels, persisted budget review and320px layout passed. The final compatible tooling lock changes and exact dashboard header helper require the fresh CI build; source-validation-scope.json records that boundary.

The earlier CI run passed frontend, SQLite3.11/3.12 and scan jobs; its two genuine
PostgreSQL jobs failed9 old-boundary observer cases. See ci-original.json. The
repair retains actual pg_blocking_pids and all original financial postconditions.

Production data compatibility must be confirmed before deploying the full app:
new Transaction columns require additive Alembic migrations even while new feature
flags remain disabled. Preserve financial/audit data and a verified recovery path;
do not downgrade populated cash/ledger tables as an application rollback.

The Vercel connector currently requires a renewed team grant. Existing project
metadata identifies aegis/prj_AZS5jNpi2EN4DMuwmXhfpWJeYjcv in
team_4xUt8aSlfT696WCBgbsjtJTV; the separate draveniq-aegis-landing static site
is not automatically the full-app deployment target.


Cloud deployment context is now verified with authenticated Vercel CLI65.2.0:
aegis, projectprj_AZS5jNpi2EN4DMuwmXhfpWJeYjcv, the existing team, rootServices,
Node24, connected repositorysantapong/Aegis and production branchmain. The native
Git path handles main; the corrected root-level deployment workflow is manual
fallback to avoid duplicate automatic deployments. CLI access does not require
renewing the separate connector grant.

Sensitive production settings are not exportable. Local env-run fallback results
are not accepted as production DB proof. The gated backend build step uses the
actual production connection in Vercel; four real PostgreSQL rehearsal cases
passed, including data-preservation failure rollback. See schema-gate.md.
Existing exact-ledger client boundary script passed; it is now included in CI.

Native develop preview dpl_52zUz23FrFQcziR56qpKQZVe35cd rejected ambiguous Next.js/Container detection before building. The frontend Services framework is now pinned to nextjs, matching the existing app. This configuration repair requires its own cloud build; application-test results remain scoped to their recorded source.

Production-target stage dpl_2NSSmbQYXVj2UBX2c1RPnzF1UZeC failed before backend build: the Google font loader could not parse a Syne font URL extension. The login now loads the same Syne variable family locally with its OFL license and source/hash receipt. This is a scoped font-source repair, not a visual redesign. Framework issue reference: https://github.com/vercel/next.js/issues/99114. A new cloud build must qualify this change.
