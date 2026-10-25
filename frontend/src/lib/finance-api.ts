import { useAuthStore } from "@/stores/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_MINOR = BigInt("9223372036854775807");

export type Operation =
  | "expense"
  | "income"
  | "transfer"
  | "card_purchase"
  | "card_repayment"
  | "refund";
export interface FinanceAccount {
  id: string;
  name: string;
  kind: string;
  subtype: "bank" | "savings" | "cash" | "card";
  currency: "THB";
  balance_minor: string;
  opening: { cutoff_at: string; journal_id?: string | null } | null;
}
export interface AccountBalances {
  currency: "THB";
  accounts: FinanceAccount[];
  asset_balance_minor: string;
  liability_balance_minor: string;
  net_position_minor: string;
  last_reconciled_at: string | null;
}
export interface FinanceBudget {
  id: string;
  facts_hash: string;
  category: string;
  trip_id: string | null;
  period_start: string;
  period_end: string;
  currency: "THB";
  budget_currency_confirmed: boolean;
  budget_minor: string | null;
  spent_minor: string;
  remaining_minor: string | null;
  unverified_legacy_budget_amount: string | null;
  unverified_legacy_count: number;
}
export interface DraftPayload {
  type: Operation;
  amount_minor: string;
  currency: string;
  occurred_on: string;
  occurred_at?: string | null;
  date_precision: "day" | "instant";
  fee_minor?: string;
  cutoff_resolution?: "after" | null;
  source_account_id?: string | null;
  target_account_id?: string | null;
  category?: string | null;
  description?: string | null;
  trip_id?: string | null;
  tags?: string[];
  original_expense_entry_id?: string | null;
  duplicate_resolution?: "distinct" | "attach" | null;
  evidence_ids?: string[];
}
export interface TransactionDraft {
  id: string;
  version: number;
  status: string;
  payload: Partial<DraftPayload>;
  validation_errors: unknown;
  posted_journal_id: string | null;
}
export interface FinancialTransaction {
  id: string;
  journal_id?: string;
  type?: string;
  kind?: string;
  journal_entry_id?: string;
  operation_kind?: string;
  amount_minor: string;
  currency: string;
  occurred_on: string;
  description?: string | null;
  category?: string | null;
  source_account_id?: string | null;
  target_account_id?: string | null;
  original_expense_entry_id?: string | null;
  income_effect_minor?: string;
  expense_effect_minor?: string;
  account_effects?: {
    account_id: string;
    name?: string;
    subtype?: string;
    amount_minor?: string;
    signed_amount_minor?: string;
  }[];
  status?: string;
  reversal_of?: string | null;
  reversed?: boolean;
  trip_id?: string | null;
  tags?: string[];
  evidence_ids?: string[];
  source?: string;
}
export interface FinanceErrorDetail {
  code: string;
  message: string;
  field_errors?: unknown;
  retryable?: boolean;
  correlation_id?: string;
}
export interface FinanceStatementRow {
  id: string;
  stable_key: string;
  occurred_on: string;
  amount_minor: string;
  status: "posted" | "pending";
  reference?: string;
  description?: string;
  matched_journal_id: string | null;
  draft_id: string | null;
  candidate_journal_ids: string[];
}
export interface FinanceStatement {
  id: string;
  account_id: string;
  currency: string;
  opening_balance_minor: string;
  closing_balance_minor: string;
  tracked_closing_balance_minor: string | null;
  difference_minor: string | null;
  opening_available?: boolean;
  statement_arithmetic_difference_minor: string;
  reconciled: boolean;
  rows: FinanceStatementRow[];
}
export class FinanceAPIError extends Error {
  constructor(
    public status: number,
    public detail: FinanceErrorDetail,
  ) {
    super(detail.message);
    this.name = "FinanceAPIError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  responseType: "json" | "blob" = "json",
): Promise<T> {
  const origin = useAuthStore.getState();
  const checkSession = () => {
    const current = useAuthStore.getState();
    if (
      current.user !== origin.user ||
      current.token !== origin.token ||
      current.isAuthenticated !== origin.isAuthenticated
    ) {
      throw new FinanceAPIError(409, {
        code: "SESSION_CHANGED",
        message:
          "Your sign-in changed. Review the current workspace and retry.",
      });
    }
  };
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (origin.token) headers.set("Authorization", `Bearer ${origin.token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  checkSession();
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new FinanceAPIError(401, {
      code: "SESSION_EXPIRED",
      message: "Your session expired. Sign in again to continue.",
    });
  }
  const body =
    response.status === 204
      ? undefined
      : response.ok && responseType === "blob"
        ? await response.blob()
        : await response.json().catch(() => undefined);
  checkSession();
  if (!response.ok) {
    const detail = body?.detail;
    throw new FinanceAPIError(
      response.status,
      typeof detail === "object" && detail && !Array.isArray(detail)
        ? {
            ...detail,
            message: detail.message || "The request could not be completed.",
          }
        : {
            code: "REQUEST_FAILED",
            field_errors: Array.isArray(detail) ? detail : undefined,
            message:
              typeof detail === "string"
                ? detail
                : "The request could not be completed. Check the values and retry.",
          },
    );
  }
  return body as T;
}

const command = <T>(
  path: string,
  body: unknown,
  key?: string,
  method = "POST",
) =>
  request<T>(path, {
    method,
    headers: key ? { "Idempotency-Key": key } : undefined,
    body: JSON.stringify(body),
  });

export const financeAPI = {
  status: () =>
    request<{
      enabled: boolean;
      cutover_active: boolean;
      canonical_transactions_url: string;
    }>("/api/finance/status"),
  balances: () => request<AccountBalances>("/api/accounts/balances"),
  budgets: () => request<FinanceBudget[]>("/api/finance/budgets"),
  confirmBudgetCurrency: (id: string, factsHash: string) =>
    command<{ confirmed: boolean }>(
      `/api/finance/budgets/${encodeURIComponent(id)}/confirm-currency`,
      { currency: "THB", reviewed: true, expected_facts_hash: factsHash },
    ),
  createAccount: (
    body: { name: string; subtype: FinanceAccount["subtype"]; currency: "THB" },
    key: string,
  ) => command<FinanceAccount>("/api/accounts", body, key),
  openAccounts: (
    body: {
      cutoff_at: string;
      reviewed: true;
      accounts: { account_id: string; signed_balance_minor: string }[];
    },
    key: string,
  ) => command<unknown>("/api/accounts/opening-balances", body, key),
  drafts: () => request<TransactionDraft[]>("/api/transaction-drafts"),
  createDraft: (body: DraftPayload) =>
    command<TransactionDraft>("/api/transaction-drafts", body),
  editDraft: (id: string, version: number, patch: DraftPayload) =>
    command<TransactionDraft>(
      `/api/transaction-drafts/${encodeURIComponent(id)}`,
      { expected_version: version, patch },
      undefined,
      "PATCH",
    ),
  confirmDraft: (id: string, version: number, key: string) =>
    command<unknown>(
      `/api/transaction-drafts/${encodeURIComponent(id)}/confirm`,
      { expected_version: version },
      key,
    ),
  cancelDraft: (id: string, version: number) =>
    command<TransactionDraft>(
      `/api/transaction-drafts/${encodeURIComponent(id)}/cancel`,
      { expected_version: version },
    ),
  transactions: () =>
    request<FinancialTransaction[]>("/api/financial-transactions"),
  correctTransaction: (
    id: string,
    body: {
      correction_effective_on: string;
      cutoff_resolution?: "after" | "before" | null;
      reason: string;
      replacement: DraftPayload | null;
    },
    key: string,
  ) =>
    command<unknown>(
      `/api/financial-transactions/${encodeURIComponent(id)}/corrections`,
      body,
      key,
    ),
  classifyTransaction: (
    id: string,
    body: {
      category: string;
      trip_id: string | null;
      tags: string[];
      reason: string;
    },
    key: string,
  ) =>
    command<unknown>(
      `/api/financial-transactions/${encodeURIComponent(id)}/classification`,
      body,
      key,
      "PATCH",
    ),
  lineStatus: () =>
    request<{
      enabled: boolean;
      configured: boolean;
      delivery_enabled: boolean;
      linked: boolean;
      linked_at: string | null;
      setup_lifetime_seconds: number;
      web_session_lifetime_seconds: number;
      pending_jobs: number;
      delivery: Record<string, number>;
    }>("/api/integrations/line/status"),
  createLineChallenge: () =>
    command<{
      command: string;
      expires_in_seconds: number;
      expires_at: string;
      bot_basic_id: string | null;
      line_url: string | null;
      qr_image_data_url: string | null;
    }>(
      "/api/integrations/line/link-challenges",
      {},
    ),
  disconnectLine: () =>
    request<void>("/api/integrations/line/link", { method: "DELETE" }),
  sendLinePreview: (id: string) =>
    command<{ queued: boolean; version: number }>(
      `/api/integrations/line/drafts/${encodeURIComponent(id)}/preview`,
      {},
    ),
  evidence: (id: string) =>
    request<Blob>(
      `/api/integrations/evidence/${encodeURIComponent(id)}`,
      undefined,
      "blob",
    ),
  statements: (accountId: string) =>
    request<
      {
        id: string;
        account_id: string;
        period_start: string;
        period_end: string;
        closing_balance_minor: string;
      }[]
    >(`/api/finance/statements?account_id=${encodeURIComponent(accountId)}`),
  statement: (id: string) =>
    request<FinanceStatement>(
      `/api/finance/statements/${encodeURIComponent(id)}`,
    ),
  importStatement: (body: {
    account_id: string;
    request_key: string;
    period_start: string;
    period_end: string;
    opening_balance_minor: string;
    closing_balance_minor: string;
    rows: {
      stable_key: string;
      occurred_on: string;
      amount_minor: string;
      status: "posted" | "pending";
      reference?: string;
      description?: string;
    }[];
  }) => command<FinanceStatement>("/api/finance/statements", body),
  matchStatementRow: (id: string, row: string, journal: string) =>
    command<unknown>(
      `/api/finance/statements/${encodeURIComponent(id)}/rows/${encodeURIComponent(row)}/match`,
      { journal_id: journal },
    ),
  draftStatementRow: (
    id: string,
    row: string,
    body: {
      type: Operation;
      keep_distinct?: boolean;
      counterparty_account_id?: string | null;
      original_expense_entry_id?: string | null;
      category?: string;
    },
  ) =>
    command<TransactionDraft>(
      `/api/finance/statements/${encodeURIComponent(id)}/rows/${encodeURIComponent(row)}/draft`,
      body,
    ),
};

/** Convert decimal text directly to satang. No binary floating-point conversion. */
export function parseTHB(value: string, signed = false): string {
  const normalized = value.trim();
  if (
    !(signed ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/).test(normalized)
  ) {
    throw new Error(
      "Enter a THB amount with at most two decimal places, without commas.",
    );
  }
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace(/^-/, "").split(".");
  const absolute =
    BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const amount = negative ? -absolute : absolute;
  if (amount > MAX_MINOR || amount < -MAX_MINOR - BigInt(1))
    throw new Error("This amount exceeds the supported exact-money limit.");
  if (!signed && amount <= BigInt(0))
    throw new Error("Amount must be greater than zero.");
  return amount.toString();
}

export function minorToInput(value: string): string {
  const amount = BigInt(value);
  const absolute = amount < BigInt(0) ? -amount : amount;
  return `${amount < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
}

export function formatTHB(value: string): string {
  try {
    const amount = BigInt(value);
    const absolute = amount < BigInt(0) ? -amount : amount;
    return `${amount < BigInt(0) ? "−" : ""}฿${new Intl.NumberFormat("en-TH").format(absolute / BigInt(100))}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
  } catch {
    return "Amount unavailable";
  }
}

export function formatLedgerAmount(value: string, currency?: string): string {
  return currency === "THB"
    ? formatTHB(value)
    : `${value} minor units · ${currency || "currency unresolved"}`;
}

export function financeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not complete this request. Please retry.";
}

export function newCommandKey(): string {
  return crypto.randomUUID();
}
