# v1.5.0 scoped release review

Current execution: [tag/deployment, schema result and scoped live checks](RELEASED.md). Preparation findings below remain dated evidence, with unresolved scope retained.

Next15.5.28 and sharp0.35.5 are pinned in package/lock and were observed loaded
by the actual isolated frontend runtime. The Next upgrade alone retained the
vulnerable sharp0.34 family through the existing lock; the explicit pin/override
closed that boundary. PNG optimization returned200 and the default SVG optimizer
rejected a local SVG with400. This is not an exploitation test or proof of every
possible input path.

Lodash4.18.0, nanoid3.3.18, PostCSS8.5.23 and source-map-js1.2.2 resolve matched
advisories within their compatible major families. A reviewed Bun audit-fix dry
run then proposed only seven compatible versions across five remaining tooling
packages. Applied without --latest; final Bun1.4.0 audit JSON was{} (exit0,
486packages checked in the fixer report). Original findings/dry run are retained.
Advisory dataset as-of is not supplied. Lock hashes identify the queried input.
A zero-result NPM query does not cover Python/OS packages, vendored code, unknown
CVEs or actual Vercel host configuration. Latest CI must rebuild the final lock.

The earlier current-develop CI failed nine cash concurrency observer cases. Its
observer watched a later transaction row although new writers first serialize
the owner. The revised observer matches both documented owner modes (FOR UPDATE
and FOR NO KEY UPDATE), requires actual pg_blocking_pids and retains every
financial outcome/audit assertion. First local repair7pass/2fail and final9pass
are retained. No money, owner or replay assertion was removed or relaxed.

The release includes the later owner-selected Union identity. Local real browser
checks cover both public themes, native icons, tracked THB labels, keyboard budget
currency review, reload persistence and320px layout. Real LINE/provider delivery
is not reactivated. Production credentials/data were not used in these checks.

Vercel target, schema migration/recovery and final live behavior remain pending
at this preparation checkpoint. Production Transaction columns require additive
migration; old code and retained schema/data must remain a recovery path. Do not
downgrade populated cash/ledger domains to roll back a screen. No security or
financial-cutover exception is approved by this record.

Sources checked25October2026: [Next release](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [lodash](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [PostCSS](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
