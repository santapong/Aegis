# 1 · Getting started in 10 minutes

You've just spun up Aegis (locally with `docker compose up` or on a hosted environment). This walkthrough takes you from a fresh account to a usable dashboard.

## 0 · Before you start

You need:

- The frontend URL (e.g. `http://localhost:3000` or your deployed domain).
- The backend reachable at the same origin under `/api/*`, or at the URL you set in `NEXT_PUBLIC_API_URL`.
- Five minutes of attention.

If you also want AI insights or Google sign-in, see the matching tutorials — those are optional.

## 1 · Register your first account (1 minute)

Open the frontend in your browser. The unauthenticated landing page shows a marketing splash and two links: **Sign in** and **Create account**. Click **Create account**.

Fields:

- **Email** — any format, but use a real address since password reset uses it (when that flow ships).
- **Username** — 3–100 characters, lowercase letters / digits / `.`, `_`, `-`. Doesn't have to match your email prefix.
- **Password** — minimum 8 characters. There's no max-strength meter yet; pick something a password manager would generate.

You're auto-logged in after register; expect to land on the empty dashboard. If Google sign-in is configured for your deployment, the button above the form does the same thing — see tutorial 5.

## 2 · Pick a theme (30 seconds)

Open **Settings → Appearance**. Three themes ship by default:

- **Observatory** — restrained terminal monochrome, no glow. Best for long focused sessions; least battery on OLED.
- **Constellation** — gold-on-midnight editorial layout, corner-marker cards, star-chart backdrop. The "default desktop" look.
- **Supernova** — animated black hole + accretion disk in the corner, warm amber accent, italic serif. Use it when you want the dashboard to feel like a status console.

The choice persists per user (synced to the backend) and applies instantly.

## 3 · Add your first transaction (2 minutes)

Click **Transactions** in the sidebar (or press `⌘2`). The page opens on an empty table.

Click **+ Add transaction**. Required fields:

- **Date** — defaults to today.
- **Amount** — positive number; the *type* radio determines sign.
- **Type** — *income* or *expense*.
- **Category** — free text; pick something you'll re-use ("groceries", "rent", "salary"). Categories aren't a separate entity in Aegis — they're just strings on transactions, so you can rename or merge by editing the underlying rows.
- **Description** — optional. Useful for distinguishing within a category.

Optional fields:

- **Tags** — separate concept from category. Use them for cross-cutting labels: a transaction can be category=`groceries` but tagged `family-visit` to roll up trip costs.
- **Trip** — link to a trip entity if you've created one (see tutorial 4).
- **Recurrence** — if this happens on a schedule (monthly rent, weekly streaming), set it once and Aegis projects the future occurrences without you re-entering them.

Save. The dashboard's KPIs and charts re-fetch automatically.

## 4 · Set a budget (2 minutes)

Click **Budgets** in the sidebar (`⌘4`). Budgets are per-category caps over a date window.

Add a budget. Required:

- **Category** — must match the string you use on transactions (case-sensitive).
- **Amount** — your cap in your default currency.
- **Period** — start + end date. Common patterns: a calendar month, a quarter, a year.

After saving, the budget shows a progress bar on its card. Live spending against it updates every time you add a transaction in that category within the window.

Cross a budget threshold and Aegis writes a notification row visible in the bell icon top-right. The threshold percentage and notification fan-out are configurable in code (`backend/app/services/notification_service.py`) but the defaults — 75 % warning, 90 % critical, 100 % over-budget — work for most users.

## 5 · Read the dashboard (2 minutes)

Click the **Aegis** mark in the top-left or press `⌘1`. The dashboard groups four things:

- **KPI cards** — top of the page. Net cash flow this month, spending vs budget, savings progress, an AI health score (if AI is enabled).
- **Charts** — middle. Cash-flow forecast (next 6 months), spending by category, recent transaction sparkline.
- **Anomaly list** — auto-detected unusual transactions (≥ 2× the rolling category median). Each card has a "why" line. Top 5 only.
- **Recent transactions** — last 10, with quick-edit affordances.

The cash-flow forecast is *naive* — it extrapolates from recurrence rules + the average of your last 90 days for ad-hoc transactions. Don't treat it as a financial plan; treat it as a "are my recurring expenses going to overrun my recurring income" check.

## 6 · Pick what to do next

You now have a working baseline. Common next steps:

- **Got historical data?** Run tutorial 2 to bulk-import a year of transactions from a CSV. Aegis figures out column mapping itself; you preview and confirm.
- **Want AI insights?** Make sure your operator has wired `ANTHROPIC_API_KEY` (or Typhoon / Groq) in the backend, then check the AI panel — `⌘\` opens it. Tutorial 3 covers what to ask.
- **Planning a trip?** Tutorial 4 walks through the Trips entity, which lets you scope budgets and transactions to a single event.
- **Bigger goal in mind?** Plans (`⌘P`) are date-ranged objectives with progress, optional parent/child hierarchy, and an automatic Gantt view. Pick a milestone (e.g. "$10k emergency fund by end of year"), create a plan with a start and target date, and the gantt page (`⇧G`) gives you a timeline view.

## Keyboard shortcuts cheat sheet

| Key | Action |
|---|---|
| `⌘1` | Dashboard |
| `⌘2` | Transactions |
| `⌘3` | Reports |
| `⌘4` | Budgets |
| `⌘5` | Savings |
| `⌘6` | Investments |
| `⌘7` | Debts |
| `⌘8` | Payments |
| `⇧C` | Calendar |
| `⇧G` | Gantt |
| `⇧T` | Trips |
| `⇧P` | Plans |
| `⇧W` | Welcome / onboarding |
| `⇧/` | Docs |
| `⌘,` | Settings |
| `⌘K` | Command palette |
| `⌘\` | AI panel |

Mac shows `⌘`, Linux/Windows shows `Ctrl`. Both work.
