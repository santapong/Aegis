# Scoped integration risk record

Decision scope: merge into develop, not a public release or production financial cutover.
Candidate: sanitized LINE backend + Horizon frontend + budget proxy/load-state repair;
source hashes are in tested-source-manifest.json. Synthetic isolated ARM64 test runtime.

| ID | Evidence / consequence | Response / owner / next check |
| --- | --- | --- |
| A1 | Browser-facing budget collection escaped origin through conflicting slash redirects; real product failure | The first skipTrailingSlashRedirect-only repair failed the unchanged Robot case: the wildcard rewrite still dropped the final slash. Preserve both Next normalization and the explicit slash-bearing rewrite; run the bounded Robot frontend round trip and real browser budget review. Current primary owns integration repair. |
| A2 | Setup challenge is a bearer capability with a longer24h default; leaked unused code could link the wrong identity |32random bytes, stored hash, single use, renewal invalidation, owner-private QR, no-store response; prior Robot checks cover expiry/renewal/cross-actor/replay. This grants no posting authority; financial confirmation remains separate. No handset/provider test this run. |
| A3 | Exact money and reviewed budget currency must remain owner-scoped and race-safe | Prior64 selected tests include actual PostgreSQL stale-facts contention; unchanged backend app hashes retained in source-comparison.json. New Robot runs use genuine PostgreSQL. No MySQL certification or independent financial acceptance. |
| A4 | Next runtime15.5.12 matches upstream affected range for GHSA-2464-fhr4-w9xw (published2026-10-14; checked2026-10-25), critical Image Optimization upstream-library issue on glibc | Record as a pre-existing release concern. Upstream fixes15.5.28/16.4.1 or sharp>=0.35.5. Runtime probe found sharp0.34.5 on the glibc-based test image, below the advisory workaround0.35.5. Internet-facing optimizer prerequisites and deployment image still need investigation. No next/image imports or custom image allow-list found in current source; this is not proof the framework endpoint is unreachable. Current work does not upgrade the runtime or approve an exception. Product owner must assign remediation before release. |
| A5 | No comprehensive current dependency/container/security scan or independent review for this combined candidate | Insufficient evidence for a release/security recommendation. Bounded exact-pattern source check retained; it is not a full secret scan. CI and full release review remain separate. No paid scanner, active attack or production scan run. |
| A6 | Historical dashboard currency/chart vocabulary finding, plus unverified full mobile matrix | Retained from prior Robot report. Development integration does not represent full dashboard financial acceptance or release approval. Follow-up owner unassigned. |

The similarly named next/og advisory GHSA-vcvr-r3jv-pc5j affects16.2.0–16.3.5, outside this runtime; source has no ImageResponse import. The image-SSRF advisory GHSA-cjq9-62q9-8jv4 lists16.x and requires allowed remote URLs; no image remotePatterns are configured. These checked counterexamples do not clear other advisories.

Sources: [Next slash flag](https://nextjs.org/docs/14/app/building-your-application/routing/middleware), [Image Optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [next/og advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), [SSRF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4).

No CVSS-to-local-risk arithmetic, zero-CVE claim or automatic risk exception is made.
Existing LINE pilot/workflows remain paused; no activation, live messaging or deployment.
