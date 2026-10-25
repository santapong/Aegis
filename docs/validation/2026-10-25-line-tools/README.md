# LINE setup and budget tools — 25 October 2026

Owner requirements: the QR/setup code expired before linking finished; use a
24-hour new setup capability and add monthly spending/remaining budget replies
plus useful LINE shortcuts. Source is the isolated
`feature/line-money-ledger-20261022` worktree, base `e2c4a9c`, preserving prior
dirty work. No commit, push, deployment, channel change, live menu provisioning
or workflow activation has been performed.

## Implemented scope

- Configurable 24-hour new one-use challenges; renewal retires the old code.
  Stored existing challenges keep their old expiry. Persistent identity links,
  web session and financial confirmation lifetimes remain separate.
- Local API-generated QR and prefilled LINE link when the verified public bot
  ID is configured, copy fallback, private/no-store response, countdown, expiry,
  renewal and owner-keyed setup state. The user must press Send in LINE.
- Owner-scoped active budget replies using canonical exact ledger reports,
  signed refunds, explicit periods, remaining/over-limit amounts, no sum of
  overlapping limits and visible currency/history gaps. Six limits per reply;
  larger sets link to Aegis.
- `budget(s)`/`งบ`, pending review and help/tools commands; six postback menu
  areas. The old trips menu action remains compatible. No shortcut confirms a
  financial draft.
- Budget currency review UI, current-facts hash and row lock before confirmation;
  changed facts reject409 with a refresh/review path.

## Executed verification

The [test proposal](test-proposal.md) was approved explicitly in this chat.
The Pi uses fresh containers and in-memory SQLite; it does not use the retained
phone pilot or production financial database. Network is enabled only for
missing pinned dependency preparation, then disabled for tests. The Pi still
lacks memory cgroups: enforced CPU/PID limits plus RSS/headroom/temperature
watchdog and Python address-space limits are not a hard aggregate memory cap.

- Final backend selection: **31 passed, 2 skipped**, 44.44 seconds, ARM64/Python
  3.11, after the final reviewed-facts row lock and test repairs. Includes six
  new setup/tools cases and existing integration/read regressions. The two
  genuine PostgreSQL row-lock cases were skipped, not passed. See
  [final backend log](out/backend-final.log).
- New-test lint passed. Its first check caught import ordering and naive
  test-clock construction; these were corrected without changing the expected
  times. The original [failed check](out/lint.log) and
  [passing rerun](out/lint-final.log) are retained.
- Source checks parsed six changed Python files and transpiled four TS/TSX
  files. The subsequent full frontend [TypeScript check](out/types.log) passed
  using frozen Bun dependencies on Node22. After that check, only a copy-error
  sentence changed; the final bundle and browser fallback were rechecked.
  Backend `uv lock --check --offline` also passed; the dependency delta from
  the preserved baseline is qrcode8.2 only.
- The rich-menu image was regenerated and visually inspected. The tiny local
  render/transpile jobs each used CPUQuota25%, MemoryMax192MiB, no swap and
  TasksMax32; actual controls were inspected. Observed peak memory was about
  46MiB and 105MiB respectively, and both transient units exited successfully.
- Frontend verification correctly declined admission at a Pi temperature of
  65°C. No frontend dependency/build job started in that attempt. Subsequent
  phases began only after a qualifying temperature observation. Another
  user's build was observed during the wait and was left untouched.
- The visible component preview exercised QR/Open LINE presentation, renewal,
  successful-link QR removal, owner-switch cleanup, budget currency confirmation,
  expiry/recovery, copy success/failure and keyboard selection of the complete
  fallback command. Clipboard writes were stubbed to avoid replacing the user's
  real clipboard. There were no captured console errors/warnings. The fake
  expiry case uses two seconds; server lifetime boundaries use clock-advanced
  backend tests. No real LINE URL was opened or message sent.
- At a requested 320px viewport, the document client/scroll width was305px
  (vertical scrollbar included) and the connection panel client/scroll width
  was255px. The QR and controls fitted without horizontal overflow. Viewport
  overrides were reset and the task tab was closed. Captures:
  [desktop setup](setup-desktop.png), [320px setup](setup-mobile-320.png),
  [expired setup](setup-expired.png), [copy fallback](copy-fallback.png).
- Ten critical backend/frontend files in the executed Pi copies match the
  final local source hashes: [source check](tested-source-match.json).

## Resource outcome and monitoring recovery

Container CPU quotas were1core initially,0.5core for subsequent test/type/build
jobs and0.1core for the idle fixture server; PID limits were128per container.
The small preview/rebuild envelope was at most0.6configured cores and256PIDs
combined. Shared production services and the reused desktop browser are outside
these container controls. No hard aggregate Pi memory cap is claimed.

The largest retained RSS sample was564.1MiB; temporary source/dependency/log
storage before cleanup was497.6MiB, below the1GiB proposal. These are scoped
samples, not sustained capacity qualification or a complete continuous peak.

During dependency preparation, the first watchdog's Docker inspection call
timed out after8seconds. The fail-closed handler stopped owned work; the next
phase was not admitted. The supported cause is that inspection timeout; the
underlying daemon latency is unknown. After checking the actual Docker driver
was `systemd`, the revised guard used only task-owned Docker cidfiles and the
matching `/sys/fs/cgroup/system.slice/docker-<id>.scope` files to read CPU/PID
controls and process RSS. Subsequent real type/backend/preview phases retained
the expected controls and ended without guard events. This is a scoped recovery
for this driver/host; do not assume these paths or trust arbitrary cidfiles on a
different runtime. The local recovery helper is retained at
`/home/santapong/.local/state/aegis-line-features-20261025/pi-guard.py`.

The original monitor failure log and before/after guard receipts are retained.
Post-check n8n health/readiness both returned200, and both existing phone-pilot
workflows remain inactive. [Cleanup](cleanup.json) confirms no task containers,
no running watcher, no new database volume, and removal of temporary dependency
trees. The task SSH forward is closed; source and logs remain for review.
See [machine outcome](outcome.json) and [post-check Pi health](pi-health-after.log).

The backend uses clock advancement for the 20/24-hour boundary; this is not an
elapsed 24-hour handset soak. Real QR scanning/delivery and live provisioning
remain untested. No paid model/OCR call was made. Source hashes and safe test
logs are retained with the final receipt; no live link tokens or credentials
belong in this directory.

## Remaining release checks

Genuine PostgreSQL concurrency qualification for the new row-lock path;
independent review/remote CI; deliberate deployment and configured bot ID;
resumed fictional-phone acceptance and rich-menu publication. The browser check
used the actual changed components with fictional responses, not the full
authenticated app or a real phone camera. Neither a passing task nor a saved
learning record establishes that a lesson caused a quality or resource
improvement.
