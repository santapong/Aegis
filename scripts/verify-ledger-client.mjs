// Exact-money and authenticated-command boundary checks; no live financial data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const ts = require("typescript");
let state = {
  user: { id: "fictional-owner" },
  token: null,
  isAuthenticated: true,
  logout() {
    this.isAuthenticated = false;
  },
};
let fakeFetch;
function load(path, modules = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name) => {
      if (Object.hasOwn(modules, name)) return modules[name];
      if (name === "@/stores/auth-store")
        return { useAuthStore: { getState: () => state } };
      throw new Error(`Unexpected client import ${name}`);
    },
    process: { env: {} },
    Headers,
    URL,
    URLSearchParams,
    crypto,
    fetch: (...args) => fakeFetch(...args),
  });
  return exports;
}
const {
  parseTHB,
  minorToInput,
  formatTHB,
  formatLedgerAmount,
  financeAPI,
  FinanceAPIError,
} = load("../frontend/src/lib/finance-api.ts");
const { safeAuthReturn } = load("../frontend/src/lib/auth-return.ts");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { KPICards } = load(
  "../frontend/src/components/dashboard/kpi-cards.tsx",
  {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "framer-motion": require("framer-motion"),
    "@/lib/finance-api": { formatTHB },
    "@/lib/utils": { formatCurrency: (value) => `Legacy ${value}` },
    "@/lib/animations": { staggerContainer: {}, staggerItem: {} },
  },
);

assert.equal(parseTHB("150.25"), "15025");
assert.equal(parseTHB("0.01"), "1");
assert.equal(parseTHB("92233720368547758.07"), "9223372036854775807");
assert.equal(parseTHB("-92233720368547758.08", true), "-9223372036854775808");
assert.equal(parseTHB("00020.5"), "2050");
assert.equal(parseTHB("-0.00", true), "0");
for (const value of [
  "0",
  "-1",
  "0.001",
  "1,000.00",
  "NaN",
  "Infinity",
  "1e2",
  "92233720368547758.08",
])
  assert.throws(() => parseTHB(value));
assert.throws(() => parseTHB("-92233720368547758.09", true));
assert.equal(minorToInput("9223372036854775807"), "92233720368547758.07");
assert.equal(minorToInput("-1"), "-0.01");
assert.equal(formatTHB("9223372036854775807"), "฿92,233,720,368,547,758.07");
assert.equal(formatTHB("-105"), "−฿1.05");
assert.equal(formatLedgerAmount("100", "USD"), "100 minor units · USD");
const legacySummary = {
  total_balance: 999,
  monthly_income: 777,
  monthly_expenses: 555,
  savings_rate: 10,
  active_plans: 0,
  completed_plans: 0,
};
const ledgerCards = renderToStaticMarkup(
  React.createElement(KPICards, {
    data: {
      ...legacySummary,
      net_position_minor: "9223372036854775807",
      monthly_income_minor: "12345",
      monthly_expenses_minor: "105",
    },
  }),
);
assert.ok(ledgerCards.includes("฿92,233,720,368,547,758.07"));
assert.ok(ledgerCards.includes("฿123.45"));
assert.ok(ledgerCards.includes("฿1.05"));
assert.ok(ledgerCards.includes("Net position"));
assert.ok(!ledgerCards.includes("Legacy 999") && !ledgerCards.includes("<svg"));
const legacyCards = renderToStaticMarkup(
  React.createElement(KPICards, { data: legacySummary }),
);
assert.ok(
  legacyCards.includes("Legacy 999") &&
    legacyCards.includes("Total balance") &&
    legacyCards.includes("<svg"),
);
assert.equal(
  safeAuthReturn("/review?draft=fictional-id"),
  "/review?draft=fictional-id",
);
assert.equal(safeAuthReturn("/accounts"), "/accounts");
assert.equal(
  safeAuthReturn("/review?draft=fictional-id&redirect=https://outside.invalid"),
  "/review?draft=fictional-id",
);
for (const value of [
  "https://outside.invalid",
  "//outside.invalid",
  "/\\outside.invalid",
  "/unknown",
  "/login",
  "/review\n",
  "/%2f%2foutside.invalid",
])
  assert.equal(safeAuthReturn(value), "/");

let observed;
fakeFetch = async (url, init) => {
  observed = { url, init };
  return Response.json({ id: "fictional-account" });
};
await financeAPI.createAccount(
  { name: "Fictional cash", subtype: "cash", currency: "THB" },
  "stable-retry-key",
);
assert.equal(observed.init.credentials, "include");
assert.equal(observed.init.headers.get("Idempotency-Key"), "stable-retry-key");
assert.equal(observed.init.headers.has("Authorization"), false);
fakeFetch = async (url, init) => {
  observed = { url, init };
  return Response.json({ status: "posted" });
};
await financeAPI.confirmDraft("fictional-draft", 7, "same-confirm-key");
assert.deepEqual(JSON.parse(observed.init.body), { expected_version: 7 });
assert.equal(observed.init.headers.get("Idempotency-Key"), "same-confirm-key");
await financeAPI.classifyTransaction(
  "fictional-journal",
  {
    category: "food",
    trip_id: null,
    tags: [],
    reason: "Fictional reviewed classification",
  },
  "same-classification-key",
);
assert.equal(observed.init.method, "PATCH");
assert.equal(
  observed.init.headers.get("Idempotency-Key"),
  "same-classification-key",
);
fakeFetch = async () =>
  Response.json(
    {
      detail: {
        code: "STALE_DRAFT",
        message: "Review the newest version.",
        correlation_id: "fictional-reference",
      },
    },
    { status: 409 },
  );
await assert.rejects(
  financeAPI.drafts(),
  (error) =>
    error instanceof FinanceAPIError &&
    error.status === 409 &&
    error.detail.code === "STALE_DRAFT",
);
fakeFetch = async () => ({
  status: 200,
  ok: true,
  async json() {
    state = { ...state, user: { id: "different-owner" } };
    return [];
  },
});
await assert.rejects(
  financeAPI.drafts(),
  (error) => error.detail.code === "SESSION_CHANGED",
);
fakeFetch = async () => Response.json({}, { status: 401 });
await assert.rejects(
  financeAPI.drafts(),
  (error) => error.detail.code === "SESSION_EXPIRED",
);
assert.equal(state.isAuthenticated, false);
console.log(
  "Ledger client checks passed: exact amounts and int64 limits, safe login returns, cookie/auth boundaries, retry keys, version-only confirms, structured errors and session-change rejection.",
);
