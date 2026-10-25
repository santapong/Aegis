# Three landing directions

2026-09-28. Proposed directions for owner review, not approved identity changes. See `index.html` for responsive composition studies and `01-structure.md` for the question-led content architecture. The existing application landing is unchanged by this exploration.

## A — Aegis Meridian: a month, connected (recommended)

**Organizing idea:** money has dates. Show how salary, a bill and a goal fit into the same month. Aegis's calendar and longer-term plans become the main explanation, rather than another balance dashboard.

**Hero copy:** “Know what's coming. Plan what matters.” Supporting copy: “Bring income, expenses and future plans into one financial calendar.” Primary action: Create an account. Secondary: Explore a sample month.

**Identity:** retain Aegis's existing icon, Meridian near-black `#0A0C0E`, warm foreground `#EDE7DC`, amber `#E8913C` and teal `#2E6B72`. Teal works as a surface/line accent; use light foreground for legible text. Retain Syne display and Inter interface roles in implementation. Board previews use system fallbacks, not redistributed fonts.

**Composition:** asymmetric headline and a large week/month planner, with the next story already entering the first scroll. Thin amber date markers and restrained teal surfaces; avoid glossy generic finance cards. On mobile: headline → short sample agenda → expanded calendar, rather than shrinking a desktop grid into illegibility.

**Page sequence:** promise with sample calendar → inspect three dated events → Record / Arrange / Review with focused product crops → connect one contribution to a longer savings or trip plan → optional insights in context → ownership + FAQs + registration.

**Signature interaction:** choose a sample event; its date, amount and purpose update together. In a full implementation, Calendar / Timeline would present the same scenario. The board implements event selection only; these are concept data, not an actual account.

**Sample:** 25 September income ฿65,000; 28 September rent ฿18,000; 30 September planned savings contribution ฿3,000. No complete-balance claim: other spending is not represented. “Recorded” and “planned” must stay distinct. The contribution is a plan, not an automatic transfer.

**References:** Sunsama for a visible planner and routine, Daybridge for date-based visual language, Lunch Money for job grouping, Actual for practical ownership.

**Why recommend it:** preserves the most existing Aegis identity, gives the calendar/Gantt capabilities a clear role and can be explained without expensive effects. **Tradeoff:** the sample must be focused enough to read on a phone; rendering the entire app would dilute it.

## B — Financial Observatory: the whole picture in view

**Organizing idea:** move from a broad view to three useful horizons: Now, Next and Later. Make financial context feel organized and precise.

**Hero copy:** “Your whole financial picture. In view.” Supporting copy: “See today's records, upcoming commitments and longer plans together.” Actions: Create an account / Explore the picture.

**Identity:** explicitly DravenIQ-inspired Void `#060A12`, Silver `#DCE7F4`, Cyan `#26D9F2`, Blue `#0067DF`; preserve the unchanged Aegis icon and name. No DravenIQ dragon or invented Aegis mark. Syne/Inter remain Aegis typography; this is a deliberate palette departure from Meridian.

**Composition:** an expressive but bounded opening with a manufactured silver core, incomplete orbit and quiet engineered horizon. A real-looking, clearly labeled sample financial strip is attached to the explanation, not floating fictional telemetry. The scene is a brand metaphor and has no financial meaning. The HTML/SVG board is a rough composition study, not approved final 3D art.

**Page sequence:** broad promise plus Now / Next / Later evidence → three horizon chapters with enlarged product details → focused example of reviewing a month → ownership and setup → concise questions + CTA. AI belongs inside Review, not as the whole product promise.

**Signature interaction:** horizon controls update the adjacent sample and explanatory copy. No autoplay or scroll hijacking. Begin with a strong still composition; evaluate any later 3D treatment against that still before adding it.

**References:** Raycast for a strong dark focal point followed by interface evidence; Chronicle for controls attached to visible output; the supplied DravenIQ theme for material and lighting grammar.

**Why choose it:** strongest connection to the requested DravenIQ visual world. **Tradeoff:** art can overshadow personal finance, and an unfamiliar metaphor can delay comprehension. The financial evidence must stay visible in the opening.

## C — The Money Journal: make room for real life

**Organizing idea:** start with a personal priority, then reveal how a simple financial routine supports it. Visitors enter through a trip, an emergency buffer or debt planning rather than through the tool inventory.

**Hero copy:** “Make room for your real life.” Supporting copy: “The everyday money, the bigger plans, and a little more room to see them together.” Actions: Start your plan / See an example.

**Identity:** warm ivory `#F2EEE5` body with ink `#17282B`, amber/teal from Aegis, and a quiet dark header/footer. This is a proposed editorial extension, not Aegis's canonical light theme. Keep the original icon unchanged on its dark backing. Instrument Serif is already loaded in the application and could serve editorial headings; Inter stays the interface font. The offline board uses Georgia as an explicit serif approximation.

**Composition:** large editorial headline, generous margins, thin ledger rules, chapter numbers and a paper-like plan. Each chapter pairs the life purpose with the product detail that supports it. Use typography and the planner itself initially; photography is optional only if a selected treatment needs it.

**Page sequence:** choose a familiar goal → read a small illustrative plan → show the monthly routine and product → broader capabilities as short chapters → optional assistance → practical ownership and FAQ → return to the visitor's chosen goal at the final CTA.

**Signature interaction:** choose Trip / Buffer / Debt to change the adjacent illustrative plan. It demonstrates different uses without implying automated advice, payments or guaranteed outcomes. On mobile it becomes a short story followed by a readable ledger.

**References:** YNAB for a familiar concern before features; Wealthfront for life-context organization; Sunsama for the routine connecting an intention to the interface. Mercury's product/demo path supports keeping an obvious route into evidence, not a claim about its uncaptured visual style.

**Why choose it:** most approachable and editorial, with the largest visual contrast from the initial dark draft. **Tradeoff:** it introduces a new brand expression and could make the calendar feel secondary unless the product appears promptly.

## Selection recommendation

Choose **A** for Aegis's main landing: its own identity plus a clear story about money across time. Choose **B** if connection to DravenIQ's visual world is the priority. Choose **C** if the intended audience should first feel a familiar personal-finance story.

Do not blend all three into one page. After a direction is selected, refine its opening and first scroll together, then implement the complete sequence with actual product captures and working routes. The board contains composition studies and bounded sample interactions; it is not a finished replacement landing or a conversion-tested result.
