# Aegis app branding correction

Owner correction25October2026: apply the selected Union logo to Aegis and deploy the app; remove the public logo showcase. The earlier technical deployment checks did not establish owner acceptance of publishing Brand Studio.

Canonical task record: this file. One primary agent; no delegation. Existing target is Aegis/prj_AZS5jNpi2EN4DMuwmXhfpWJeYjcv in team_4xUt8aSlfT696WCBgbsjtJTV, production branchmain and public alias https://aegis-eight-azure.vercel.app.

| Deliverable | State | Acceptance |
| --- | --- | --- |
| Remove public showcase and discoverability | Verified | /brand and /brand/ lead to /landing; footer, docs index, sitemap and public robots entries no longer promote it |
| Retain product identity | Verified | shared mark, metadata/favicon and native icons retain source hashes; landing/login still show Union |
| Deploy corrected Aegis application | Verified | correct existing project, fresh commit/build, public app and health work |

Scoped risk: removing a public information route reduces exposure and changes navigation only. Exact redirects must not catch /brand/* assets used by the app. Dependency locks, backend, financial records, auth policy and database schema are unchanged. No new migration or scan is required by this frontend removal; prior scans do not prove all dependencies safe.

Verification budget: no local/Pi build or test stack. Use the existing isolated GitHub/Vercel managed builders, focused frontend type/build/session checks and one browser worker. Local metadata/HTTP clients stay at0.25CPU,128MiB,32PIDs, bounded requests/time/output. Browser/shared cloud executor hard caps are unavailable; no workstation compiler or new browser process is launched. Check old-route redirects, app branding, icon hashes, docs/sitemap discoverability and health on the actual deployment. Historical artwork/evidence remains in the repository; the public showcase page is removed. LINE pilot remains paused.

First production verification:12/13 checks passed. /brand redirected, but /brand/ returned404 despite the two configured redirect declarations. The failure is retained in first-live-checks.json. Replaced the declarations with a small exact app-route HTTP redirect, without restoring the showcase page. Both legacy URL spellings and retained assets require a fresh production check; no assertion is relaxed.

The exact Next route also left /brand/ at Vercel NOT_FOUND in the ready preview, while the app-level route remained available. Public redirects now belong to the root Services ingress (as documented by Vercel), before service selection. Both entries are exact paths and do not match /brand/* assets. Preview/live behavior remains the acceptance boundary.

## Executed outcome

Final production deployment dpl_GFPMNtyuYFXy15yqXVURvyy1ZrXy is READY for maina28bb9b with the existing canonical Aegis domain assigned.13/13 live HTTP cases passed; the browser reached /landing from /brand/, showed two Union marks, no showcase links, native favicon metadata and no horizontal overflow. Four live icon hashes match the retained source. The old public brand guide returns404; public sitemap/LLM index no longer promote the showcase. No new Vercel project, credentials, LINE activation or production financial write was created.

Full source CI40187570642 passed before the redirect repair. The final source frontend/type/client checks and cloud preview build passed; final-ci.json records the actual remaining automatic backend rerun state. Backend/dependency source is unchanged, and production health/dbok plus anonymous budgets401 passed. This is scoped branding/navigation verification, not new financial acceptance.

The first main merge did not produce an observed native deployment: public route remained unchanged, GitHub status was empty and Vercel showed the prior production source. Existing browser authentication allowed Create Deployment → main → confirmed35dcc96 → Production, without a new grant or bypass. A later fast-forward main push started the final native production build. The missing first trigger's cause is unresolved; do not claim Git integration is generally broken.

The Next-only redirect and exact app-route attempt left the slash URL at the platform404 boundary. Root Services redirects fixed both paths in preview and production. This matches public-ingress ownership in https://vercel.com/docs/services/routing. The original failed check is retained, with no weakened assertion. App assets under /brand/* were preserved throughout.

No local/Pi build or package installation ran for this correction. Local clients used the stated cgroup/deadline envelope; no test services/tunnels remain. The task-owned Vercel tab was closed and the Aegis app is left open. No viewport override was added. Historical design artifacts and earlier receipts remain historical evidence; their public-showcase acceptance inference is superseded by the owner's correction.
