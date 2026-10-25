import Link from "next/link";
import { additionalContent } from "./extended-content";
import { CodeBlock } from "./docs-controls";
import {
  DocSection as Section,
  FieldTable,
  Notice,
  Result,
  SourceLink,
} from "./docs-components";
import s from "./docs.module.css";

const originalContent: Record<string, React.ReactNode> = {
  "cash-planning": (
    <>
      <Section id="setup" title="Start with checked cash">
        <Notice title="Available on installations with the cash-workspace pilot enabled.">
          This guide describes cash planning through the M2 owner pilot. The
          separately hosted landing and its fictional demo do not store account
          balances. Your installation administrator enables the feature after
          migrating and backing up its database.
        </Notice>
        <ol>
          <li>
            Sign in and open <Link href="/cashflow">Cash planning</Link>. Choose{" "}
            <strong>New workspace</strong>, a personal or business workspace,
            and THB or USD. Each workspace keeps one currency.
          </li>
          <li>
            Select <strong>Add cash account</strong>. Name a bank account or
            cash you hold; this is a manual record, with no bank connection.
          </li>
          <li>
            In <strong>Review opening cash</strong>, enter a checked
            start-of-day amount, its date, and where you checked it. Include
            money that moved on that date using <strong>Record money</strong>.
          </li>
        </ol>
        <Result>
          The overview shows cash from the checked opening amount plus recorded
          money since that date. Without an opening amount, Aegis asks for it
          and leaves cash unknown.
        </Result>
        <p>
          Keep personal and business accounts in their own workspaces. To record
          money already moved between your accounts, use{" "}
          <strong>Accounts → Record transfer</strong>. A shared reference
          connects both workspaces; this action does not send money.
        </p>
      </Section>
      <Section id="dates" title="Read the dates and compare a change">
        <p>
          Choose <strong>Add upcoming money</strong> for an expected receipt or
          cost. Its expected cash date controls the forecast; a contractual due
          date is a separate reminder. One-time, weekly, two-week, monthly,
          quarterly, yearly and split-date plans never post themselves as
          payments. Set an interval to skip periods; split amounts apply to each
          entered month day.
        </p>
        <p>
          The overview, daily source table and <strong>Money calendar</strong>{" "}
          use the same end-of-day amounts. <strong>Lowest cash</strong> can
          reveal a shortage even when the closing amount is positive. A buffer
          reduces headroom without removing money from an account.
        </p>
        <FieldTable
          rows={[
            ["Fictional personal cash", "47,000 THB"],
            ["Laptop scenario", "45,000 THB on October 12, 2026"],
            ["Lowest cash", "−500 THB on October 16"],
            ["October closing cash", "3,900 THB"],
          ]}
        />
        <p>
          Use <strong>Compare a change</strong> to save a different expected
          date or extra cost. The comparison uses the same starting cash and
          preserves the base records. Items moved beyond{" "}
          <strong>Plan through</strong> remain under{" "}
          <strong>Outside the visible plan</strong>. If the base changes, review
          it and choose <strong>Refresh comparison</strong>.
        </p>
        <Notice title="Expected money is an assumption.">
          Daily closing amounts do not guarantee that a receipt arrives before a
          bill on the same day. Missing balances, unassigned records and unpaid
          past commitments produce review warnings.
        </Notice>
      </Section>
      <Section id="matching" title="Record and match once">
        <ol>
          <li>
            Use <strong>Record money</strong> when the payment has actually
            happened, with the correct account and actual date.
          </li>
          <li>
            Open <strong>Review &amp; match → Match a payment</strong>. Select
            the recorded payment, its unpaid commitment and the amount to
            allocate. Account, currency and direction must agree.
          </li>
          <li>
            Select <strong>Preview match</strong>. Check the remaining amount
            before and after; the cash effect is zero because the payment
            already affects cash. Then select <strong>Confirm match</strong>.
          </li>
        </ol>
        <Result>
          For a 1,200 THB utilities payment, recorded cash falls once and the
          planned utilities amount becomes zero. A partial payment leaves only
          the unpaid remainder in the forecast.
        </Result>
        <p>
          <strong>Undo match</strong> restores the planned remainder without
          changing cash. For an entry made by mistake, unmatch it first and use{" "}
          <strong>Reverse record</strong>; Aegis keeps the original and an
          opposite correction on its original date. An actual refund on a later
          date is a separate recorded movement.
        </p>
      </Section>
      <Section
        id="everyday-review"
        title="Import, reserve, and review everyday cash"
      >
        <ol>
          <li>
            In <strong>Review &amp; match</strong>, choose an account, load a
            UTF-8 CSV or paste its contents, and confirm the currency. Select{" "}
            <strong>Save review batch</strong>. This saves the review without
            recording cash.
          </li>
          <li>
            Check valid rows, possible duplicates, and optional payment matches.
            Select the rows you want, then{" "}
            <strong>Review selected rows → Confirm selected rows</strong>. The
            server uses the saved batch. A retry cannot record a confirmed row
            twice.
          </li>
          <li>
            Open <strong>Upcoming plans</strong> to review an unpaid or overdue
            payment. Change its expected date, full amount, or cancellation
            without replacing its identity. Use{" "}
            <strong>Extend reviewed horizon</strong> for more recurring dates;
            existing edits and matches stay intact.
          </li>
          <li>
            In <strong>Goals &amp; installments</strong>, reserve cash for a
            purpose or link an existing recorded transfer. A reservation reduces
            headroom and leaves account cash unchanged. A transfer link records
            no additional movement.
          </li>
          <li>
            Use <strong>Enter an installment schedule</strong> for known dates
            and amounts. An optional existing debt link requires your currency
            confirmation; it does not calculate interest or update principal.
          </li>
        </ol>
        <p>
          CSV columns are <code>date,description,amount,type,currency</code>,
          with optional <code>reference,category</code>. Use YYYY-MM-DD dates,
          positive amounts with at most two decimals, and income or expense.
          Each batch covers one account and currency, up to 500 rows and 256
          KiB. Correct invalid rows in a new file. Identical details are a
          review hint; check before marking a row as distinct.
        </p>
        <p>
          <strong>Cash alerts</strong> on the overview explain negative cash,
          buffer gaps, reservation gaps, and incomplete inputs for the base
          plan’s dates and included accounts. Open{" "}
          <strong>Why this alert appeared</strong> to see its sources.{" "}
          <strong>Mark reviewed</strong> acknowledges the alert; changing its
          financial inputs resolves it when the condition ends. Alerts stay
          inside Aegis.
        </p>
        <Result>
          For a 10,000 THB reservation, account cash remains 47,000 THB. Mina’s
          closing headroom falls from 43,900 to 33,900 THB. Releasing the
          reservation restores headroom without recording income.
        </Result>
      </Section>
      <Section id="older-records" title="Review older records">
        <p>
          Older transactions start in <strong>Unassigned records</strong>. Their
          old currency preference is not proof of currency or account. Under{" "}
          <strong>Accounts → Review and assign</strong>, select reviewed records
          and explicitly confirm their account and currency. IDs and plan/trip
          links are preserved; no currency conversion happens.
        </p>
        <p>
          If reviewed records belong outside a workspace, choose{" "}
          <strong>Review exclusion</strong>. They remain unassigned and a new or
          edited record requires review again. Legacy dashboard, reports,
          budgets and exports use unassigned records; use Cash planning for
          account-scoped balances.
        </p>
        <p>
          These are cash-planning workspaces for one owner. Invoice issuance,
          payroll, tax, bank feeds and chat capture into a workspace are later
          releases. Unsaved forms remain while changing views in this session;
          saved balances, commitments and scenarios, saved CSV reviews,
          allocations and entered installments survive reload.
        </p>
      </Section>
    </>
  ),
  "first-steps": (
    <>
      <Section id="before-you-start" title="Before you start">
        <p>
          You need an account on a running Aegis installation.{" "}
          <Link href="/login">Sign in</Link>, or{" "}
          <Link href="/register">create an account</Link> if you do not have
          one. If you are setting up Aegis itself, use the{" "}
          <Link href="/docs/developers/local-setup">
            local installation guide
          </Link>
          .
        </p>
        <p>
          A <strong>transaction</strong> is a record of money received or spent.
          A <strong>category</strong> is a label that groups similar records,
          such as Housing or Food.
        </p>
        <Notice title="Use a real expense when working in your own account.">
          The rent values below are an example. Saving them will add a record to
          that account; this guide does not create a separate practice space.
        </Notice>
      </Section>
      <Section id="add-an-expense" title="Add your expense">
        <ol>
          <li>
            Open <strong>Unassigned records</strong> from the app navigation. On
            a small screen, open the app menu first.
          </li>
          <li>
            Select <strong>Add Transaction</strong>.
          </li>
          <li>
            Fill in the fields. Enter a positive amount and choose Expense to
            say that the money was spent.
          </li>
        </ol>
        <FieldTable
          rows={[
            ["Amount", "18000"],
            ["Type", "Expense"],
            ["Category", "Housing"],
            ["Date", "The day you paid the rent"],
            ["Description (optional)", "Rent"],
          ]}
        />
        <p>
          Leave recurring settings, tags and trip options alone for this first
          record. Select <strong>Create</strong> once.
        </p>
        <Result>
          The form closes and a rent expense appears in Unassigned records. Its
          amount, date and category should match what you entered.
        </Result>
      </Section>
      <Section id="check-your-record" title="Check the result">
        <p>
          Find the record in the transaction list. If you need to correct it,
          open its actions menu, choose <strong>Edit</strong>, change the
          fields, then select <strong>Save Changes</strong>.
        </p>
        <details>
          <summary>I saved it, but I can&apos;t find it.</summary>
          <p>
            Check the type, category and date filters on Transactions. A saved
            record may be outside the range you are viewing. If saving showed an
            error, correct that error before trying again.
          </p>
        </details>
        <details>
          <summary>Why doesn&apos;t it appear on my calendar?</summary>
          <p>
            Calendar displays plans you create for future or dated intentions. A
            transaction records what happened.{" "}
            <Link href="/docs/guides/plans">Create a plan separately</Link> when
            you want to schedule something.
          </p>
        </details>
      </Section>
      <Section id="next-step" title="What to do next">
        <p>
          You have the basic routine: enter a record, then check it. Next,{" "}
          <Link href="/docs/guides/budgets#create-budget">
            set a Housing budget
          </Link>{" "}
          to compare that spending with a limit, or{" "}
          <Link href="/docs/guides/transactions#prepare-csv">
            import more records from a spreadsheet
          </Link>
          .
        </p>
      </Section>
    </>
  ),
  transactions: (
    <>
      <Section id="add-one" title="Add one record">
        <p>
          Open <strong>Transactions → Add Transaction</strong>. Enter a positive
          Amount, choose Income or Expense, and provide a Category and Date. Add
          an optional description and select Create.
        </p>
        <p>
          Use the same category name for similar expenses. For example, use{" "}
          <strong>Housing</strong> for rent each month instead of alternating
          between Housing and Rent.
        </p>
        <p>
          New to the form? Follow{" "}
          <Link href="/docs/guides/first-steps">Record your first expense</Link>{" "}
          for a complete example.
        </p>
      </Section>
      <Section id="prepare-csv" title="Prepare a CSV">
        <p>
          A CSV is a spreadsheet saved as plain text, with one record per row.
          Start with these column names and use dates in{" "}
          <strong>YYYY-MM-DD</strong> format.
        </p>
        <CodeBlock
          label="Example CSV · two fictional records"
          code={`date,description,amount,type,category
2026-09-28,Rent,18000,expense,Housing
2026-09-25,Salary,65000,income,Salary`}
        />
        <a
          href="/docs/example-transactions.csv"
          download
          className={s.actionLink}
        >
          Download the example CSV
        </a>
        <p>
          Replace the example rows with your own records before importing into
          your account. Keep the <code>type</code> column explicit: use{" "}
          <code>income</code> for money received and <code>expense</code> for
          money spent.
        </p>
        <Notice title="Check the type before confirming.">
          Without a type column, a positive amount is interpreted as income and
          a negative amount as expense. A bank file that stores all amounts as
          positive needs an explicit type column, or separate debit and credit
          columns.
        </Notice>
      </Section>
      <Section id="review-import" title="Review and import">
        <ol>
          <li>
            In Transactions, select <strong>Import CSV</strong> and choose your
            file. It must be a CSV of at most 5 MB.
          </li>
          <li>
            In <strong>Import Transactions</strong>, compare the valid-row count
            with the number you expected. The preview shows the first 20
            records.
          </li>
          <li>
            Check the dates, types, amounts and categories. Select Cancel if
            they need correction, edit the file, and upload it again.
          </li>
          <li>
            Select <strong>Import … Transactions</strong> to save the parsed
            rows.
          </li>
        </ol>
        <Result>
          The import reports how many records were imported or skipped. Look up
          the imported dates in Transactions and check a few rows against the
          file.
        </Result>
      </Section>
      <Section id="import-help" title="Fix common problems">
        <details>
          <summary>Some rows are missing from the preview.</summary>
          <p>
            Check that your headers match the example and that every amount is a
            number. Remove summary lines or “pending” text from the amount
            column. The importer skips rows it cannot parse.
          </p>
        </details>
        <details>
          <summary>My dates look wrong or rows were skipped.</summary>
          <p>
            Convert the date column to YYYY-MM-DD. A missing date can fall back
            to today; a date that cannot be parsed during confirmation can be
            skipped. Correct the file before confirming.
          </p>
        </details>
        <details>
          <summary>Can I import the same file again?</summary>
          <p>
            Import does not automatically remove duplicates. Re-importing the
            same records can add a second copy. Check the records already in
            Transactions before importing an overlapping date range.
          </p>
        </details>
      </Section>
    </>
  ),
  budgets: (
    <>
      <Section id="choose-tool" title="Choose the right tool">
        <div className={s.conceptGrid}>
          <div>
            <span>BUDGET</span>
            <h3>“Keep Housing within ฿20,000.”</h3>
            <p>
              A spending limit for a category and period. Recorded expenses are
              compared with the limit.
            </p>
          </div>
          <div>
            <span>SAVINGS GOAL</span>
            <h3>“Build a ฿90,000 emergency fund.”</h3>
            <p>A target amount with contributions you record as you save.</p>
          </div>
        </div>
      </Section>
      <Section id="create-budget" title="Set a spending budget">
        <ol>
          <li>
            Open <strong>Budgets → Add Budget</strong>.
          </li>
          <li>
            Name the budget and enter a limit. Use the same category spelling as
            the transactions you want to include.
          </li>
          <li>
            Choose a start and end date, then select <strong>Create</strong>.
          </li>
        </ol>
        <FieldTable
          rows={[
            ["Budget Name", "Monthly housing"],
            ["Amount", "20000"],
            ["Category", "Housing"],
            ["Start Date", "First day of this month"],
            ["End Date", "Last day of this month"],
          ]}
        />
        <Result>
          The budget appears in Active Budgets. In the current month-to-date
          comparison, a single Housing expense of ฿18,000 against this ฿20,000
          budget leaves ฿2,000.
        </Result>
        <p>
          The comparison currently uses this month through today. It includes
          budgets overlapping that period and totals recorded expenses by
          category. A future plan does not count as spending.
        </p>
      </Section>
      <Section id="savings-goal" title="Track a savings goal">
        <p>
          Open <strong>Savings</strong> in the app navigation to reach Savings
          Goals, then create a new goal. Give it a Goal Name and Target Amount.
          Current Amount is what you have already saved; the deadline is
          optional.
        </p>
        <p>
          For an emergency fund, you might set a target of ฿90,000 and a current
          amount of ฿45,000. When you save more, select{" "}
          <strong>Add Contribution</strong> on that goal and enter the amount.
        </p>
        <Result>
          After recording another ฿3,000 contribution, the example goal has
          ฿48,000 saved. Recording a contribution updates your goal; Aegis does
          not transfer money.
        </Result>
      </Section>
      <Section id="budget-help" title="When numbers look wrong">
        <details>
          <summary>My budget shows less spending than expected.</summary>
          <p>
            Check that the transaction type is Expense, the category matches
            exactly, and the transaction is within the comparison period. A plan
            or savings contribution is separate from an expense transaction.
          </p>
        </details>
        <details>
          <summary>Two budgets for the same category look duplicated.</summary>
          <p>
            The comparison is grouped by category. Multiple budgets for that
            category overlapping the comparison period can each show the same
            category spending. Review overlapping budget periods before
            interpreting the combined totals.
          </p>
        </details>
        <details>
          <summary>Will a savings plan automatically update my goal?</summary>
          <p>
            No. A savings plan records your intention and dates. Record the
            contribution in Savings Goals when it happens.
          </p>
        </details>
      </Section>
    </>
  ),
  plans: (
    <>
      <Section id="plan-or-transaction" title="Plan or transaction?">
        <div className={s.conceptGrid}>
          <div>
            <span>TRANSACTION</span>
            <h3>“I paid ฿18,000 in rent.”</h3>
            <p>
              Records an expense that happened. It contributes to spending
              reports and budget comparisons.
            </p>
          </div>
          <div>
            <span>PLAN</span>
            <h3>“I intend to save ฿3,000.”</h3>
            <p>
              Gives an intention a date and status. It appears in Calendar and
              Gantt.
            </p>
          </div>
        </div>
        <p>
          You can have a plan and a transaction for the same real-world event.
          They are separate records with different jobs.
        </p>
      </Section>
      <Section id="create-plan" title="Create a dated plan">
        <ol>
          <li>
            Open <strong>Plans &amp; Goals</strong> and select{" "}
            <strong>Create Plan</strong>.
          </li>
          <li>
            Enter a title, category, amount and start date. Add an end date if
            the plan spans a period.
          </li>
          <li>
            Select <strong>Create Plan</strong> to save it.
          </li>
        </ol>
        <FieldTable
          rows={[
            ["Title", "Emergency fund contribution"],
            ["Category", "Savings"],
            ["Amount", "3000"],
            ["Start Date", "The day you intend to contribute"],
            ["End Date", "Optional; use the same day for a one-day plan"],
          ]}
        />
        <Result>
          Your plan appears in the plan list. Open Calendar and navigate to its
          date, or open Gantt to see its place on the timeline.
        </Result>
      </Section>
      <Section id="review-plan" title="Find and update it">
        <p>
          Update dates or details from the plan&apos;s Edit action. Use its
          progress control to record how far along it is; reaching 100% marks
          the plan completed.
        </p>
        <Notice title="Completed describes the plan’s status.">
          It does not make a payment, create a transaction, or add money to a
          savings goal. Record the expense or contribution separately when it
          happens.
        </Notice>
      </Section>
      <Section id="plan-help" title="Common questions">
        <details>
          <summary>I created a transaction, but Calendar is empty.</summary>
          <p>
            Calendar shows plans, not every recorded transaction. Create a dated
            plan if you want that event on the calendar.
          </p>
        </details>
        <details>
          <summary>I can&apos;t see the plan I just created.</summary>
          <p>
            Check the start/end dates and the month currently displayed in
            Calendar. In the plan list, check any category or status filters. If
            saving failed, the plan will not appear until it is successfully
            created.
          </p>
        </details>
        <p>
          <Link href="/landing#sample-month">
            Explore the illustrative calendar and timeline
          </Link>{" "}
          to see how a few dated plans fit together.
        </p>
      </Section>
    </>
  ),
  ai: (
    <>
      <Section id="without-ai" title="Start without AI">
        <p>
          You can record transactions, set budgets, create plans and track goals
          without AI. The optional AI Advisor helps explain financial data
          through a configured external provider.
        </p>
      </Section>
      <Section id="enable-ai" title="Set up optional insights">
        <ol>
          <li>
            Open <strong>Settings → Preferences</strong>.
          </li>
          <li>
            Review the AI provider settings. Supported providers include Claude
            (Anthropic), Typhoon and Groq.
          </li>
          <li>
            Select a supported model and configure the required provider API
            key. An API key is a credential from that provider; your Aegis
            password is not an API key.
          </li>
          <li>
            Use AI Advisor to request an analysis and read it alongside your
            records.
          </li>
        </ol>
        <Result>
          If the provider is configured and available, an insight appears. An
          unavailable or failed request should show an error; enabling AI is not
          required to continue using your records.
        </Result>
      </Section>
      <Section id="ai-data" title="Understand data sharing">
        <p>
          Relevant financial data is sent to the provider selected for the
          request. Provider availability and charges depend on your
          configuration. Review that provider&apos;s terms before enabling it.
        </p>
        <p>
          AI output can be incomplete or wrong. Check its explanation against
          your records before acting on it.
        </p>
      </Section>
      <Section id="ai-help" title="If insights are unavailable">
        <p>
          Check the selected provider, model and API key in Settings. The
          provider may also have an outage, exhausted allowance or rate limit.
          Your transactions and plans remain usable while AI is unavailable.
        </p>
        <p>
          Developers can find the corresponding{" "}
          <Link href="/docs/developers/api#errors">
            HTTP error explanations
          </Link>{" "}
          in the API guide.
        </p>
      </Section>
    </>
  ),
  exports: (
    <>
      <Section id="download-csv" title="Download a CSV">
        <ol>
          <li>
            Open <strong>Reports</strong> in the app.
          </li>
          <li>Choose the date range you want to export.</li>
          <li>
            Select <strong>CSV</strong> and open the downloaded file in a
            spreadsheet application.
          </li>
        </ol>
        <Result>
          A transaction CSV for the selected date range downloads. Compare a few
          rows with your records before using the file elsewhere.
        </Result>
      </Section>
      <Section id="export-scope" title="What is included">
        <div className={s.tableWrap}>
          <table>
            <caption>Export formats and their purpose</caption>
            <thead>
              <tr>
                <th scope="col">Format</th>
                <th scope="col">Includes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">CSV</th>
                <td>Transactions for your selected date range.</td>
              </tr>
              <tr>
                <th scope="row">PDF</th>
                <td>A formatted report, on deployments with PDF support.</td>
              </tr>
              <tr>
                <th scope="row">NDJSON (API)</th>
                <td>Separate exports for transactions, plans and budgets.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          These exports do not include every part of your account. If you run
          Aegis yourself, use database backups for full recovery.
        </p>
        <SourceLink path="docs/analytics-warehouses.md">
          Developer export integration guide
        </SourceLink>
      </Section>
      <Section id="export-help" title="If a download fails">
        <p>
          Check that you are still signed in and that the backend is available.
          If PDF is unavailable on your deployment, try CSV. If the file is
          empty, check the selected dates against your transaction list.
        </p>
      </Section>
    </>
  ),
  "local-setup": (
    <>
      <Section id="prerequisites" title="Prerequisites">
        <p>
          This guide is for running the repository on your development computer.
          Install{" "}
          <strong>Git, Docker with Compose v2, Make and Python 3</strong>.
          Docker must be running, and the default host ports 3000, 8000 and 5432
          must be available.
        </p>
        <p>
          The Compose stack includes the Next.js frontend, FastAPI backend,
          PostgreSQL, Redis and a background worker. AI credentials are
          optional.
        </p>
      </Section>
      <Section id="start-stack" title="Start the stack">
        <CodeBlock
          label="Clone and configure"
          code={`git clone https://github.com/santapong/Aegis.git
cd Aegis
make setup`}
        />
        <p>
          <code>make setup</code> creates a root <code>.env</code> file with a
          generated session secret and Docker database settings. If the file
          already exists, it is left unchanged; review it before starting.
        </p>
        <CodeBlock label="Start development services" code="make dev" />
        <p>
          This runs the base Compose file with the development override and
          keeps logs in the terminal. The override enables hot reload and{" "}
          <code>DEBUG=true</code>, allowing local HTTP sessions and backend API
          docs. Use it for local development.
        </p>
        <Result>
          After the services finish starting, open{" "}
          <code>http://localhost:3000</code>. The backend is at{" "}
          <code>http://localhost:8000</code>. Register a local account through
          the app, then sign in.
        </Result>
      </Section>
      <Section id="verify-stack" title="Verify it works">
        <p>In a second terminal at the repository root:</p>
        <CodeBlock
          label="Check containers and backend"
          code={`docker compose ps
curl --fail-with-body http://localhost:8000/api/health`}
        />
        <p>
          A healthy response includes <code>"status": "ok"</code> and{" "}
          <code>"db": "ok"</code>. AI may say <code>"not_configured"</code>;
          that is expected if you have not configured a provider.
        </p>
        <p>
          With the development override, visit{" "}
          <code>http://localhost:8000/api/docs</code> for Swagger or{" "}
          <code>/api/redoc</code> for ReDoc. These backend pages differ from
          this documentation site.
        </p>
      </Section>
      <Section id="configuration" title="Configuration">
        <div className={s.tableWrap}>
          <table>
            <caption>Settings to understand before changing the stack</caption>
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <code>JWT_SECRET_KEY</code>
                </th>
                <td>
                  Signs sessions; generated by make setup. Keep it private.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <code>DATABASE_URL</code>
                </th>
                <td>
                  Database connection. Compose explicitly connects backend and
                  worker to its PostgreSQL service.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <code>DEBUG</code>
                </th>
                <td>
                  True in the development override; controls API docs and local
                  cookie behavior.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <code>NEXT_PUBLIC_API_URL</code>
                </th>
                <td>
                  The dev override points the browser at localhost:8000. A
                  remote browser needs an address it can reach.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Native backend commands run from <code>backend/</code> and read{" "}
          <code>backend/.env</code>; Compose reads the repository-root file.
          Native SQLite and MySQL setups have different connection values.
        </p>
        <SourceLink path="docs/databases.md">
          Database configuration reference
        </SourceLink>
      </Section>
      <Section id="setup-help" title="Troubleshooting">
        <details>
          <summary>A port is already in use.</summary>
          <p>
            Check which local service owns the port. The base Compose file
            allows FRONTEND_PORT, BACKEND_PORT and DB_PORT overrides. If you
            change the backend port, also update the development frontend API
            URL and allowed origins so they agree.
          </p>
        </details>
        <details>
          <summary>The backend is unhealthy or migrations failed.</summary>
          <p>
            Read <code>docker compose logs backend db</code>. Check database
            reachability and the configured user/password. Container startup
            applies Alembic migrations before launching the backend; a failed
            migration prevents normal startup.
          </p>
        </details>
        <details>
          <summary>
            I can sign in, but the session doesn&apos;t stay signed in.
          </summary>
          <p>
            Check whether you used the development override. Production mode
            sets a Secure session cookie for HTTPS. Also check the
            browser-facing API URL and CORS origins; localhost on another device
            refers to that device.
          </p>
        </details>
        <p>
          For public hosting, continue with the{" "}
          <SourceLink path="docs/deployment/README.md">
            deployment runbooks
          </SourceLink>
          . A working local development server is not a production deployment.
        </p>
      </Section>
    </>
  ),
  api: (
    <>
      <Section id="api-basics" title="Before your first request">
        <p>
          You need a running backend, curl, and a registered account on that
          installation. Follow{" "}
          <Link href="/docs/developers/local-setup">Run Aegis locally</Link>{" "}
          first if needed. Examples use <code>http://localhost:8000</code>;
          replace it with your backend address.
        </p>
        <p>
          Aegis accepts JSON request bodies. Browser clients use an httpOnly
          session cookie; scripts can use the bearer token returned by login.
          Records are scoped to the authenticated user.
        </p>
      </Section>
      <Section id="authenticate" title="Authenticate">
        <p>
          Use a local test account for your first request. Replace the
          placeholder email and password below before running it.
        </p>
        <CodeBlock
          label="Log in · POST /api/auth/login"
          code={`curl --fail-with-body http://localhost:8000/api/auth/login \\
  --header 'Content-Type: application/json' \\
  --data '{"email":"you@example.com","password":"YOUR_PASSWORD"}'`}
        />
        <CodeBlock
          label="Response shape · illustrative"
          code={`{
  "access_token": "YOUR_RETURNED_TOKEN",
  "token_type": "bearer"
}`}
        />
        <p>
          Keep the returned token private: it represents the signed-in account.
          Replace <code>YOUR_RETURNED_TOKEN</code> in the next request with that
          value. The app itself uses the cookie set by login rather than
          persisting this token in browser storage.
        </p>
      </Section>
      <Section id="read-transactions" title="Read transactions">
        <CodeBlock
          label="Read · GET /api/transactions/"
          code={`curl --fail-with-body \\
  'http://localhost:8000/api/transactions/?limit=1&offset=0' \\
  --header 'Authorization: Bearer YOUR_RETURNED_TOKEN'`}
        />
        <Result>
          HTTP 200 with a JSON array. A new account may return <code>[]</code>;
          that is a successful request with no records. An account with
          transactions returns up to one record for this example.
        </Result>
        <CodeBlock
          label="Non-empty response · fictional record, excerpt"
          code={`[
  {
    "id": "example-transaction-id",
    "amount": 18000,
    "type": "expense",
    "category": "Housing",
    "date": "2026-09-28",
    "description": "Rent"
  }
]`}
        />
        <p>
          The excerpt omits linkage, recurrence, timestamps and tags. Full
          records are described by <code>TransactionResponse</code> in the
          backend schema.
        </p>
      </Section>
      <Section id="create-transaction" title="Create a transaction">
        <p>
          This request saves a record to the authenticated account. Use your
          local test account and change the sample values as needed.
        </p>
        <CodeBlock
          label="Create · POST /api/transactions/"
          code={`curl --fail-with-body http://localhost:8000/api/transactions/ \\
  --header 'Authorization: Bearer YOUR_RETURNED_TOKEN' \\
  --header 'Content-Type: application/json' \\
  --data '{"amount":18000,"type":"expense","category":"Housing","date":"2026-09-28","description":"Rent"}'`}
        />
        <div className={s.tableWrap}>
          <table>
            <caption>Required transaction fields</caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Accepted value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <code>amount</code>
                </th>
                <td>A number greater than zero.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>type</code>
                </th>
                <td>
                  <code>income</code> or <code>expense</code>.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <code>category</code>
                </th>
                <td>
                  A string of at most 100 characters; use a consistent non-empty
                  category.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <code>date</code>
                </th>
                <td>A date in YYYY-MM-DD form.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Result>
          HTTP 201 with the new record and its generated ID. Repeating this POST
          creates another record; it is not an upsert.
        </Result>
      </Section>
      <Section id="parameters" title="Filters & pagination">
        <p>
          <code>GET /api/transactions/</code> supports <code>type</code>,{" "}
          <code>category</code>, <code>start_date</code>, <code>end_date</code>,{" "}
          <code>q</code> (description/category search), and <code>tags</code>{" "}
          (comma-separated tag names).
        </p>
        <p>
          <code>limit</code> defaults to 100 and has a maximum of 500.{" "}
          <code>offset</code> starts at 0. Increase the offset to read another
          page. The response is an array ordered by date descending, not an
          object with a total count.
        </p>
        <CodeBlock
          label="Filter a month of Housing expenses"
          code={`curl --fail-with-body \\
  'http://localhost:8000/api/transactions/?type=expense&category=Housing&start_date=2026-09-01&end_date=2026-09-30&limit=100&offset=0' \\
  --header 'Authorization: Bearer YOUR_RETURNED_TOKEN'`}
        />
      </Section>
      <Section id="errors" title="Errors & next steps">
        <div className={s.tableWrap}>
          <table>
            <caption>Common HTTP responses</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">What to check</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">401</th>
                <td>
                  Invalid login, missing token or expired session. Authenticate
                  again and send the token or cookie.
                </td>
              </tr>
              <tr>
                <th scope="row">403</th>
                <td>
                  The account may be deactivated. Read the response detail.
                </td>
              </tr>
              <tr>
                <th scope="row">404</th>
                <td>
                  The requested record does not exist or is not available to
                  this account.
                </td>
              </tr>
              <tr>
                <th scope="row">422</th>
                <td>
                  Request validation failed. The response detail identifies the
                  field and issue.
                </td>
              </tr>
              <tr>
                <th scope="row">429</th>
                <td>
                  A rate limit was reached. Pause requests and retry later.
                </td>
              </tr>
              <tr>
                <th scope="row">503</th>
                <td>
                  A service is unavailable, such as an unconfigured AI provider
                  or an unhealthy database check. Inspect the response and
                  backend logs.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          For all resources and optional fields, open backend{" "}
          <code>/api/docs</code> or <code>/api/redoc</code> with{" "}
          <code>DEBUG=true</code>. These interactive documentation routes are
          disabled when debug mode is off.
        </p>
        <SourceLink path="backend/app/schemas/transaction.py">
          Transaction schemas
        </SourceLink>
        {" · "}
        <SourceLink path="backend/app/routers" directory>
          All API routers
        </SourceLink>
      </Section>
    </>
  ),
  architecture: (
    <>
      <Section id="request-path" title="Follow a request">
        <ol>
          <li>
            <strong>Interface:</strong> a Next.js page collects input and calls
            the API client in <code>frontend/src/lib/api.ts</code>.
          </li>
          <li>
            <strong>API:</strong> a FastAPI router validates the body and
            resolves the signed-in user.
          </li>
          <li>
            <strong>Storage:</strong> SQLAlchemy queries or updates records
            scoped to that user. Alembic manages schema migrations.
          </li>
          <li>
            <strong>Result:</strong> the API returns JSON; the frontend updates
            its query cache and visible state.
          </li>
        </ol>
        <p>
          The normal frontend uses same-origin API requests with a server
          rewrite. The local development Compose override points the browser
          directly at the backend on localhost:8000.
        </p>
      </Section>
      <Section id="data-model" title="Understand the data">
        <div className={s.tableWrap}>
          <table>
            <caption>Core concepts and their boundaries</caption>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Responsibility</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Transaction</th>
                <td>
                  Income/expense amount, category and date. Used for spending
                  totals and comparisons.
                </td>
              </tr>
              <tr>
                <th scope="row">Plan</th>
                <td>
                  An intention with dates, category, amount and progress/status.
                  Source for Calendar and Gantt.
                </td>
              </tr>
              <tr>
                <th scope="row">Budget</th>
                <td>
                  A category limit with start/end dates. Compared with recorded
                  expense totals.
                </td>
              </tr>
              <tr>
                <th scope="row">Savings goal</th>
                <td>
                  A target and recorded contributions. Separate from plans and
                  transactions.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Notice title="Do not infer money movement from a status.">
          Completing a plan does not create a transaction or initiate a
          transfer. Adding a savings contribution updates a goal record.
        </Notice>
      </Section>
      <Section id="repo-map" title="Find the right file">
        <div className={s.tableWrap}>
          <table>
            <caption>Repository map</caption>
            <thead>
              <tr>
                <th scope="col">Path</th>
                <th scope="col">What lives here</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <code>frontend/src/app/</code>
                </th>
                <td>Routes and page interfaces.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>frontend/src/lib/api.ts</code>
                </th>
                <td>Frontend API calls and request handling.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>backend/app/routers/</code>
                </th>
                <td>HTTP endpoints and ownership checks.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>backend/app/schemas/</code>
                </th>
                <td>Request validation and response contracts.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>backend/app/models/</code>
                </th>
                <td>Database models and relationships.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>backend/alembic/versions/</code>
                </th>
                <td>Database migrations.</td>
              </tr>
              <tr>
                <th scope="row">
                  <code>backend/tests/</code>
                </th>
                <td>Backend tests, including isolated database fixtures.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="extension" title="Before extending Aegis">
        <p>
          Read the matching router, schema, model and tests together. Preserve
          user ownership checks, and add an Alembic migration when changing
          persistent storage. Do not treat a frontend type as the complete
          backend contract.
        </p>
        <SourceLink path="docs/architecture.md">
          Detailed architecture guide
        </SourceLink>
        {" · "}
        <SourceLink path="backend/tests/conftest.py">
          Backend test fixtures
        </SourceLink>
      </Section>
    </>
  ),
};

export const articleContent:Record<string,React.ReactNode> = {...originalContent,...additionalContent};
