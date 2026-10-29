# Public UX acceptance with Robot Framework

This suite executes 13 public visitor journeys in Chromium using Robot Framework
7.5 and the local `AegisUX.py` keyword library. The library uses Python Playwright
1.62.0; it does not require Robot Framework Browser or its Node bridge.

The cases cover the current Union identity, personal/business examples, mobile
navigation, keyboard entry, documentation search and recovery, form state,
password visibility, client-side validation, protected-link destinations, and
light/dark layouts at 320 px. Search checks include separate words, their order,
capitalization, whitespace, section titles and category filtering.

Use an isolated Python environment with `requirements.txt` and a compatible
Playwright Chromium executable. Follow the host's resource/admission procedures
before installation, builds or browser execution. One browser, one worker and a
finite whole-process-group lifetime are required; Robot's per-test timeout alone
does not limit browser children or resource use.

From this directory, with an owned preview already running:

```sh
export AEGIS_UX_CHROMIUM=/absolute/path/to/matching/chromium
python -m robot --outputdir /absolute/path/to/fresh-results \
  --variable ORIGIN:http://127.0.0.1:3139 \
  --variable EVIDENCE:/absolute/path/to/fresh-results/screenshots \
  public_ux.robot
```

Do not reuse a personal browser profile or real account. All non-read network
methods are blocked and fail the case if attempted. The signup case deliberately
uses mismatching synthetic passwords and must fail validation before a request.
Demo expense changes are fictional browser state. Never remove the write guard
to make a case pass against a live site.

Inspect actual `output.xml`, `log.html`, `report.html`, case screenshots and
`browser-observations.json`. Preserve failures before revising a locator or
product code. A dry run checks structure only. The suite does not establish real
sign-in, financial persistence, backend authorization, full accessibility,
cross-browser compatibility or usability with representative people. Pair it
with visual inspection and separately scoped authenticated acceptance.

The dated review in `docs/validation/2026-10-29-ux-robot/` records the initial
live-site failures, their diagnosis and the matching updated-build results.
