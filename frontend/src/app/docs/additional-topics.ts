import type { DocCategoryId } from "./taxonomy";
export type TopicSection = { id:string; title:string; paragraphs:string[]; steps?:string[]; code?:{label:string;code:string} };
export type AdditionalTopic = { slug:string; title:string; description:string; audience:"guides"|"developers"; category:DocCategoryId; kind:string; outcome:string; keywords:string; sections:TopicSection[] };
export const additionalTopics:AdditionalTopic[] = [
  {
    "slug": "concepts",
    "title": "Understand the money model",
    "description": "Know the difference between cash, a record, a plan, a budget, and money reserved for a purpose.",
    "audience": "guides",
    "category": "start",
    "kind": "Practical guide",
    "outcome": "Choose the right place for the action you want to take.",
    "keywords": "cash reserve headroom actual planned opening balance ledger legacy unassigned understand the money model",
    "sections": [
      {
        "id": "money-words",
        "title": "A few useful distinctions",
        "paragraphs": [
          "A transaction records something that happened. A plan describes something intended to happen. A budget is a spending limit. A savings target describes an amount you want to build toward. These are related views, with different jobs.",
          "Completing a plan does not send money or automatically prove that a payment happened. A reserve can reduce planning headroom without reducing account cash."
        ]
      },
      {
        "id": "choose-a-view",
        "title": "Choose a view for the question",
        "paragraphs": [
          "Tracked accounts and Review & activity belong to the account-ledger workflow on installations that include it. Cash planning has its own dated workspace/account scope. Unassigned records are older or unassigned entries; they should not be assumed to be included in a verified account balance."
        ],
        "steps": [
          "Use Accounts to review tracked accounts and their opening positions.",
          "Use Review & activity to inspect a proposal before confirming a recorded movement.",
          "Use Cash planning to examine upcoming dates and a what-if scenario.",
          "Use Budgets, Savings, or Calendar for the separate limits and intentions they describe."
        ]
      },
      {
        "id": "read-a-number",
        "title": "Read the scope before the number",
        "paragraphs": [
          "Check the currency, account or workspace, date range, and actual/planned label. Opening cash plus recorded net movement is a different quantity from a forecast after future costs and reserve intentions.",
          "In the fictional Business X demo, a negative THB2,000 after reserves is a gap against a THB10,000 reserve intention. Cash before that allocation is THB8,000; the example does not show a bank overdraft."
        ]
      },
      {
        "id": "when-it-differs",
        "title": "When two screens differ",
        "paragraphs": [
          "Start by comparing scopes and dates. A cash-workspace forecast, a tracked-account balance, a budget remainder, and a legacy report need not contain the same records. Reconcile their sources before changing a number to make them match."
        ]
      }
    ]
  },
  {
    "slug": "appearance",
    "title": "Choose your light or dark",
    "description": "Use Horizon in daylight or after dark, while keeping the same clear layout.",
    "audience": "guides",
    "category": "start",
    "kind": "Practical guide",
    "outcome": "Switch appearance without losing the form or guide you are using.",
    "keywords": "theme light dark accessibility colour keyboard choose your light or dark",
    "sections": [
      {
        "id": "switch",
        "title": "Switch the atmosphere",
        "paragraphs": [
          "Use the sun/moon button in a public-page header or access screen. The paired modes are Horizon and Horizon Dark. The page layout and financial meanings stay the same."
        ],
        "steps": [
          "Open the appearance button in the header.",
          "Choose the other mode. Your current form values and documentation search stay in place.",
          "In a signed-in workspace, open Settings → Appearance for the full theme collection."
        ]
      },
      {
        "id": "remember",
        "title": "Understand what is remembered",
        "paragraphs": [
          "The appearance preference is stored in this browser. Another browser or a storage-restricted session may start with its own default. The website does not need an AI provider to switch modes.",
          "The older workspace themes remain available. Public pages use the paired Horizon treatment; selecting an older workspace appearance is not a claim that its art direction was redesigned."
        ]
      },
      {
        "id": "accessibility",
        "title": "Use the layout comfortably",
        "paragraphs": [
          "Keyboard focus, labelled controls, and actual/planned text help make the financial view understandable. Browser zoom and reduced-motion preferences can be used alongside either mode. If a value is difficult to interpret, inspect its source rows rather than relying on chart colour."
        ]
      }
    ]
  },
  {
    "slug": "accounts",
    "title": "Set up tracked accounts",
    "description": "Create an account record and review its opening position before recording new movements.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "An account with an opening position you have deliberately reviewed.",
    "keywords": "account type credit card cash wallet savings opening snapshot cutoff set up tracked accounts",
    "sections": [
      {
        "id": "before",
        "title": "Before you start",
        "paragraphs": [
          "This guide applies to installations with Accounts and Review & activity. A tracked account is your record of an account, not a new bank account or an automatic bank connection.",
          "Use a checked statement or another reliable source for the opening position. Pay particular attention to credit-card debt and movements near the snapshot time."
        ]
      },
      {
        "id": "create",
        "title": "Create and review",
        "paragraphs": [
          "Open Accounts. The page separates account creation from opening-balance review."
        ],
        "steps": [
          "Under Add an account, enter Account name and Account type, then choose Create account.",
          "Under Review opening balances, enter the snapshot time and the reviewed amounts for the accounts in that snapshot.",
          "Choose Review snapshot and inspect the proposed opening positions. Use Edit snapshot to correct the review before confirming.",
          "Keep a note of the source you used to check the amounts."
        ]
      },
      {
        "id": "check",
        "title": "Check the result",
        "paragraphs": [
          "Refresh balances and inspect the opening position for each account. The Accounts page also exposes an account reference for the LINE workflow where it is available; sharing a reference does not itself create a transaction."
        ]
      },
      {
        "id": "boundary",
        "title": "Keep opening-day activity clear",
        "paragraphs": [
          "An opening snapshot can already include some same-day activity. Resolve whether a proposed movement occurred after that snapshot before posting it. Do not add an opening position twice or record the same money again to make a second screen agree."
        ]
      }
    ]
  },
  {
    "slug": "review",
    "title": "Review a movement before posting",
    "description": "Create a proposal, inspect its account effects, and confirm the saved version deliberately.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "A proposal you can explain, followed by one intentional confirmation.",
    "keywords": "draft confirm post version journal refund transfer reversal correction review a movement before posting",
    "sections": [
      {
        "id": "proposal",
        "title": "Begin with a proposal",
        "paragraphs": [
          "Open Review & activity. Set up a verified opening in Accounts first if the workspace asks for one. New proposal creates a saved draft; a draft has no balance effect until confirmed."
        ],
        "steps": [
          "Choose New proposal and select the supported operation.",
          "Check the source and destination accounts, currency, amount, date, category, and description.",
          "Save the draft and read the displayed effects. A transfer may have a separate fee."
        ]
      },
      {
        "id": "confirm",
        "title": "Review the saved version",
        "paragraphs": [
          "Choose Review & confirm on the intended draft. Resolve the warnings shown for that version, then choose Confirm and post only when the account effects match what actually happened.",
          "If the draft was edited elsewhere, refresh and inspect the saved version again. A message saying that a proposal was received is not evidence that it was posted."
        ]
      },
      {
        "id": "after",
        "title": "Find the outcome",
        "paragraphs": [
          "Posted account activity shows recorded outcomes and journal references. Recent draft outcomes helps distinguish posted, pending, and cancelled proposals. A refund can reduce spending; a transfer is not ordinary income."
        ]
      },
      {
        "id": "correct",
        "title": "Correct a mistake through the supported review",
        "paragraphs": [
          "Use the posted-correction flow where the UI offers it. Read the proposed reversal or replacement effects before confirming. Keep pending when you are unsure. Do not treat cancellation of an unposted draft as deletion of an already-posted movement."
        ]
      }
    ]
  },
  {
    "slug": "trips",
    "title": "Plan a trip and follow its spending",
    "description": "Keep a trip intention, its budget, and assigned spending understandable.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "A dated trip record and a clear view of the records assigned to it.",
    "keywords": "trip travel destination budget dates plan a trip and follow its spending",
    "sections": [
      {
        "id": "create",
        "title": "Create the trip",
        "paragraphs": [
          "Open Trips and choose Plan a Trip. A trip groups an intention and the records you explicitly associate with it."
        ],
        "steps": [
          "Enter Title, Destination, Start Date, and End Date.",
          "Add Total Budget if you have chosen a limit.",
          "Choose Create, open the trip, and check its dates and budget."
        ]
      },
      {
        "id": "assign",
        "title": "Assign records deliberately",
        "paragraphs": [
          "When a supported entry form includes Trip, select the intended trip. A record that is not assigned to a trip is not automatically part of that trip's totals.",
          "Compare the same currency and record scope when checking trip spending against the budget. Creating a trip or budget does not book travel or make a payment."
        ]
      },
      {
        "id": "check",
        "title": "When a total looks wrong",
        "paragraphs": [
          "Check the trip reference, entry dates, transaction type, and whether the record is in the tracked-account or older-record workflow on your installation. Avoid creating duplicate spending merely to change the trip summary."
        ]
      }
    ]
  },
  {
    "slug": "investments",
    "title": "Track holdings with clear assumptions",
    "description": "Understand manually entered holdings and the boundary around external market charts.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "A holding whose units, cost basis, currency, and price source are clear.",
    "keywords": "investment holding cost basis units currency tradingview watchlist price track holdings with clear assumptions",
    "sections": [
      {
        "id": "add",
        "title": "Add a holding",
        "paragraphs": [
          "Open Investments and choose Add Holding. This is a tracking view; adding a holding does not buy or sell an investment."
        ],
        "steps": [
          "Enter Name, Symbol, Units, Currency, and total Cost Basis.",
          "Check that Current Price is a per-unit value and matches the intended symbol and currency.",
          "Use the supported search or manual-ticker path to preview the symbol before saving."
        ]
      },
      {
        "id": "prices",
        "title": "Know what the chart means",
        "paragraphs": [
          "The page can display TradingView content. That is an external service; availability and prices may differ from your manually entered record. A chart is not proof that a holding has been reconciled with a broker.",
          "Portfolio value and unrealised gain or loss depend on the units and price being used. Keep the price source and currency in view."
        ]
      },
      {
        "id": "limits",
        "title": "Keep tracking separate from action",
        "paragraphs": [
          "Do not interpret a displayed value as a guaranteed return or an instruction to trade. Check the source data when a symbol, price, or currency looks wrong. Removing a tracked holding is a record change, not a broker sale."
        ]
      }
    ]
  },
  {
    "slug": "debt-payoff",
    "title": "Track debt and explore a payoff plan",
    "description": "Record the assumptions behind a debt and compare a repayment scenario.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "A debt record and a payoff illustration you can trace to its inputs.",
    "keywords": "debt interest payoff strategy avalanche snowball repayment track debt and explore a payoff plan",
    "sections": [
      {
        "id": "record",
        "title": "Enter the current position",
        "paragraphs": [
          "Open Debts and choose Add Debt. Enter the checked Current Balance, Interest Rate, Minimum Payment, and other relevant fields. Keep the rate and payment frequency assumptions consistent with the source you are using."
        ]
      },
      {
        "id": "scenario",
        "title": "Explore the plan",
        "paragraphs": [
          "The Payoff Plan view uses Strategy and Extra Monthly Payment to illustrate a path. Compare Time to Debt Free, Total Interest, and the monthly breakdown against the entered assumptions.",
          "An illustration cannot guarantee future rates, fees, payment timing, or lender outcomes. Refresh the record when the checked balance changes."
        ]
      },
      {
        "id": "payment",
        "title": "Record what actually happened",
        "paragraphs": [
          "Make Payment / Record Payment is a recording flow. It does not instruct a bank or lender to transfer money. Check the installation's account-ledger workflow before recording the same payment in another place."
        ]
      }
    ]
  },
  {
    "slug": "reports",
    "title": "Read reports with the right scope",
    "description": "Compare summaries without confusing cash, spending, and plans.",
    "audience": "guides",
    "category": "everyday",
    "kind": "Practical guide",
    "outcome": "A report you can relate to its included records and period.",
    "keywords": "report analytics period category monthly net savings errors read reports with the right scope",
    "sections": [
      {
        "id": "scope",
        "title": "Start with the period and currency",
        "paragraphs": [
          "Open Reports. Check the selected date range and currency before interpreting Total Income, Total Expenses, or Net Savings. These are report quantities; they are not automatically your checked bank balance."
        ]
      },
      {
        "id": "compare",
        "title": "Inspect a comparison",
        "paragraphs": [
          "Spending by Category, Income vs Expenses, and monthly category comparisons answer different questions. Use the underlying record scope and a matching period when comparing them.",
          "On installations with the newer ledger cutover, read the deployment's scope notices. Older unassigned records and tracked-account postings should not silently be added together."
        ]
      },
      {
        "id": "unavailable",
        "title": "When a chart is unavailable",
        "paragraphs": [
          "A service error is not a zero balance or proof of no spending. Retry after checking the connection. Keep exports and displayed summaries within their stated scope."
        ]
      }
    ]
  },
  {
    "slug": "business-review",
    "title": "Review business cash and saved forecasts",
    "description": "Keep receivables, bills, and reviewed forecasts separate from recorded payments.",
    "audience": "guides",
    "category": "planning",
    "kind": "Practical guide",
    "outcome": "An explainable business plan with dated expectations and traceable payment matches.",
    "keywords": "business receivables bills credit partial settlement saved forecast snapshot review business cash and saved forecasts",
    "sections": [
      {
        "id": "documents",
        "title": "Receivables and bills",
        "paragraphs": [
          "In a business Cash planning workspace, open Business review and Receivables & bills where your installation includes these features. A customer receivable or supplier bill describes an expectation; it is not proof of money received or paid.",
          "Expected cash dates affect the forecast. Contractual due dates help describe lateness. Credits and partial settlements can change the remaining expectation."
        ]
      },
      {
        "id": "settle",
        "title": "Record or match once",
        "paragraphs": [
          "Use Record or match a payment for money that actually moved. Check whether an existing recorded movement already explains the settlement before creating another one.",
          "Inspect matched payments and credits when the remaining amount is surprising. Undoing a match changes the association; it is not automatically a reversal of a real payment."
        ]
      },
      {
        "id": "snapshots",
        "title": "Review a saved forecast",
        "paragraphs": [
          "A saved forecast preserves its original dates, scope, sources, and assumptions for comparison. It should not quietly become the current forecast when later records change. Read the changes and underlying sources in Saved forecast review."
        ]
      },
      {
        "id": "limits",
        "title": "Understand the business scope",
        "paragraphs": [
          "This is owner-run cash planning. It does not, by itself, establish full statutory accounting, payroll, tax filing, invoicing operations, or team permissions. Feature availability depends on the version and configuration you run."
        ]
      }
    ]
  },
  {
    "slug": "recurring-plans",
    "title": "Review schedules and upcoming cash",
    "description": "Understand recurring intentions, exceptions, and matching in a dated workspace.",
    "audience": "guides",
    "category": "planning",
    "kind": "Practical guide",
    "outcome": "Upcoming plans with dates and exceptions you have reviewed.",
    "keywords": "recurrence schedule occurrences split payday exceptions upcoming alerts review schedules and upcoming cash",
    "sections": [
      {
        "id": "schedule",
        "title": "Choose the right schedule",
        "paragraphs": [
          "Use Upcoming plans in Cash planning for dated cash intentions on installations that include it. A recurrence generates expected dates; it should not be confused with a bank standing order or an automatically posted payment."
        ]
      },
      {
        "id": "review",
        "title": "Review occurrences",
        "paragraphs": [
          "Check each occurrence's expected date, amount, currency, and source. A reviewed extension should preserve the individual exceptions and matches already made. Split-date schedules may have multiple amounts within a month."
        ]
      },
      {
        "id": "match",
        "title": "Match against what happened",
        "paragraphs": [
          "When money moves, record it in the appropriate scope and review any matching association. A schedule occurrence that is matched should not be counted again as a separate new payment.",
          "Read Cash alerts as explanations of their source records and assumptions. An in-app alert does not imply an external message was delivered."
        ]
      }
    ]
  },
  {
    "slug": "line-finance",
    "title": "Understand LINE capture and confirmation",
    "description": "Know what linking, a proposal, and a posted reply each mean.",
    "audience": "guides",
    "category": "connections",
    "kind": "Practical guide",
    "outcome": "A clear picture of the LINE workflow and its setup boundary.",
    "keywords": "line bot linking capture draft confirmation destination ocr delivery understand line capture and confirmation",
    "sections": [
      {
        "id": "availability",
        "title": "Check your installation first",
        "paragraphs": [
          "LINE capture is optional and depends on the deployment, credentials, linking state, and supported destination. The public demo does not connect a channel. A connected-looking screen alone is not evidence of real delivery."
        ]
      },
      {
        "id": "destination",
        "title": "Choose the intended destination",
        "paragraphs": [
          "Follow the destination/linking controls actually shown in Settings → LINE finance or Accounts on your installation. Verify the owner, workspace/account scope, and currency before confirming a destination.",
          "The older cash connector and the newer account-ledger workflow are different implementations. Do not assume a destination from one is a destination for the other."
        ]
      },
      {
        "id": "review",
        "title": "Treat a message as a proposal",
        "paragraphs": [
          "In the account-ledger workflow, a captured message can create a proposal for review. Inspect its account effects and current saved version before confirming. Acknowledgement, preview, confirmation, and posted outcome are separate states."
        ]
      },
      {
        "id": "limits",
        "title": "When delivery or interpretation fails",
        "paragraphs": [
          "Keep the draft pending when an amount, account, or date is uncertain. Inspect the actual status and retry guidance in your deployment. OCR support, live-channel delivery, and production rollout must be qualified separately; this guide is not a claim that they are enabled everywhere."
        ]
      }
    ]
  },
  {
    "slug": "privacy",
    "title": "Understand data and optional services",
    "description": "Make informed choices about self-hosting, exports, and AI requests.",
    "audience": "guides",
    "category": "ownership",
    "kind": "Practical guide",
    "outcome": "Know where the core records live and when an external service is involved.",
    "keywords": "privacy security data ownership provider retention credentials self hosting understand data and optional services",
    "sections": [
      {
        "id": "records",
        "title": "Core records and your deployment",
        "paragraphs": [
          "Aegis stores records in the database used by its backend. If you self-host, you are responsible for that deployment's access, updates, backups, and recovery. Open source makes code inspectable; it is not a security certification."
        ]
      },
      {
        "id": "services",
        "title": "Optional services have their own boundary",
        "paragraphs": [
          "When you request an AI insight, the backend prepares relevant user-scoped context for the configured provider. Do not assume an AI request stays entirely local. Provider availability, terms, retention, and charges depend on the provider and deployment.",
          "An external market chart and a connected messaging channel are also external services. Use the documented setup that matches your installation."
        ]
      },
      {
        "id": "control",
        "title": "Keep control through clear choices",
        "paragraphs": [
          "Use the ordinary app without AI where supported. Export records in the formats available to you. Review what a tool or integration can read and write before connecting it, especially a local MCP client with database access."
        ]
      },
      {
        "id": "access",
        "title": "Protect account access",
        "paragraphs": [
          "Use the supported sign-in flow and keep credentials out of shared documents, screenshots, and agent prompts. The current sign-in help explains the available recovery path; it does not promise a password-reset service that is not implemented."
        ]
      }
    ]
  },
  {
    "slug": "backups",
    "title": "Keep a recoverable self-hosted copy",
    "description": "Separate a convenient record export from a database backup and tested restore.",
    "audience": "developers",
    "category": "ownership",
    "kind": "Developer guide",
    "outcome": "A backup plan with an explicit recovery check.",
    "keywords": "backup recovery restore sqlite postgres mysql exports encryption migration keep a recoverable self-hosted copy",
    "sections": [
      {
        "id": "export-or-backup",
        "title": "Choose the right artifact",
        "paragraphs": [
          "A transaction CSV is useful for inspection and portability. It is not a complete backup of accounts, users, plans, goals, connections, or other database state. Check the installation's supported export formats and their scope."
        ]
      },
      {
        "id": "backup",
        "title": "Back up the deployment deliberately",
        "paragraphs": [
          "Identify the configured database engine, application version, migration state, and the secrets required to decrypt deployment data. Use that database's supported backup method and store the result separately from the running instance.",
          "Keep credentials and encryption material in an appropriate protected store. Do not paste them into a public documentation page or a support conversation."
        ]
      },
      {
        "id": "restore",
        "title": "Test recovery in isolation",
        "paragraphs": [
          "Restore into a disposable isolated instance using a compatible schema and application version. Confirm representative counts and relationships, then use the supported application flows to inspect results. Do not restore over the live instance merely to test whether a file opens."
        ]
      },
      {
        "id": "verify",
        "title": "Record what was actually checked",
        "paragraphs": [
          "Record the backup time, source version, restore destination, actual checks, failures, and recovery limits. A file existing on disk or a command returning success does not alone establish usable recovery."
        ]
      }
    ]
  },
  {
    "slug": "mcp",
    "title": "Connect the local MCP server",
    "description": "Set up the existing stdio server and understand its database and provider boundaries.",
    "audience": "developers",
    "category": "connections",
    "kind": "Developer guide",
    "outcome": "A local MCP configuration you can inspect before enabling tools.",
    "keywords": "mcp stdio tools local trust AEGIS_USER_EMAIL DATABASE_URL integration assistant llm connect the local mcp server",
    "sections": [
      {
        "id": "what-it-is",
        "title": "What is implemented",
        "paragraphs": [
          "The repository ships aegis-mcp, a local stdio MCP server. It queries the configured backend database and exposes transaction, budget, plan, trip, dashboard, and AI tools. This documentation does not create a hosted remote MCP endpoint.",
          "The local-trust model resolves one existing active user from AEGIS_USER_EMAIL. This is not web login, delegated OAuth, or multi-user remote authentication. Anyone able to launch it with database credentials is inside that local trust boundary."
        ]
      },
      {
        "id": "configure",
        "title": "Configure a compatible client",
        "paragraphs": [
          "Install the backend dependencies using the project's supported environment and an MCP client that can launch stdio servers. Use absolute paths and a disposable development database for the first check. Configure required backend settings through your approved local configuration."
        ],
        "code": {
          "label": "Generic stdio MCP configuration",
          "code": "{\n  \"mcpServers\": {\n    \"aegis\": {\n      \"command\": \"uv\",\n      \"args\": [\n        \"run\",\n        \"--project\",\n        \"/absolute/path/to/Aegis/backend\",\n        \"aegis-mcp\"\n      ],\n      \"env\": {\n        \"AEGIS_USER_EMAIL\": \"you@example.com\",\n        \"DATABASE_URL\": \"sqlite:////absolute/path/to/disposable-aegis.db\",\n        \"JWT_SECRET_KEY\": \"<configured-backend-value>\"\n      }\n    }\n  }\n}"
        }
      },
      {
        "id": "read-first",
        "title": "Discover tools before writing",
        "paragraphs": [
          "Initialize the connection and use your client's tools/list view. Start with an appropriate read tool such as list_trips or get_plans on the disposable database. The tool catalog below groups the18 source-registered tools by effect.",
          "Create/update tools can change records. The current stdio handler does not add a separate human confirmation gate for every write: configure your client's approvals and inspect proposed input before allowing a mutation. Newer ledger-enabled installations may guard or redirect legacy writers; the deployed source remains authoritative."
        ]
      },
      {
        "id": "providers",
        "title": "Account for AI and failures",
        "paragraphs": [
          "ai_analyze, ai_forecast, and ai_recommend can contact the configured external provider, incur charges, and may persist generated recommendations. They are not an offline read-only shortcut.",
          "No user found, inactive user, missing environment settings, wrong database paths, or an unavailable provider are different problems. The server logs to stderr so stdout remains reserved for MCP messages. Do not expose this stdio process as an unauthenticated network service."
        ]
      }
    ]
  },
  {
    "slug": "llm-docs",
    "title": "Use Aegis docs with an assistant",
    "description": "Read the public knowledge base as Markdown and discover the existing MCP integration.",
    "audience": "developers",
    "category": "developers",
    "kind": "Developer guide",
    "outcome": "A small index and canonical topic content that an assistant can fetch without a user session.",
    "keywords": "llms.txt llms-full.txt markdown machine readable ai agents documentation catalog use aegis docs with an assistant",
    "sections": [
      {
        "id": "formats",
        "title": "Choose a readable format",
        "paragraphs": [
          "The documentation publishes /llms.txt as a compact index and /llms-full.txt as a combined public guide. Each article also has a Markdown version at its normal topic URL with .md appended.",
          "These endpoints contain public product and developer documentation. They do not export your transactions, accounts, conversations, or API keys. llms.txt is an interoperability proposal, not an access-control or privacy mechanism."
        ]
      },
      {
        "id": "workflow",
        "title": "Give an assistant the right starting point",
        "paragraphs": [
          "Ask the assistant to read the index first, select the relevant category/topic, and then read the linked Markdown article. Check the documentation's scope and the version you are actually running before turning an example into an action."
        ],
        "code": {
          "label": "Documentation discovery",
          "code": "GET /llms.txt\nGET /docs/developers/mcp.md\nGET /mcp-catalog.json"
        }
      },
      {
        "id": "same-content",
        "title": "One content source, two reading surfaces",
        "paragraphs": [
          "HTML guides and their Markdown exports are produced from the same article catalog and content. Titles, steps, code samples, categories, and related topics remain linked rather than maintained as a second independent knowledge base."
        ]
      },
      {
        "id": "mcp-boundary",
        "title": "Documentation is different from a connected tool",
        "paragraphs": [
          "The MCP catalog describes the existing local stdio server. Fetching it does not initialize that server, grant financial access, or enable remote tool calls. Follow the MCP guide when you explicitly want a compatible local client to use the server."
        ]
      }
    ]
  },
  {
    "slug": "troubleshooting",
    "title": "Find the right recovery path",
    "description": "Distinguish access, data, configuration, and provider problems.",
    "audience": "developers",
    "category": "developers",
    "kind": "Developer guide",
    "outcome": "A narrow next check for the symptom you can actually observe.",
    "keywords": "troubleshoot 401 403 503 offline health unavailable mismatch mcp provider find the right recovery path",
    "sections": [
      {
        "id": "access",
        "title": "If access fails",
        "paragraphs": [
          "Use the sign-in page's error and help text. A401 response usually needs valid account/session credentials; a403 needs an authorization or origin check. Do not work around an access problem by exposing a private endpoint."
        ]
      },
      {
        "id": "service",
        "title": "If a service is unavailable",
        "paragraphs": [
          "A503 or network failure is not evidence of no financial records. Check the backend health and the deployment's database connectivity before editing balances. Keep logs scoped to the request and avoid printing configuration secrets."
        ]
      },
      {
        "id": "data",
        "title": "If the numbers differ",
        "paragraphs": [
          "Compare currency, date range, account/workspace, actual/planned status, opening cutoffs, and included records. Check for an already-posted movement or an existing match before creating another one."
        ]
      },
      {
        "id": "ai-mcp",
        "title": "If AI or MCP fails",
        "paragraphs": [
          "For AI, check configured provider availability, allowed model settings, and deployment status. For MCP, check the absolute project/database paths, an active configured user, stdio support in the client, and stderr logs. A successful public docs fetch does not establish either integration is connected."
        ]
      }
    ]
  },
  {
    "slug": "brand",
    "title": "Explore the Horizon identity",
    "description": "Understand the visual direction and compare the logo drafts.",
    "audience": "guides",
    "category": "start",
    "kind": "Practical guide",
    "outcome": "A consistent visual vocabulary and editable logo candidates.",
    "keywords": "brand logo horizon shelter vector svg identity light dark explore the horizon identity",
    "sections": [
      {
        "id": "direction",
        "title": "Solid ground, open horizons",
        "paragraphs": [
          "Horizon combines warm ivory, deep evergreen, precise interface text, and quiet editorial imagery. It expresses confidence through understandable information and room to plan."
        ]
      },
      {
        "id": "logo",
        "title": "Three drafts to inspect",
        "paragraphs": [
          "The Brand studio at /brand compares Shelter, Open horizon, and Steady path. Each includes transparent vector SVG downloads for light and dark backgrounds. The current mark remains in the app while the alternatives are reviewed."
        ]
      },
      {
        "id": "usage",
        "title": "Keep the identity useful",
        "paragraphs": [
          "Use enough contrast, preserve the mark's proportions, and keep dense information legible. Decorative artwork is illustrative; it should not be presented as a customer, a real financial outcome, or a security certification."
        ]
      }
    ]
  }
];
