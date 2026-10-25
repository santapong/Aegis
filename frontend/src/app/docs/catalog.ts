import { additionalTopics } from "./additional-topics";
import { legacyCategory, type DocCategoryId } from "./taxonomy";

export type Audience = "guides" | "developers";
export type DocArticle = {
  slug: string;
  category?: DocCategoryId;
  audience: Audience;
  title: string;
  description: string;
  kind: string;
  outcome: string;
  keywords: string;
  sections: { id: string; title: string }[];
};
const originalArticles: DocArticle[] = [
  {
    slug: "cash-planning",
    audience: "guides",
    title: "Plan personal and business cash",
    description:
      "Start with checked balances, see upcoming dates, compare a change, and match payments once.",
    kind: "Owner pilot",
    outcome:
      "A dated cash plan with the accounts and assumptions you have reviewed.",
    keywords:
      "cashflow cash account opening balance business personal scenario forecast commitment payment matching",
    sections: [
      { id: "setup", title: "Start with checked cash" },
      { id: "dates", title: "Read the dates and compare a change" },
      { id: "matching", title: "Record and match once" },
      {
        id: "everyday-review",
        title: "Import, reserve, and review everyday cash",
      },
      { id: "older-records", title: "Review older records" },
    ],
  },
  {
    slug: "first-steps",
    audience: "guides",
    title: "Record an unassigned expense",
    description:
      "Learn the basics with one expense, from opening the form to finding your saved record.",
    kind: "Start here",
    outcome: "One saved expense you can find and edit.",
    keywords:
      "beginner getting started new account login money income spending transaction",
    sections: [
      { id: "before-you-start", title: "Before you start" },
      { id: "add-an-expense", title: "Add your expense" },
      { id: "check-your-record", title: "Check the result" },
      { id: "next-step", title: "What to do next" },
    ],
  },
  {
    slug: "transactions",
    audience: "guides",
    title: "Add or import unassigned records",
    description:
      "Enter income and spending yourself, or bring a spreadsheet into Aegis with CSV.",
    kind: "How-to guide",
    outcome:
      "Recorded transactions with the right dates, amounts and categories.",
    keywords:
      "csv file spreadsheet bank import income expense amount debit credit duplicate upload",
    sections: [
      { id: "add-one", title: "Add one record" },
      { id: "prepare-csv", title: "Prepare a CSV" },
      { id: "review-import", title: "Review and import" },
      { id: "import-help", title: "Fix common problems" },
    ],
  },
  {
    slug: "budgets",
    audience: "guides",
    title: "Set a budget or savings goal",
    description:
      "Choose a spending limit or track money saved toward something that matters.",
    kind: "How-to guide",
    outcome: "A category budget or savings target you know how to read.",
    keywords:
      "budget category remaining comparison spending savings goal contribution target housing",
    sections: [
      { id: "choose-tool", title: "Choose the right tool" },
      { id: "create-budget", title: "Set a spending budget" },
      { id: "savings-goal", title: "Track a savings goal" },
      { id: "budget-help", title: "When numbers look wrong" },
    ],
  },
  {
    slug: "plans",
    audience: "guides",
    title: "Put a plan on your calendar",
    description:
      "Give a future cost or contribution a date, and understand how plans differ from transactions.",
    kind: "How-to guide",
    outcome: "A dated plan visible in Calendar and the Gantt timeline.",
    keywords:
      "calendar timeline gantt plan planned completed progress savings recurring bill schedule",
    sections: [
      { id: "plan-or-transaction", title: "Plan or transaction?" },
      { id: "create-plan", title: "Create a dated plan" },
      { id: "review-plan", title: "Find and update it" },
      { id: "plan-help", title: "Common questions" },
    ],
  },
  {
    slug: "ai",
    audience: "guides",
    title: "Understand optional AI insights",
    description:
      "Know what AI can help with, what setup it needs, and where your data goes.",
    kind: "Explanation",
    outcome: "Know whether to enable AI and what happens when you use it.",
    keywords:
      "ai advisor provider claude anthropic groq typhoon model key settings privacy charges",
    sections: [
      { id: "without-ai", title: "Start without AI" },
      { id: "enable-ai", title: "Set up optional insights" },
      { id: "ai-data", title: "Understand data sharing" },
      { id: "ai-help", title: "If insights are unavailable" },
    ],
  },
  {
    slug: "exports",
    audience: "guides",
    title: "Export your records",
    description:
      "Download transaction data and understand what each export includes.",
    kind: "How-to guide",
    outcome:
      "A transaction CSV, with a clear understanding of what it contains.",
    keywords:
      "export download csv pdf reports data backup ndjson records privacy",
    sections: [
      { id: "download-csv", title: "Download a CSV" },
      { id: "export-scope", title: "What is included" },
      { id: "export-help", title: "If a download fails" },
    ],
  },
  {
    slug: "local-setup",
    audience: "developers",
    title: "Run Aegis locally",
    description:
      "Start the development stack with Docker, verify the backend, and find the relevant configuration.",
    kind: "Developer quickstart",
    outcome: "A local frontend and a backend that reports a healthy database.",
    keywords:
      "docker compose setup install self host hosting make dev .env database postgres redis ports migrate debug",
    sections: [
      { id: "prerequisites", title: "Prerequisites" },
      { id: "start-stack", title: "Start the stack" },
      { id: "verify-stack", title: "Verify it works" },
      { id: "configuration", title: "Configuration" },
      { id: "setup-help", title: "Troubleshooting" },
    ],
  },
  {
    slug: "api",
    audience: "developers",
    title: "Make your first API request",
    description:
      "Authenticate, read transactions, and look up request fields, pagination and errors.",
    kind: "API guide & reference",
    outcome: "An authenticated GET request and a response you can interpret.",
    keywords:
      "api rest curl auth bearer cookie token login json http 401 403 404 422 429 503 pagination limit offset endpoint schema swagger",
    sections: [
      { id: "api-basics", title: "Before your first request" },
      { id: "authenticate", title: "Authenticate" },
      { id: "read-transactions", title: "Read transactions" },
      { id: "create-transaction", title: "Create a transaction" },
      { id: "parameters", title: "Filters & pagination" },
      { id: "errors", title: "Errors & next steps" },
    ],
  },
  {
    slug: "architecture",
    audience: "developers",
    title: "Understand the codebase",
    description:
      "Find the frontend, API, database models and the boundaries between transactions, plans and goals.",
    kind: "Technical explanation",
    outcome: "Know where a request goes and which code to change.",
    keywords:
      "architecture next react fastapi sqlalchemy models database migration alembic frontend backend code contribution schema",
    sections: [
      { id: "request-path", title: "Follow a request" },
      { id: "data-model", title: "Understand the data" },
      { id: "repo-map", title: "Find the right file" },
      { id: "extension", title: "Before extending Aegis" },
    ],
  },
];
export const articles: DocArticle[] = [...originalArticles, ...additionalTopics.map(({sections,...topic})=>({...topic,sections:sections.map(({id,title})=>({id,title}))}))];
export const articleCategory = (article:DocArticle):DocCategoryId => article.category ?? legacyCategory[article.slug] ?? "start";
export const docHref = (article: DocArticle) =>
  `/docs/${article.audience}/${article.slug}`;
export const audienceLabel = (audience: Audience) =>
  audience === "guides" ? "User guide" : "Developers";
export const legacyTopics: Record<string, string> = {
  "getting-started": "/docs/guides/first-steps",
  "transactions-and-plans": "/docs/guides/plans",
  "budgets-and-goals": "/docs/guides/budgets",
  "optional-ai": "/docs/guides/ai",
  "your-data": "/docs/guides/exports",
  "self-hosting": "/docs/developers/local-setup",
  "api-reference": "/docs/developers/api",
  "common-questions": "/docs#common-tasks",
};
