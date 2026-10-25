# Aegis app branding correction

Owner correction25October2026: apply the selected Union logo to Aegis and deploy the app; remove the public logo showcase. The earlier technical deployment checks did not establish owner acceptance of publishing Brand Studio.

Canonical task record: this file. One primary agent; no delegation. Existing target is Aegis/prj_AZS5jNpi2EN4DMuwmXhfpWJeYjcv in team_4xUt8aSlfT696WCBgbsjtJTV, production branchmain and public alias https://aegis-eight-azure.vercel.app.

| Deliverable | State | Acceptance |
| --- | --- | --- |
| Remove public showcase and discoverability | Implemented; cloud verification pending | /brand and /brand/ lead to /landing; footer, docs index, sitemap and public robots entries no longer promote it |
| Retain product identity | Source unchanged; live checks pending | shared mark, metadata/favicon and native icons retain source hashes; landing/login still show Union |
| Deploy corrected Aegis application | Pending | correct existing project, fresh commit/build, public app and health work |

Scoped risk: removing a public information route reduces exposure and changes navigation only. Exact redirects must not catch /brand/* assets used by the app. Dependency locks, backend, financial records, auth policy and database schema are unchanged. No new migration or scan is required by this frontend removal; prior scans do not prove all dependencies safe.

Verification budget: no local/Pi build or test stack. Use the existing isolated GitHub/Vercel managed builders, focused frontend type/build/session checks and one browser worker. Local metadata/HTTP clients stay at0.25CPU,128MiB,32PIDs, bounded requests/time/output. Browser/shared cloud executor hard caps are unavailable; no workstation compiler or new browser process is launched. Check old-route redirects, app branding, icon hashes, docs/sitemap discoverability and health on the actual deployment. Historical artwork/evidence remains in the repository; the public showcase page is removed. LINE pilot remains paused.

First production verification:12/13 checks passed. /brand redirected, but /brand/ returned404 despite the two configured redirect declarations. The failure is retained in first-live-checks.json. Replaced the declarations with a small exact app-route HTTP redirect, without restoring the showcase page. Both legacy URL spellings and retained assets require a fresh production check; no assertion is relaxed.

The exact Next route also left /brand/ at Vercel NOT_FOUND in the ready preview, while the app-level route remained available. Public redirects now belong to the root Services ingress (as documented by Vercel), before service selection. Both entries are exact paths and do not match /brand/* assets. Preview/live behavior remains the acceptance boundary.
