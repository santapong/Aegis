# 2 · Importing a year of transactions from your bank

The fastest way to give Aegis a useful dataset is to import a CSV export from your bank or card issuer. Aegis auto-detects the column layout — you don't have to reformat anything.

## What works out of the box

Aegis recognizes these column names (case-insensitive, whitespace-tolerant):

| Field | Accepted column names |
|---|---|
| Date | `date`, `transaction date`, `trans date` |
| Description | `description`, `memo`, `note`, `details`, `narrative` |
| Amount | `amount`, `value`, `sum`, `total` |
| Type | `type`, `transaction type`, `dr/cr` |
| Category | `category`, `tag`, `label` |

If the file has no single `amount` column, Aegis falls back to detecting **debit/withdrawal** and **credit/deposit** columns and combining them. This handles most US/EU bank exports out of the box (Chase, Capital One, HSBC, Revolut, Wise, Monzo).

If a row has neither `amount` nor a debit/credit pair, it's silently skipped — see the *Troubleshooting* section below.

## 1 · Get the CSV from your bank

The standard route in most US banks:

1. Log into online banking → **Activity** or **Statements**.
2. Choose **Export** → **CSV** → date range (Aegis caps imports at 5 MB, which is roughly 30 000 rows; if you need more, do it in batches).
3. Save the file somewhere you can find it.

European banks: same flow, often called **Download** or **Export account history**. Revolut and Wise let you pick a date range with a granular picker.

If your bank only offers OFX, QIF, or PDF: open the file in a spreadsheet app (LibreOffice opens OFX directly) and re-export as CSV.

## 2 · Preview the import

In Aegis, go to **Transactions** (`⌘2`) and click **Import CSV**.

1. **Select the file**. Aegis enforces a 5 MB cap and rejects non-CSV mimetypes immediately.
2. The preview shows what Aegis *thinks* every row will become: parsed date, description, amount, type, category. **It does not save anything yet.**
3. Scan the first 10–20 rows. Common things to check:
   - Date format parsed correctly? US `MM/DD/YYYY` and ISO `YYYY-MM-DD` work; some European formats need a one-column edit in your spreadsheet first.
   - Amounts have the right sign? Banks that put refunds in a separate "credit" column may show every transaction as an *expense* if Aegis only saw the `amount` column. Re-export with the type indicator if so.
   - Categories make sense? Most banks send `Uncategorized` or a generic merchant code. You'll probably want to bulk-recategorize after import — easier in Aegis than reformatting the CSV.

## 3 · Confirm the import

When the preview looks right, click **Import N rows**. The backend writes them in a single transaction; nothing is partially saved.

After the import:

- The dashboard's charts refresh.
- The transaction table is paginated 50 rows at a time. Click **Load 50 more** to walk through the rest.
- The category list in **Budgets** picks up any new categories — you can immediately create budgets against them.

## 4 · Clean up imported categories

After a real import, expect a long tail of one-off merchant categories. Two strategies:

1. **Bulk recategorize**: filter transactions by description (the **search** in `⌘K` or the search input on the table page), select all → edit → set a sensible category like `groceries`. Repeat for the top 5 vendors and you've covered ~60 % of the rows.
2. **Tag rather than categorize**: keep the bank's category, add a tag for the way *you* think about that spending. Tags don't conflict with category-based budgets and let you slice spending two ways.

## Troubleshooting

**"Failed to parse CSV file"**

The file isn't valid CSV. Open it in a spreadsheet app and save it again as CSV (UTF-8, comma-separated). Common culprits: an HTML preamble from a bank that disguises an XLS as a CSV, BOM markers on Windows exports.

**"File too large. Maximum size is 5MB"**

Split the file by date range and import in chunks. Most banks let you re-export with a narrower window.

**Rows silently missing from the preview**

Aegis skips rows that can't be parsed into `amount + type`. Most common causes:

- The bank used non-standard column names not in the table above. Rename the column in your spreadsheet (`Cantidad` → `Amount`).
- The row has both `debit` and `credit` blank (running balances, summary rows). Delete those rows.
- A non-numeric amount like `--` or `pending`. Filter out pending transactions before exporting.

**Duplicates after re-importing**

Aegis does not currently dedupe on import. If you import the same range twice, you get two copies. Workaround: filter by date in the transactions table, sort by created_at, and bulk-delete the older copies. Server-side dedupe by `(date, amount, description)` hash is on the roadmap.

## What import does NOT do

- **No fee splitting** — a `$50 dinner` becomes a `$50 expense`, not split among multiple people. Use tags or a follow-up adjustment transaction if you owe a refund.
- **No FX rate lookup** — multi-currency rows are imported in whatever currency the CSV says. Aegis assumes one default currency per user; transactions in another currency display with their own symbol but aren't FX-converted into your default.
- **No bank reconciliation** — there's no "match this CSV to last month's import" feature. The import is one-shot.

## Going further

When you've imported a few months of history, the **AI assistant** (tutorial 3) becomes useful: ask it "show me my five biggest one-off expenses last quarter" or "which categories grew most year-over-year". The AI's view of your data is exactly the data you've imported, so the more complete the history, the better the answers.
