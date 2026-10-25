# Aegis public landing release — October 1, 2026

Observed and checked October 1, 2026, approximately 14:20–14:29 Asia/Bangkok. This is dated execution evidence; recheck the live project before updating it.

The accepted Meridian landing, interactive fictional demo, and audience-specific documentation are public at **https://draveniq-aegis-landing.vercel.app**. The Vercel deployment completed with state `READY`, target `production`, and its production alias rendered the real site without authentication. This release preserves the accepted dark identity. The light-theme proposals and chart research board were not selected or published.

## Deployment identity and scope

| Field | Value |
| --- | --- |
| Project | `draveniq-aegis-landing` |
| Project ID | `prj_T3jgEavlnM4BFHkcVyOZWLcI8kki` |
| Team | `santapongs-projects` / `team_4xUt8aSlfT696WCBgbsjtJTV` |
| Deployment | `dpl_8sXLyGvdiKBa4wezxYZ3vzo3htGn` |
| Inspector | [Vercel deployment](https://vercel.com/santapongs-projects/draveniq-aegis-landing/8sXLyGvdiKBa4wezxYZ3vzo3htGn) |
| Source branch/base | `agent/comet-asset-prompt` / `e2c4a9c68d6304799ff5bc28b9fef7cf951f3878` |
| Runtime used for build | Node 26.8.1, Next.js 15.5.12 |
| Deployment CLI | Official Vercel CLI 62.1.0, invoked through Bun |

The source includes reviewed **uncommitted** public design work. There was no Git commit or push. Source and output were frozen separately, with file hashes retained. The release package contains 74 static files (2,036,213 bytes), including 16 directory-index pages counting the exported 404 page, and zero functions. The dry run listed 76 output entries; all were under `.vercel/output/`. No backend, authentication implementation, environment files, database, or unrelated LINE work was uploaded.

The main action is **Try the demo**, allowing visitors to explore without an account. Account links use the existing app at https://aegis-eight-azure.vercel.app. The original `aegis` project was not redeployed. Its `/` and `/login` returned 200 during the initial check; `/api/health` timed out after 20 seconds. This limited observation does not establish whether the complete hosted app works. Managed-service availability remains explicitly proposed in the demo. No database, environment, credential, custom-domain, or DNS changes were made.

## Repeat the public release

First reconcile the repository state, accepted public content, installed dependency versions, current Vercel project/team IDs, and production alias. The following commands prepare fresh destinations; both helpers refuse to overwrite an existing frozen release. Replace the example destination paths for a new release.

```sh
node scripts/prepare-landing-release.mjs \
  --output /mnt/data/aegis-landing-next/source \
  --site-url https://draveniq-aegis-landing.vercel.app \
  --app-url https://aegis-eight-azure.vercel.app

ln -s /mnt/data/company/apps/Aegis/frontend/node_modules /mnt/data/aegis-landing-next/source/node_modules
```

Run the generated `package.json` build from that source directory using its pinned dependency versions. The dependency symlink above was used only for this local build; it is not uploaded. Inspect the generated public pages, import boundary, and source manifest before building. The helpers copy only the selected public page trees, replace app links, generate a public-only root layout and error boundary, and preserve the branded fonts locally with their licenses.

```sh
node scripts/package-landing-release.mjs \
  --export /mnt/data/aegis-landing-next/source/out \
  --output /mnt/data/aegis-landing-next/deploy \
  --project-id prj_T3jgEavlnM4BFHkcVyOZWLcI8kki \
  --team-id team_4xUt8aSlfT696WCBgbsjtJTV
```

From the new deploy directory, use the authenticated official CLI to review `deploy --prebuilt --prod --dry-run`, then publish with `deploy --prebuilt --prod` within the owner's current authorization. Include `--scope santapongs-projects`; recheck current CLI syntax. The Build Output API v3 routes map each exported directory to its index, serve static assets, and return a real 404 for unknown paths. The normal app build and app Vercel configuration were not changed.

Check the public production alias with ordinary HTTPS and the visible browser. Avoid `vercel curl` as an assumed read-only verifier: a previously verified CLI behavior could create a persistent protection-bypass token. The deployment-specific URL's protection setting does not prove that the production alias is private or public.

## Verified result

The optimized static build and type checks passed. All 40 frozen source entries and all 74 packaged files still matched their recorded hashes after publication. Public HTTPS checks covered 22 positive URLs: all published page routes, robots, sitemap, icon, CSV example, and all three font files. They returned 200 and matched the corresponding frozen bytes. Three negative paths (`/docs/not-a-guide`, `/api/health`, `/login`) returned 404 on this separate public site.

The deployed browser confirmed:

- The actual dark landing renders, its canonical URL is the production root, fonts are loaded, and Syne is applied to the heading.
- Calendar and Timeline switch correctly; selecting Rent persists when switching back.
- Client navigation opens the demo. Delaying the fictional client payment changes the original ฿88,000 remainder to a ฿2,000 gap with the explanation shown.
- Documentation search for CSV finds two guides; opening the transaction guide displays its correct heading and route.
- At 390 × 844, landing and docs have no horizontal overflow. The mobile menu closes with Escape and returns focus; selecting Documentation closes it and navigates correctly.
- Fresh production browser error/warning logs were empty. The viewport was reset and the live root was left open.

Local checks additionally exercised the personal story, expense-draft preservation across story changes, expense submission/reset, and 320-pixel demo/docs layouts. These local checks are distinct from the production checks above. No production account creation, financial data writes, AI calls, or chat integration was tested.

Screenshots and compact raw evidence are in [the validation folder](../validation/2026-10-01-landing-release/README.md). Complete frozen source, output, failed-build logs, and CLI logs remain at `/mnt/data/aegis-landing-release-2026-10-01/`.

## Resolved build failures and supported causes

1. The initial public extraction retained `docs/error.tsx`, which imported an excluded app UI button. Build failed with that unresolved import. A public native error boundary with retry and a docs return link removed the dependency; subsequent compilation passed.
2. Next.js 15.5.12's Google font loader failed with `Cannot read properties of null (reading '1')` while parsing font CSS. Its expected response shape did not match; the reason for that response is unknown. A separate Google CSS request returned 200, so this is not proof that Google Fonts was unreachable. Existing branded WOFF2 files were mapped through the prior generated `@font-face` CSS, retained unchanged, licensed, and loaded through `next/font/local`. Build and rendered-font checks then passed.
3. The next build compiled and passed type checking, but static export rejected `robots.txt` without a static declaration. Both generated robots and sitemap metadata routes received `dynamic = "force-static"`; the final export passed.

Reconsider these recoveries when the dependency version, font source, metadata routes, or extraction boundary changes. Do not repeat unchanged failing builds merely to confirm the same error.
