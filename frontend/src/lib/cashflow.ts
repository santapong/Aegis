import { fetchJSON } from "./api";
export interface Workspace {
  id: string;
  name: string;
  kind: "personal" | "business";
  currency: string;
  timezone: string;
  buffer: string;
  revision: number;
  week_start: number;
}
export interface Account {
  id: string;
  name: string;
  kind: string;
  archived: boolean;
  currency: string;
}
export interface Movement {
  id: string;
  account_id: string;
  amount: string;
  direction: "income" | "expense";
  date: string;
  title: string;
  cash_reversal_of_id: string | null;
}
export interface Occurrence {
  id: string;
  commitment_id: string;
  account_id: string;
  title: string;
  direction: "income" | "expense";
  amount: string;
  nominal_date: string;
  schedule_slot: number;
  expected_date: string;
  due_date: string | null;
  cancelled: boolean;
  remaining?: string;
  settled?: string;
}
export interface Settlement {
  id: string;
  transaction_id: string;
  occurrence_id: string;
  amount: string;
  reversed: boolean;
}
export interface Scenario {
  id: string;
  name: string;
  base_revision: number;
  changes: {
    dates: { occurrence_id: string; expected_date: string }[];
    extras: {
      account_id: string;
      title: string;
      direction: string;
      amount: string;
      date: string;
    }[];
  };
}
export interface CashState {
  workspace: Workspace;
  accounts: Account[];
  balance_anchors: {
    id: string;
    account_id: string;
    amount: string;
    date: string;
    source: string;
  }[];
  movements: Movement[];
  occurrences: Occurrence[];
  commitments: Commitment[];
  transfers: Transfer[];
  goal_allocations: GoalAllocation[];
  installment_schedules: {
    id: string;
    commitment_id: string;
    debt_id: string | null;
    name: string;
  }[];
  settlements: Settlement[];
  business_documents: Pick<
    BusinessDocument,
    "id" | "commitment_id" | "counterparty" | "reference"
  >[];
  scenarios: Scenario[];
  legacy_count: number;
  legacy_excluded: boolean;
  audit: {
    id: string;
    operation: string;
    revision: number;
    created_at: string;
    result: Record<string, unknown>;
  }[];
}
export interface Day {
  date: string;
  cash: string;
  incoming: string;
  outgoing: string;
  headroom: string;
  events: Occurrence[];
}
export interface Result {
  engine_version: string;
  history: { date: string; cash: string | null }[];
  complete: boolean;
  warnings: string[];
  as_of: string;
  end: string;
  cash_today: string | null;
  closing_cash: string | null;
  headroom: string | null;
  buffer: string;
  reserved_cash: string;
  minimum: { date: string; cash: string } | null;
  first_negative_date: string | null;
  first_below_buffer_date: string | null;
  first_reserved_gap_date: string | null;
  days: Day[];
  planned: Occurrence[];
  later: Occurrence[];
  unresolved: Occurrence[];
  actual_events: (Movement & { cash_effect: string; kind: string })[];
  expected_incoming: string;
  expected_outgoing: string;
  limit: string;
}
export interface Forecast {
  workspace_id: string;
  currency: string;
  timezone: string;
  revision: number;
  base_revision: number;
  account_ids: string[];
  base: Result;
  scenario: Result | null;
  scenario_stale: boolean;
}
export const cashAPI = {
  workspaces: () => fetchJSON<Workspace[]>("/api/cash/workspaces"),
  state: (id: string) =>
    fetchJSON<CashState>(`/api/cash/workspaces/${encodeURIComponent(id)}`),
  createWorkspace: (body: unknown) =>
    fetchJSON<Workspace>("/api/cash/workspaces", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mutate: <T extends { revision: number }>(
    id: string,
    path: string,
    body: unknown,
  ) =>
    fetchJSON<T>(`/api/cash/workspaces/${encodeURIComponent(id)}/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forecast: (
    id: string,
    asOf: string,
    end: string,
    scenario: string,
    accounts: string[],
  ) => {
    const p = new URLSearchParams({ workspace_id: id, as_of: asOf, end });
    if (scenario) p.set("scenario_id", scenario);
    accounts.forEach((a) => p.append("account_ids", a));
    return fetchJSON<Forecast>("/api/cash/forecast?" + p);
  },
  legacy: () => fetchJSON<Movement[]>("/api/cash/legacy"),
  preview: (id: string, body: unknown) =>
    fetchJSON<{
      revision: number;
      remaining_before: string;
      remaining_after: string;
      unallocated_before: string;
      cash_effect: string;
      message: string;
    }>(`/api/cash/workspaces/${encodeURIComponent(id)}/settlements/preview`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export interface Commitment {
  id: string;
  title: string;
  cancelled: boolean;
  account_id: string;
  amount: string;
  recurrence: string;
  interval_every: number;
  recurrence_days: number[] | null;
  start_date: string;
  end_date: string | null;
  generated_through: string | null;
}
export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  date: string;
  description: string;
}
export interface GoalAllocation {
  id: string;
  account_id: string;
  name: string;
  amount: string;
  mode: "reserved" | "transferred";
  goal_id: string | null;
  transfer_id: string | null;
  released: boolean;
}
export interface ImportBatch {
  id: string;
  account_id: string;
  filename: string;
  currency: string;
  created_at: string;
  row_count: number;
  imported_count: number;
  invalid_count: number;
}
export interface ImportRow {
  id: string;
  row_number: number;
  status: "pending" | "invalid" | "imported";
  raw: Record<string, string>;
  payload: (Movement & { reference: string }) | null;
  errors: string[];
  transaction_id: string | null;
  possible_duplicates: {
    id: string;
    kind: string;
    title?: string;
    date?: string;
    amount?: string;
    reference?: string;
    row_number?: number;
  }[];
  candidate_matches: {
    id: string;
    title: string;
    expected_date: string;
    remaining: string;
    suggested_amount: string;
  }[];
}
export interface CashAlert {
  id: string;
  kind: string;
  event_date: string | null;
  base_revision: number;
  acknowledged: boolean;
  resolved_at: string | null;
  detected_at: string;
  details: {
    currency: string;
    account_ids: string[];
    as_of: string;
    end: string;
    cash?: string;
    cash_today?: string;
    buffer?: string;
    reserved_cash?: string;
    cash_known?: boolean;
    sources?: Occurrence[];
    reservations?: GoalAllocation[];
    recorded_sources?: (Movement & { kind: string; cash_effect: string })[];
    opening_balances?: {
      account_id: string;
      amount: string;
      date: string;
      source: string;
    }[];
    warnings: string[];
    assumption?: string;
  };
}
export interface AlertReview {
  scope: {
    id: string;
    base_revision: number;
    evaluated_at: string;
    as_of: string;
    end: string;
    account_ids: string[];
  } | null;
  alerts: CashAlert[];
  current_base_revision: number;
  needs_evaluation: boolean;
  input_fingerprint: string;
}
const cashPath = (wid: string) =>
  `/api/cash/workspaces/${encodeURIComponent(wid)}`;
export const everydayAPI = {
  imports: (wid: string) =>
    fetchJSON<ImportBatch[]>(`${cashPath(wid)}/imports`),
  import: (wid: string, bid: string) =>
    fetchJSON<{
      batch: ImportBatch;
      rows: ImportRow[];
      revision: number;
      message: string;
    }>(`${cashPath(wid)}/imports/${encodeURIComponent(bid)}`),
  purposeSources: (wid: string) =>
    fetchJSON<{
      goals: { id: string; name: string }[];
      debts: { id: string; name: string }[];
      message: string;
    }>(`${cashPath(wid)}/purpose-sources`),
  alerts: (wid: string, asOf: string, end: string, accounts: string[]) => {
    const p = new URLSearchParams({ as_of: asOf, end });
    accounts.forEach((id) => p.append("account_ids", id));
    return fetchJSON<AlertReview>(`${cashPath(wid)}/alerts?${p}`);
  },
};

export interface BusinessDocument {
  id: string;
  commitment_id: string;
  occurrence_id: string;
  account_id: string;
  currency: string;
  kind: "receivable" | "bill";
  counterparty: string;
  reference: string;
  original_amount: string;
  effective_amount: string;
  credited_amount: string;
  matched_amount: string;
  remaining_amount: string;
  projected_remaining: string;
  due_date: string;
  expected_date: string;
  status: "open" | "settled" | "credited" | "cancelled";
  overdue_days: number;
  needs_expected_date_review: boolean;
  cancellation_reason: string | null;
  adjustments: { id: string; amount: string; reason: string }[];
  settlements: Settlement[];
}
export interface BusinessWeeks extends Forecast {
  week_start: number;
  weeks: {
    week_start: string;
    week_end: string;
    covered_from: string;
    partial: boolean;
    closing_cash: string | null;
    minimum: { date: string; cash: string } | null;
    incoming: string;
    outgoing: string;
    days: Day[];
  }[];
}
export interface ForecastSnapshot {
  id: string;
  name: string;
  as_of: string;
  end: string;
  base_revision: number;
  engine_version: string;
  account_ids: string[];
  source_hash: string;
  created_at: string;
}
export interface ForecastVariance {
  snapshot_id: string;
  snapshot_name: string;
  source_hash: string;
  as_of: string;
  end: string;
  reviewed_through: string;
  account_ids: string[];
  currency: string;
  known: boolean;
  expected_cash: string | null;
  recorded_cash: string | null;
  difference: string | null;
  components: Record<string, string | null>;
  sources: {
    source_id: string;
    title: string;
    saved_expected_date?: string;
    reviewed_expected_date?: string;
    saved_remaining?: string;
    reviewed_effective_amount?: string;
    matched_cash_change?: string;
    amount_change?: string;
    timing_or_unpaid?: string;
    kind?: string;
    cash_change?: string;
  }[];
  saved_anchors: CashState["balance_anchors"];
  reviewed_anchors: CashState["balance_anchors"];
  saved_closing_cash: string | null;
  reviewed_closing_cash: string | null;
  warnings: string[];
  assumption: string;
  reviewed_forecast: Forecast;
}
export const businessAPI = {
  documents: (wid: string, asOf: string, offset = 0) =>
    fetchJSON<{
      documents: BusinessDocument[];
      offset: number;
      has_more: boolean;
    }>(
      `${cashPath(wid)}/business/documents?` +
        new URLSearchParams({ as_of: asOf, offset: String(offset) }),
    ),
  weeks: (wid: string, asOf: string, accounts: string[]) => {
    const p = new URLSearchParams({ as_of: asOf });
    accounts.forEach((id) => p.append("account_ids", id));
    return fetchJSON<BusinessWeeks>(`${cashPath(wid)}/business/weeks?${p}`);
  },
  snapshots: (wid: string) =>
    fetchJSON<ForecastSnapshot[]>(`${cashPath(wid)}/business/snapshots`),
  variance: (wid: string, sid: string, through: string) =>
    fetchJSON<ForecastVariance>(
      `${cashPath(wid)}/business/snapshots/${encodeURIComponent(sid)}/variance?` +
        new URLSearchParams({ reviewed_through: through }),
    ),
};
