"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AegisMark } from "@/components/brand";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { APIError } from "@/lib/api";
import {
  cashAPI,
  type CashState,
  type Movement,
  type Occurrence,
  type Scenario,
  type Workspace,
} from "@/lib/cashflow";
import styles from "./workspace.module.css";
import ImportReview from "./import-review";
import PlanReview from "./plan-review";
import PurposeReview from "./purpose-review";
import CashAlerts from "./cash-alerts";
import BusinessReview from "./business-review";
import type { CashDraft } from "./everyday-common";
const ForecastChart = dynamic(() => import("./forecast-chart"), {
  ssr: false,
  loading: () => <p>Loading the cash chart…</p>,
});
const views = [
  "Overview",
  "Money calendar",
  "Scenarios",
  "Review & match",
  "Upcoming plans",
  "Goals & installments",
  "Accounts",
  "Business review",
] as const;
type View = (typeof views)[number];
type Draft = Record<string, string>;
type UI = {
  view: View;
  asOf: string;
  end: string;
  scenario: string;
  accounts: string[];
  day: string;
  drafts: Record<string, Draft>;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
function today(zone = "Asia/Bangkok") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function plusDays(s: string, n: number) {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function defaults(zone = "Asia/Bangkok"): UI {
  const start = today(zone);
  return {
    view: "Overview",
    asOf: start,
    end: plusDays(start, 30),
    scenario: "",
    accounts: [],
    day: start,
    drafts: {},
  };
}

export default function CashWorkspace() {
  const ownerId = useAuthStore((s) => s.user?.id);
  return <OwnerCashWorkspace key={ownerId || "signed-out"} />;
}

function OwnerCashWorkspace() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [active, setActive] = useState("");
  const [interfaces, setInterfaces] = useState<Record<string, UI>>({});
  const [modal, setModal] = useState("");
  const [globalDraft, setGlobalDraft] = useState<Draft>({
    name: "",
    kind: "personal",
    currency: "THB",
    buffer: "5000",
    week_start: "0",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof cashAPI.preview>
  > | null>(null);
  const [legacySelection, setLegacySelection] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const requests = useRef(
    new Map<string, { revision: number; request_key: string }>(),
  );
  const creator = useRef<{ key: string; payload: string } | null>(null);
  const revision = useRef(0);
  const workspaces = useQuery({
    queryKey: ["cash", userId, "workspaces"],
    queryFn: cashAPI.workspaces,
    enabled: !!userId,
    staleTime: 0,
  });
  const wid = active || workspaces.data?.[0]?.id || "";
  const workspaceZone =
    workspaces.data?.find((w) => w.id === wid)?.timezone || "Asia/Bangkok";
  const ui = interfaces[wid] || defaults(workspaceZone);
  function update(patch: Partial<UI>) {
    setInterfaces((old) => ({
      ...old,
      [wid]: { ...(old[wid] || defaults(workspaceZone)), ...patch },
    }));
  }
  function saveEverydayDraft(
    kind: string,
    updater: (old: CashDraft) => CashDraft,
  ) {
    setInterfaces((old) => {
      const current = old[wid] || defaults(workspaceZone);
      return {
        ...old,
        [wid]: {
          ...current,
          drafts: {
            ...current.drafts,
            [kind]: updater(current.drafts[kind] || {}),
          },
        },
      };
    });
  }
  const stateQuery = useQuery({
    queryKey: ["cash", userId, "state", wid],
    queryFn: () => cashAPI.state(wid),
    enabled: !!userId && !!wid,
    staleTime: 0,
  });
  const state = stateQuery.data;
  if (state) revision.current = state.workspace.revision;
  const forecastQuery = useQuery({
    queryKey: [
      "cash",
      userId,
      "forecast",
      wid,
      ui.asOf,
      ui.end,
      ui.scenario,
      ui.accounts,
      state?.workspace.revision,
    ],
    queryFn: () =>
      cashAPI.forecast(wid, ui.asOf, ui.end, ui.scenario, ui.accounts),
    enabled: !!userId && !!state && !!ui.asOf && !!ui.end,
    staleTime: 0,
  });
  const forecast = forecastQuery.data;
  const result = forecast?.scenario || forecast?.base;
  const currency = state?.workspace.currency || "THB";
  const amount = (value: string | null | undefined, numbersOnly = false) =>
    value == null
      ? "—"
      : new Intl.NumberFormat("en", {
          ...(numbersOnly ? {} : { style: "currency", currency }),
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(value));
  const draft = ui.drafts[modal] || {};
  const transferWorkspace = draft.to_workspace_id || wid;
  const targetState = useQuery({
    queryKey: ["cash", userId, "state", transferWorkspace],
    queryFn: () => cashAPI.state(transferWorkspace),
    enabled: !!userId && modal === "transfer" && !!transferWorkspace,
    staleTime: 0,
  });
  const targetAccounts =
    (transferWorkspace === wid ? state : targetState.data)?.accounts.filter(
      (a) => !a.archived,
    ) || [];
  function draftField(name: string, value: string) {
    setInterfaces((old) => {
      const current = old[wid] || defaults(workspaceZone);
      return {
        ...old,
        [wid]: {
          ...current,
          drafts: {
            ...current.drafts,
            [modal]: { ...current.drafts[modal], [name]: value },
          },
        },
      };
    });
    setPreview(null);
  }
  function open(kind: string, initial: Draft = {}) {
    setError("");
    setPreview(null);
    const previous = ui.drafts[kind] || {};
    const changedTarget = Object.entries(initial).some(
      ([key, value]) =>
        key.endsWith("_id") &&
        previous[key] !== undefined &&
        previous[key] !== value,
    );
    const saved = changedTarget ? { ...initial } : { ...previous };
    for (const [key, value] of Object.entries(initial)) {
      if (key.endsWith("_id") || !(key in saved)) saved[key] = value;
    }
    update({ drafts: { ...ui.drafts, [kind]: saved } });
    setModal(kind);
  }
  useEffect(() => {
    if (modal && dialog.current) {
      if (!dialog.current.open) dialog.current.showModal();
      dialog.current
        .querySelector<HTMLElement>("input, select, button[type=submit]")
        ?.focus();
    }
    if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  const baseRevision = state?.workspace.revision;
  useEffect(() => {
    setPreview(null);
  }, [baseRevision]);
  async function mutate<T extends { revision: number }>(
    path: string,
    payload: Record<string, unknown> = {},
    override?: number,
  ): Promise<T> {
    const fingerprint = wid + path + JSON.stringify(payload);
    let stamp = requests.current.get(fingerprint);
    if (!stamp) {
      stamp = {
        revision: override ?? revision.current,
        request_key: crypto.randomUUID(),
      };
      requests.current.set(fingerprint, stamp);
    }
    try {
      const response = await cashAPI.mutate<T>(wid, path, {
        ...payload,
        ...stamp,
      });
      revision.current = response.revision;
      requests.current.delete(fingerprint);
      await queryClient.invalidateQueries({ queryKey: ["cash", userId] });
      return response;
    } catch (e) {
      if (e instanceof APIError && e.status === 409) {
        requests.current.delete(fingerprint);
        await queryClient.invalidateQueries({
          queryKey: ["cash", userId, "state", wid],
        });
      }
      throw e;
    }
  }
  async function run(action: () => Promise<void>) {
    setError("");
    setNotice("");
    setPending(true);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof APIError
          ? typeof e.detail === "string"
            ? e.detail
            : e.message
          : e instanceof Error
            ? e.message
            : "Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  const accountId =
    draft.account_id || state?.accounts.find((a) => !a.archived)?.id || "";
  const field = (
    label: string,
    name: string,
    defaultValue = "",
    type = "text",
    required = true,
  ) => (
    <label className={styles.field}>
      {label}
      <input
        type={type}
        value={draft[name] ?? defaultValue}
        required={required}
        onChange={(e) => draftField(name, e.target.value)}
        onInput={(e) => {
          if (type === "date") draftField(name, e.currentTarget.value);
        }}
        maxLength={type === "text" ? 255 : undefined}
      />
    </label>
  );
  const moneyField = (
    label: string,
    name: string,
    defaultValue = "",
    negative = false,
  ) => (
    <label className={styles.field}>
      {label} · {currency}
      <input
        inputMode="decimal"
        value={draft[name] ?? defaultValue}
        required
        pattern={
          negative
            ? "-?[0-9]{1,10}(\\.[0-9]{1,2})?"
            : "[0-9]{1,10}(\\.[0-9]{1,2})?"
        }
        onChange={(e) => draftField(name, e.target.value)}
      />
    </label>
  );
  const accountSelect = (name = "account_id", label = "Cash account") => (
    <label className={styles.field}>
      {label}
      <select
        required
        value={draft[name] || accountId}
        onChange={(e) => draftField(name, e.target.value)}
      >
        {state?.accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
    </label>
  );
  const matched = (id: string) =>
    state?.settlements
      .filter((s) => !s.reversed && s.occurrence_id === id)
      .reduce((sum, s) => sum + Number(s.amount), 0) || 0;
  const outstanding = (o: Occurrence) =>
    Math.max(0, Number(o.amount) - matched(o.id));
  const unpaid =
    state?.occurrences.filter((o) => !o.cancelled && outstanding(o) > 0) || [];
  const available = (t: Movement) =>
    Number(t.amount) -
    (state?.settlements
      .filter((s) => !s.reversed && s.transaction_id === t.id)
      .reduce((sum, s) => sum + Number(s.amount), 0) || 0);
  const matchable =
    state?.movements.filter(
      (t) =>
        !t.cash_reversal_of_id &&
        !state.movements.some((x) => x.cash_reversal_of_id === t.id) &&
        available(t) > 0,
    ) || [];
  const tx = matchable.find(
    (t) => t.id === (draft.transaction_id || matchable[0]?.id),
  );
  const candidates = unpaid.filter(
    (o) => o.direction === tx?.direction && o.account_id === tx?.account_id,
  );
  const occurrenceId = draft.occurrence_id || candidates[0]?.id || "";
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (modal === "workspace") {
        const payload = JSON.stringify(globalDraft);
        if (!creator.current || creator.current.payload !== payload)
          creator.current = { key: crypto.randomUUID(), payload };
        const w = await cashAPI.createWorkspace({
          ...globalDraft,
          week_start: Number(globalDraft.week_start || 0),
          request_key: creator.current.key,
        });
        creator.current = null;
        await queryClient.invalidateQueries({
          queryKey: ["cash", userId, "workspaces"],
        });
        setActive(w.id);
        setModal("");
        setNotice(
          "Workspace created. Add a cash account and its reviewed opening balance.",
        );
        return;
      }
      if (modal === "account") {
        const a = await mutate<{ id: string; revision: number }>("accounts", {
          name: draft.name,
          kind: draft.kind || "bank",
        });
        update({
          drafts: {
            ...ui.drafts,
            account: {},
            anchor: { account_id: a.id, date: ui.asOf, source: "" },
          },
        });
        setModal("anchor");
        return;
      }
      if (modal === "anchor")
        await mutate("anchors", {
          account_id: accountId,
          amount: draft.amount,
          date: draft.date || ui.asOf,
          source: draft.source,
        });
      if (modal === "movement")
        await mutate("movements", {
          account_id: accountId,
          title: draft.title,
          amount: draft.amount,
          direction: draft.direction || "expense",
          date: draft.date || today(state?.workspace.timezone),
          ...(draft.match_occurrence
            ? { occurrence_id: draft.match_occurrence }
            : {}),
        });
      if (modal === "commitment")
        await mutate("commitments", {
          account_id: accountId,
          title: draft.title,
          amount: draft.amount,
          direction: draft.direction || "expense",
          start_date: draft.date || plusDays(ui.asOf, 1),
          due_date:
            !draft.recurrence || draft.recurrence === "once"
              ? draft.due_date || null
              : null,
          recurrence: draft.recurrence || "once",
          interval_every: Number(draft.every || "1"),
          ...(draft.recurrence === "split"
            ? {
                recurrence_days: (draft.days || "")
                  .split(",")
                  .map((x) => Number(x.trim())),
              }
            : {}),
          weekend_rule: draft.weekend_rule || "strict",
          end_date: draft.end_date || null,
        });
      if (modal === "transfer") {
        if (!targetAccounts.length || !targetState.data)
          throw new Error("Choose a reviewed destination cash account.");
        await mutate("transfers", {
          from_account_id: draft.from_account_id || accountId,
          to_account_id:
            draft.to_account_id ||
            targetAccounts.find((a) => a.id !== accountId)?.id,
          amount: draft.amount,
          date: draft.date || today(state?.workspace.timezone),
          description: draft.title,
          ...(transferWorkspace !== wid
            ? { to_workspace_revision: targetState.data.workspace.revision }
            : {}),
        });
        await queryClient.invalidateQueries({ queryKey: ["cash", userId] });
      }
      if (modal === "buffer") await mutate("buffer", { buffer: draft.amount });
      if (modal === "reschedule")
        await mutate("occurrences/" + draft.occurrence_id, {
          expected_date: draft.date,
        });
      if (modal === "scenario") {
        const dates = [1, 2].flatMap((i) =>
          draft["occurrence" + i] && draft["date" + i]
            ? [
                {
                  occurrence_id: draft["occurrence" + i],
                  expected_date: draft["date" + i],
                },
              ]
            : [],
        );
        const extras = draft.extra_amount
          ? [
              {
                account_id: accountId,
                title: draft.extra_title || "One-off cost",
                direction: "expense",
                amount: draft.extra_amount,
                date: draft.extra_date || plusDays(ui.asOf, 1),
              },
            ]
          : [];
        if (!dates.length && !extras.length)
          throw new Error(
            "Add an expected-date change or an extra cost before saving a comparison.",
          );
        if (
          [1, 2].some((i) => !!draft["occurrence" + i] !== !!draft["date" + i])
        )
          throw new Error(
            "Choose both the commitment and its new expected date.",
          );
        const s = await mutate<Scenario & { revision: number }>("scenarios", {
          name: draft.name,
          dates,
          extras,
        });
        update({
          scenario: s.id,
          view: "Scenarios",
          drafts: { ...ui.drafts, scenario: {} },
        });
        setModal("");
        setNotice(
          "Scenario saved. Recorded cash and base commitments are unchanged.",
        );
        return;
      }
      if (modal === "match") {
        if (!preview) {
          setPreview(
            await cashAPI.preview(wid, {
              transaction_id: tx?.id,
              occurrence_id: occurrenceId,
              amount: draft.amount || tx?.amount,
            }),
          );
          return;
        }
        await mutate(
          "settlements",
          {
            transaction_id: tx?.id,
            occurrence_id: occurrenceId,
            amount: draft.amount || tx?.amount,
          },
          preview.revision,
        );
      }
      if (modal === "legacy") {
        if (!legacySelection.length)
          throw new Error(
            "Select records after reviewing their amount, currency and account.",
          );
        await mutate("legacy/adopt", {
          account_id: accountId,
          transaction_ids: legacySelection,
          confirmed_currency: draft.confirmed_currency || currency,
        });
        setLegacySelection([]);
        await queryClient.invalidateQueries({
          queryKey: ["cash", userId, "legacy"],
        });
      }
      if (modal === "exclude") await mutate("legacy/exclude");
      if (modal === "reverse")
        await mutate("movements/" + draft.transaction_id + "/reverse");
      if (modal === "unmatch")
        await mutate("settlements/" + draft.settlement_id + "/reverse");
      if (modal === "cancel")
        await mutate("occurrences/" + draft.occurrence_id, { cancelled: true });
      update({ drafts: { ...ui.drafts, [modal]: {} } });
      setModal("");
      setNotice("Saved. Cash and upcoming commitments have been recalculated.");
    });
  }
  const legacy = useQuery({
    queryKey: ["cash", userId, "legacy"],
    queryFn: cashAPI.legacy,
    enabled: !!userId && (modal === "legacy" || modal === "exclude"),
    staleTime: 0,
  });
  const activeScenario = state?.scenarios.find((s) => s.id === ui.scenario);
  const modalTitle: Record<string, string> = {
    workspace: "Create a workspace",
    account: "Add a cash account",
    anchor: "Review opening cash",
    movement: "Record money that moved",
    commitment: "Plan upcoming money",
    transfer: "Record an account transfer",
    buffer: "Choose your cash buffer",
    scenario: "Compare a different plan",
    match: "Review and match a payment",
    reschedule: "Change the expected cash date",
    legacy: "Review older records",
    exclude: "Keep reviewed older records outside this workspace",
    reverse: "Reverse this recorded entry",
    unmatch: "Undo this match",
    cancel: "Cancel the remaining commitment",
  };
  const metrics = [
    ["Cash as of " + ui.asOf, result?.cash_today],
    ["Closing cash · " + ui.end, result?.closing_cash],
    ["Lowest cash · " + (result?.minimum?.date || "—"), result?.minimum?.cash],
    [
      Number(result?.reserved_cash || "0") > 0
        ? "Closing after buffer and reservations"
        : "Closing above buffer",
      result?.headroom,
    ],
  ];
  return (
    <section className={styles.root} aria-label="Cash planning">
      <header className={styles.header}>
        <div className={styles.identity}>
          <AegisMark size={38} className={styles.identityMark} />
          <div>
            <span className={styles.eyebrow}>AEGIS / CASH PLANNING</span>
            <h1>See the dates behind your money.</h1>
          </div>
        </div>
        <button className={styles.secondary} onClick={() => open("workspace")}>
          New workspace
        </button>
      </header>
      <p className={styles.intro}>
        Record what moved. Plan what comes next. See whether the dates and
        amounts fit.
      </p>
      {workspaces.error && (
        <div role="alert" className={styles.warning}>
          {workspaces.error instanceof APIError
            ? workspaces.error.detail || workspaces.error.message
            : "Unable to load workspaces."}
          <button onClick={() => workspaces.refetch()}>Retry</button>
        </div>
      )}
      {workspaces.isLoading && <p>Loading your workspaces…</p>}
      {!wid && workspaces.data?.length === 0 && (
        <section className={styles.empty}>
          <span className={styles.eyebrow}>START WITH WHAT YOU KNOW</span>
          <h2>One person. One business. Separate cash plans.</h2>
          <p>
            Choose a workspace, add the accounts you want to include, and enter
            an opening amount you have checked. Aegis will never invent your
            balance from old income and expense totals.
          </p>
          <button className={styles.primary} onClick={() => open("workspace")}>
            Create your first workspace
          </button>
          <Link href="/demo">Explore the fictional example</Link>
        </section>
      )}
      {wid && (
        <>
          <section className={styles.toolbar} aria-label="Forecast scope">
            <label className={styles.field}>
              Workspace
              <select
                disabled={pending}
                value={wid}
                onChange={(e) => {
                  setActive(e.target.value);
                  setModal("");
                  setError("");
                  setNotice("");
                  setLegacySelection([]);
                }}
              >
                {workspaces.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {w.kind} · {w.currency}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Cash as of
              <input
                type="date"
                value={ui.asOf}
                onChange={(e) =>
                  update({ asOf: e.target.value, day: e.target.value })
                }
                onInput={(e) =>
                  update({
                    asOf: e.currentTarget.value,
                    day: e.currentTarget.value,
                  })
                }
              />
            </label>
            <label className={styles.field}>
              Plan through
              <input
                type="date"
                value={ui.end}
                min={ui.asOf}
                max={plusDays(ui.asOf, 180)}
                onChange={(e) => update({ end: e.target.value })}
                onInput={(e) => update({ end: e.currentTarget.value })}
              />
            </label>
            <label className={styles.field}>
              Comparison
              <select
                value={ui.scenario}
                onChange={(e) => update({ scenario: e.target.value })}
              >
                <option value="">Base plan</option>
                {state?.scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.changes.dates.length && !s.changes.extras.length
                      ? " · no changes"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <div className={styles.scope}>
            {currency} · {state?.workspace.timezone || "Loading scope…"} ·{" "}
            {ui.accounts.length
              ? "Selected accounts"
              : "All active cash accounts"}
            <details>
              <summary>Choose included accounts</summary>
              <p>
                Leave all unchecked to include every active account. A selection
                is labeled as a partial scope.
              </p>
              {state?.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <label className={styles.check} key={a.id}>
                    <input
                      type="checkbox"
                      checked={ui.accounts.includes(a.id)}
                      onChange={(e) =>
                        update({
                          accounts: e.target.checked
                            ? [...ui.accounts, a.id]
                            : ui.accounts.filter((id) => id !== a.id),
                        })
                      }
                    />
                    {a.name}
                  </label>
                ))}
            </details>
          </div>
          <nav className={styles.tabs} aria-label="Cash workspace views">
            {views
              .filter(
                (view) =>
                  view !== "Business review" ||
                  state?.workspace.kind === "business",
              )
              .map((view) => (
                <button
                  key={view}
                  aria-pressed={ui.view === view}
                  onClick={() => update({ view })}
                >
                  {view}
                </button>
              ))}
          </nav>
          {stateQuery.error && (
            <p role="alert">
              Unable to load workspace.{" "}
              <button onClick={() => stateQuery.refetch()}>Retry</button>
            </p>
          )}
          {forecastQuery.isFetching && (
            <p role="status">Recalculating dated cash…</p>
          )}
          {forecastQuery.error && (
            <div className={styles.warning} role="alert">
              {forecastQuery.error instanceof APIError
                ? forecastQuery.error.detail || forecastQuery.error.message
                : "Unable to calculate cash."}{" "}
              <button onClick={() => forecastQuery.refetch()}>Retry</button>
            </div>
          )}
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          )}
          {error && !modal && (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          )}
          {state && (
            <div className={styles.actions}>
              <button
                className={styles.primary}
                disabled={!state.accounts.some((a) => !a.archived) || pending}
                onClick={() => open("movement")}
              >
                Record money
              </button>
              <button
                className={styles.secondary}
                disabled={!state.accounts.some((a) => !a.archived)}
                onClick={() => open("commitment")}
              >
                Add upcoming money
              </button>
              <button
                className={styles.secondary}
                onClick={() => open("account")}
              >
                Add cash account
              </button>
            </div>
          )}
          {result && !result.complete && (
            <section className={styles.warning}>
              <strong>Incomplete forecast · review these inputs</strong>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {!!state?.legacy_count && !state.legacy_excluded && (
                <button
                  className={styles.secondary}
                  onClick={() => open("legacy")}
                >
                  Review older records
                </button>
              )}
            </section>
          )}
          {forecast?.scenario_stale && (
            <section className={styles.warning}>
              <strong>The base changed after this scenario was saved.</strong>
              <p>
                Review the latest cash and commitments before updating this
                comparison.
              </p>
              <button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await mutate("scenarios/" + ui.scenario + "/refresh");
                    setNotice("Comparison refreshed using the current base.");
                  })
                }
              >
                Refresh comparison
              </button>
            </section>
          )}
          {result && (ui.view === "Overview" || ui.view === "Scenarios") && (
            <>
              <section className={styles.metrics} aria-label="Cash summary">
                {metrics.map(([label, value]) => (
                  <article key={label}>
                    <span>
                      {label} · {currency}
                    </span>
                    <strong>{amount(value, true)}</strong>
                  </article>
                ))}
              </section>
              <section className={styles.card}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>
                      {ui.scenario ? "BASE / SCENARIO" : "DATED CASH FORECAST"}
                    </span>
                    <h2>
                      {activeScenario?.name || "Will your next plans fit?"}
                    </h2>
                  </div>
                  <button
                    className={styles.secondary}
                    onClick={() => open("scenario")}
                  >
                    Compare a change
                  </button>
                </div>
                <p>
                  {result.first_negative_date
                    ? `Cash is expected to go below zero on ${result.first_negative_date}.`
                    : result.first_below_buffer_date
                      ? `Cash stays above zero but falls below your buffer on ${result.first_below_buffer_date}.`
                      : result.cash_today == null
                        ? "Add reviewed opening balances before relying on a cash forecast."
                        : "The entered plan stays above your buffer within this period."}{" "}
                  {result.first_negative_date && result.first_below_buffer_date
                    ? `Expected cash first falls below your buffer on ${result.first_below_buffer_date}. `
                    : ""}
                  {result.complete
                    ? ""
                    : "These amounts cover the known inputs; resolve the warnings before relying on the plan."}
                </p>
                {forecast && <ForecastChart forecast={forecast} />}
                <p className={styles.caption}>
                  Expected receipts {amount(result.expected_incoming)} ·
                  remaining costs {amount(result.expected_outgoing)} · reserved{" "}
                  {amount(result.reserved_cash)} · buffer{" "}
                  {amount(result.buffer)}{" "}
                  <button
                    onClick={() =>
                      open("buffer", { amount: state?.workspace.buffer || "0" })
                    }
                  >
                    Edit buffer
                  </button>
                </p>
                {result.first_reserved_gap_date && (
                  <p className={styles.warning}>
                    Cash cannot cover your buffer and reserved goals on{" "}
                    {result.first_reserved_gap_date}. Reservations reduce
                    headroom; the account cash is unchanged.
                  </p>
                )}
                <p className={styles.caption}>{result.limit}</p>
                <details>
                  <summary>Inspect daily values and their sources</summary>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Expected in</th>
                          <th>Expected out</th>
                          <th>Closing cash</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.days.map((d) => (
                          <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{amount(d.incoming)}</td>
                            <td>{amount(d.outgoing)}</td>
                            <td>{amount(d.cash)}</td>
                            <td>
                              {d.events.map((e) => e.title).join(", ") ||
                                "No planned movement"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>
              {ui.view === "Scenarios" && (
                <section className={styles.card}>
                  <h2>Saved comparisons</h2>
                  <p>
                    Scenario dates and extra costs never post money or overwrite
                    your base plan.
                  </p>
                  {activeScenario && (
                    <ul>
                      {activeScenario.changes.dates.map((x) => (
                        <li key={x.occurrence_id}>
                          {
                            state?.occurrences.find(
                              (o) => o.id === x.occurrence_id,
                            )?.title
                          }
                          : expected on {x.expected_date}
                        </li>
                      ))}
                      {activeScenario.changes.extras.map((x, i) => (
                        <li key={i}>
                          {x.title}: {amount(x.amount)} on {x.date}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    className={styles.secondary}
                    onClick={() => update({ scenario: "" })}
                  >
                    Return to base plan
                  </button>
                </section>
              )}
            </>
          )}
          {state && userId && (
            <>
              <CashAlerts
                key={wid + ":alerts"}
                owner={userId}
                wid={wid}
                state={state}
                asOf={ui.asOf}
                end={ui.end}
                accounts={ui.accounts}
                forecast={forecast}
                drafts={ui.drafts}
                saveDraft={saveEverydayDraft}
                mutate={mutate}
                active={ui.view === "Overview"}
              />
              <ImportReview
                key={wid + ":imports"}
                owner={userId}
                wid={wid}
                state={state}
                asOf={ui.asOf}
                end={ui.end}
                accounts={ui.accounts}
                forecast={forecast}
                drafts={ui.drafts}
                saveDraft={saveEverydayDraft}
                mutate={mutate}
                active={ui.view === "Review & match"}
              />
              <PlanReview
                key={wid + ":plans"}
                owner={userId}
                wid={wid}
                state={state}
                asOf={ui.asOf}
                end={ui.end}
                accounts={ui.accounts}
                forecast={forecast}
                drafts={ui.drafts}
                saveDraft={saveEverydayDraft}
                mutate={mutate}
                active={ui.view === "Upcoming plans"}
              />
              <PurposeReview
                key={wid + ":purposes"}
                owner={userId}
                wid={wid}
                state={state}
                asOf={ui.asOf}
                end={ui.end}
                accounts={ui.accounts}
                forecast={forecast}
                drafts={ui.drafts}
                saveDraft={saveEverydayDraft}
                mutate={mutate}
                active={ui.view === "Goals & installments"}
              />
              {state.workspace.kind === "business" && (
                <BusinessReview
                  key={wid + ":business"}
                  owner={userId}
                  wid={wid}
                  state={state}
                  asOf={ui.asOf}
                  end={ui.end}
                  accounts={ui.accounts}
                  forecast={forecast}
                  drafts={ui.drafts}
                  saveDraft={saveEverydayDraft}
                  mutate={mutate}
                  active={ui.view === "Business review"}
                />
              )}
            </>
          )}
          {ui.view === "Money calendar" && result && (
            <section className={styles.card}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.eyebrow}>ONE DAY AT A TIME</span>
                  <h2>Money calendar</h2>
                </div>
                <label className={styles.field}>
                  Selected date
                  <input
                    type="date"
                    value={ui.day}
                    min={ui.asOf}
                    max={ui.end}
                    onChange={(e) => update({ day: e.target.value })}
                    onInput={(e) => update({ day: e.currentTarget.value })}
                  />
                </label>
              </div>
              <p>
                Dates show when cash is expected to move. Contractual due dates
                remain in the source details.
              </p>
              <div className={styles.calendar}>
                {result.days.map((d) => (
                  <button
                    key={d.date}
                    aria-pressed={ui.day === d.date}
                    onClick={() => update({ day: d.date })}
                  >
                    <span>{d.date.slice(5)}</span>
                    <strong>{amount(d.cash)}</strong>
                    <small>
                      {d.events.length
                        ? `${d.events.length} planned item(s)`
                        : "No movement"}
                    </small>
                  </button>
                ))}
              </div>
              <h3>
                {ui.day} · end-of-day cash{" "}
                {amount(result.days.find((d) => d.date === ui.day)?.cash)}
              </h3>
              {(result.days.find((d) => d.date === ui.day)?.events || []).map(
                (o) => (
                  <article className={styles.row} key={o.id}>
                    <div>
                      <strong>{o.title}</strong>
                      <p>
                        {o.direction === "income"
                          ? "Expected receipt"
                          : "Remaining cost"}{" "}
                        · {amount(o.remaining || o.amount)} · due{" "}
                        {o.due_date || "Not entered"}
                      </p>
                    </div>
                    <span>Planned</span>
                  </article>
                ),
              )}
            </section>
          )}
          {ui.view === "Review & match" && state && (
            <>
              <section className={styles.card}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>
                      RECORD ONCE / MATCH ONCE
                    </span>
                    <h2>Review recorded money</h2>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={!matchable.length || !unpaid.length}
                    onClick={() => open("match")}
                  >
                    Match a payment
                  </button>
                </div>
                <p>
                  Recorded money already affects cash. Matching links it to a
                  commitment and reduces the future amount.
                </p>
                {state.movements.length === 0 && (
                  <p>
                    No recorded cash yet. Record income or an expense before
                    matching.
                  </p>
                )}
                {state.movements.map((t) => (
                  <article className={styles.row} key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <p>
                        {t.date} · {t.direction} · {amount(t.amount)} ·
                        unallocated {amount(String(available(t)))}
                      </p>
                    </div>
                    {!t.cash_reversal_of_id &&
                      !state.movements.some(
                        (x) => x.cash_reversal_of_id === t.id,
                      ) && (
                        <button
                          className={styles.secondary}
                          onClick={() =>
                            open("reverse", { transaction_id: t.id })
                          }
                        >
                          Reverse record
                        </button>
                      )}
                  </article>
                ))}
              </section>
              <section className={styles.card}>
                <h2>Confirmed matches</h2>
                {state.settlements
                  .filter((s) => !s.reversed)
                  .map((s) => (
                    <article className={styles.row} key={s.id}>
                      <div>
                        {
                          state.occurrences.find(
                            (o) => o.id === s.occurrence_id,
                          )?.title
                        }{" "}
                        · {amount(s.amount)}
                      </div>
                      <button
                        onClick={() => open("unmatch", { settlement_id: s.id })}
                      >
                        Undo match
                      </button>
                    </article>
                  ))}
                <details>
                  <summary>Change trail</summary>
                  {state.audit.map((a) => (
                    <p className={styles.caption} key={a.id}>
                      {a.created_at} · {a.operation.replaceAll("_", " ")} ·
                      revision {a.revision}
                    </p>
                  ))}
                </details>
              </section>
            </>
          )}
          {ui.view === "Accounts" && state && (
            <>
              <section className={styles.card}>
                <h2>Known cash, with a source</h2>
                <p>
                  An opening balance is at the start of its date. Recorded
                  movements on that date are added after it. A later reviewed
                  balance becomes the new starting point.
                </p>
                {state.accounts.map((a) => (
                  <article className={styles.row} key={a.id}>
                    <div>
                      <strong>{a.name}</strong>
                      <p>
                        {a.currency} · {a.kind} {a.archived ? "· archived" : ""}
                      </p>
                      {state.balance_anchors
                        .filter((x) => x.account_id === a.id)
                        .map((x) => (
                          <p key={x.id}>
                            {amount(x.amount)} at start of {x.date} · {x.source}
                          </p>
                        ))}
                    </div>
                    <button
                      className={styles.secondary}
                      onClick={() => {
                        update({
                          drafts: {
                            ...ui.drafts,
                            anchor: { account_id: a.id, date: ui.asOf },
                          },
                        });
                        setModal("anchor");
                      }}
                    >
                      Review opening cash
                    </button>
                  </article>
                ))}
                <div className={styles.actions}>
                  <button onClick={() => open("account")}>Add account</button>
                  <button
                    disabled={
                      !state.accounts.some((a) => !a.archived) ||
                      (state.accounts.filter((a) => !a.archived).length < 2 &&
                        (workspaces.data?.filter((w) => w.currency === currency)
                          .length || 0) < 2)
                    }
                    onClick={() => open("transfer")}
                  >
                    Record transfer
                  </button>
                </div>
              </section>
              <section className={styles.card}>
                <h2>Older records are reviewed separately</h2>
                <p>
                  {state.legacy_count} unassigned records. Historical currency
                  and account are never guessed. Adoption keeps their IDs and
                  links; records stay outside legacy totals after assignment.
                </p>
                <div className={styles.actions}>
                  <button onClick={() => open("legacy")}>
                    Review and assign
                  </button>
                  <button
                    disabled={!state.legacy_count}
                    onClick={() => open("exclude")}
                  >
                    Review exclusion
                  </button>
                  <Link href="/transactions">Open unassigned records</Link>
                </div>
              </section>
            </>
          )}
          {result &&
            (ui.view === "Overview" || ui.view === "Money calendar") && (
              <section className={styles.card}>
                <h2>Upcoming commitments</h2>
                {result.planned.length === 0 && (
                  <p>No unpaid upcoming items in this period.</p>
                )}
                {result.planned.map((o) => (
                  <article className={styles.row} key={o.id}>
                    <div>
                      <strong>{o.title}</strong>
                      <p>
                        {o.direction === "income"
                          ? "Expected receipt"
                          : "Remaining cost"}{" "}
                        {amount(o.remaining)} · expected {o.expected_date} · due{" "}
                        {o.due_date || "Not entered"}
                      </p>
                    </div>
                    {!ui.scenario && (
                      <div className={styles.actions}>
                        <button
                          onClick={() => {
                            update({
                              drafts: {
                                ...ui.drafts,
                                reschedule: {
                                  occurrence_id: o.id,
                                  date: o.expected_date,
                                },
                              },
                            });
                            setModal("reschedule");
                          }}
                        >
                          Change date
                        </button>
                        <button
                          onClick={() =>
                            state?.business_documents?.some(
                              (d) => d.commitment_id === o.commitment_id,
                            )
                              ? update({ view: "Business review" })
                              : open("cancel", { occurrence_id: o.id })
                          }
                        >
                          {state?.business_documents?.some(
                            (d) => d.commitment_id === o.commitment_id,
                          )
                            ? "Review business document"
                            : "Cancel remaining"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
          {result &&
            (result.later.length > 0 || result.unresolved.length > 0) && (
              <section className={styles.card}>
                <h2>Outside the visible plan</h2>
                {result.unresolved.map((o) => (
                  <article className={styles.row} key={o.id}>
                    <div>
                      <strong>{o.title}</strong>
                      <p>
                        Needs review · expected {o.expected_date} ·{" "}
                        {amount(o.remaining)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        update({
                          drafts: {
                            ...ui.drafts,
                            reschedule: {
                              occurrence_id: o.id,
                              date: plusDays(ui.asOf, 1),
                            },
                          },
                        });
                        setModal("reschedule");
                      }}
                    >
                      Review date
                    </button>
                  </article>
                ))}
                <details>
                  <summary>
                    Later obligations and receipts ({result.later.length})
                  </summary>
                  {result.later.map((o) => (
                    <p key={o.id}>
                      {o.title} · {o.expected_date} · {amount(o.remaining)}
                    </p>
                  ))}
                </details>
              </section>
            )}
          <p className={styles.caption}>
            Cash accounts are an entered record of money, not a bank connection.
            Completing a task does not record a payment.{" "}
            <Link href="/docs">Read the Aegis guides</Link>
          </p>
        </>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={(e) => {
          if (pending) e.preventDefault();
          else setModal("");
        }}
        onClose={() => {
          if (!dialog.current?.open) setModal("");
        }}
        aria-labelledby="cash-dialog-title"
      >
        <div className={styles.sectionHead}>
          <h2 id="cash-dialog-title">{modalTitle[modal] || "Review"}</h2>
          <button
            aria-label="Close form"
            disabled={pending}
            onClick={() => setModal("")}
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          {modal === "workspace" && (
            <>
              <p>
                Keep personal money and business cash in separate workspaces.
              </p>
              {[
                ["Workspace name", "name", ""],
                ["Cash buffer", "buffer", "5000"],
              ].map(([label, key]) => (
                <label className={styles.field} key={key}>
                  {label}
                  <input
                    required
                    value={globalDraft[key] || ""}
                    onChange={(e) =>
                      setGlobalDraft({ ...globalDraft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className={styles.field}>
                Use
                <select
                  value={globalDraft.kind}
                  onChange={(e) =>
                    setGlobalDraft({ ...globalDraft, kind: e.target.value })
                  }
                >
                  <option value="personal">Personal</option>
                  <option value="business">Business</option>
                </select>
              </label>
              <label className={styles.field}>
                Currency
                <select
                  value={globalDraft.currency}
                  onChange={(e) =>
                    setGlobalDraft({ ...globalDraft, currency: e.target.value })
                  }
                >
                  <option>THB</option>
                  <option>USD</option>
                </select>
              </label>
              <p>
                Currency stays fixed. A buffer protects headroom without
                removing cash.
              </p>
              {globalDraft.kind === "business" && (
                <label className={styles.field}>
                  Week begins on
                  <select
                    value={globalDraft.week_start || "0"}
                    onChange={(e) =>
                      setGlobalDraft((old) => ({
                        ...old,
                        week_start: e.target.value,
                      }))
                    }
                  >
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((day, index) => (
                      <option value={index} key={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {modal === "account" && (
            <>
              {field("Account name", "name")}
              <label className={styles.field}>
                Type
                <select
                  value={draft.kind || "bank"}
                  onChange={(e) => draftField("kind", e.target.value)}
                >
                  <option value="bank">Bank / current account</option>
                  <option value="cash">Cash held</option>
                </select>
              </label>
              <p>Manually maintained in {currency}, with no bank connection.</p>
            </>
          )}
          {modal === "anchor" && (
            <>
              {accountSelect()}
              {moneyField("Reviewed opening amount", "amount", "", true)}
              {field("Start-of-day date", "date", ui.asOf, "date")}
              {field("Where you checked this amount", "source")}
              <p>
                Use cash held at the <strong>start of this date</strong>.
                Same-day recorded money counts afterwards. A later reviewed
                balance becomes the account's new starting point.
              </p>
            </>
          )}
          {(modal === "movement" || modal === "commitment") && (
            <>
              {accountSelect()}
              {field("Description", "title")}
              {moneyField("Amount", "amount")}
              <label className={styles.field}>
                Direction
                <select
                  value={draft.direction || "expense"}
                  onChange={(e) => draftField("direction", e.target.value)}
                >
                  <option value="expense">Money out</option>
                  <option value="income">Money in</option>
                </select>
              </label>
              {field(
                modal === "movement"
                  ? "Actual movement date"
                  : "Expected cash date",
                "date",
                modal === "movement"
                  ? today(state?.workspace.timezone)
                  : plusDays(ui.asOf, 1),
                "date",
              )}
              {modal === "commitment" ? (
                <>
                  {(!draft.recurrence || draft.recurrence === "once") &&
                    field(
                      "Contractual due date (optional)",
                      "due_date",
                      "",
                      "date",
                      false,
                    )}
                  <label className={styles.field}>
                    Repeat
                    <select
                      value={draft.recurrence || "once"}
                      onChange={(e) => draftField("recurrence", e.target.value)}
                    >
                      <option value="once">One time</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="split">Split month dates</option>
                    </select>
                  </label>
                  {draft.recurrence && draft.recurrence !== "once" && (
                    <>
                      <label className={styles.field}>
                        Repeat interval (1–24)
                        <input
                          type="number"
                          min="1"
                          max="24"
                          required
                          value={draft.every || "1"}
                          onChange={(e) => draftField("every", e.target.value)}
                        />
                      </label>
                      {draft.recurrence === "split" &&
                        field(
                          "Month days, separated by commas (for example 15,31)",
                          "days",
                          "",
                        )}
                      <label className={styles.field}>
                        Weekend behavior
                        <select
                          value={draft.weekend_rule || "strict"}
                          onChange={(e) =>
                            draftField("weekend_rule", e.target.value)
                          }
                        >
                          <option value="strict">Keep the date</option>
                          <option value="roll_back">Previous weekday</option>
                          <option value="roll_forward">Next weekday</option>
                        </select>
                      </label>
                      {field(
                        "Stop after nominal date (optional)",
                        "end_date",
                        "",
                        "date",
                        false,
                      )}
                    </>
                  )}
                  <p>
                    This amount applies to each scheduled payment, including
                    each split date. This plan never posts a payment. Monthly
                    dates clamp to the last valid day; weekend shifts can cross
                    the end date. Review or extend generated dates in Upcoming
                    plans.
                  </p>
                </>
              ) : (
                <p>
                  Record money that has already moved. Use a commitment for
                  future money; match recorded payments afterwards.
                </p>
              )}
            </>
          )}
          {modal === "transfer" && (
            <>
              {accountSelect("from_account_id", "From account")}
              <label className={styles.field}>
                Destination workspace
                <select
                  value={transferWorkspace}
                  onChange={(e) => {
                    const current = ui.drafts.transfer || {};
                    update({
                      drafts: {
                        ...ui.drafts,
                        transfer: {
                          ...current,
                          to_workspace_id: e.target.value,
                          to_account_id: "",
                        },
                      },
                    });
                  }}
                >
                  {workspaces.data
                    ?.filter((w) => w.currency === currency)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} · {w.kind}
                      </option>
                    ))}
                </select>
              </label>
              <label className={styles.field}>
                To account
                <select
                  required
                  value={
                    draft.to_account_id ||
                    targetAccounts.find((a) => a.id !== accountId)?.id ||
                    ""
                  }
                  onChange={(e) => draftField("to_account_id", e.target.value)}
                >
                  <option value="">Choose an account</option>
                  {targetAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
              {moneyField("Amount moved", "amount")}
              {field(
                "Actual date",
                "date",
                today(state?.workspace.timezone),
                "date",
              )}
              {field("Description", "title")}
              <p>
                This records money already moved; it does not send a payment.
                Within included accounts it nets to zero. Between your personal
                and business workspaces it retains one shared transfer reference
                and changes each cash balance once.
              </p>
            </>
          )}
          {modal === "buffer" && (
            <>
              {moneyField(
                "Cash buffer",
                "amount",
                state?.workspace.buffer || "0",
              )}
              <p>This changes headroom, not recorded cash.</p>
            </>
          )}
          {modal === "reschedule" && (
            <>
              {field(
                "New expected cash date",
                "date",
                plusDays(ui.asOf, 1),
                "date",
              )}
              <p>Due date and recorded payments stay unchanged.</p>
            </>
          )}
          {modal === "scenario" && (
            <>
              {field("Scenario name", "name")}
              <p>
                Use the same starting cash; base commitments stay unchanged.
              </p>
              {[1, 2].map((i) => (
                <fieldset key={i}>
                  <legend>Move one expected date · optional</legend>
                  <label className={styles.field}>
                    Commitment
                    <select
                      value={draft["occurrence" + i] || ""}
                      onChange={(e) =>
                        draftField("occurrence" + i, e.target.value)
                      }
                    >
                      <option value="">Choose an item</option>
                      {unpaid.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title} · {o.expected_date}
                        </option>
                      ))}
                    </select>
                  </label>
                  {field("Scenario date", "date" + i, "", "date", false)}
                </fieldset>
              ))}
              <fieldset>
                <legend>Add a cost · optional</legend>
                {accountSelect()}
                {field("Cost name", "extra_title", "", "text", false)}
                <label className={styles.field}>
                  Extra cost · {currency}
                  <input
                    inputMode="decimal"
                    value={draft.extra_amount || ""}
                    onChange={(e) => draftField("extra_amount", e.target.value)}
                  />
                </label>
                {field(
                  "Cost date",
                  "extra_date",
                  plusDays(ui.asOf, 1),
                  "date",
                  false,
                )}
              </fieldset>
            </>
          )}
          {modal === "match" && (
            <>
              <label className={styles.field}>
                Recorded payment
                <select
                  required
                  value={tx?.id || ""}
                  onChange={(e) => {
                    const t = matchable.find((x) => x.id === e.target.value);
                    update({
                      drafts: {
                        ...ui.drafts,
                        match: {
                          transaction_id: t?.id || "",
                          amount: t?.amount || "",
                        },
                      },
                    });
                    setPreview(null);
                  }}
                >
                  {matchable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} · {t.date} · {amount(t.amount)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Unpaid commitment
                <select
                  required
                  value={occurrenceId}
                  onChange={(e) => draftField("occurrence_id", e.target.value)}
                >
                  {candidates.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} · remaining {amount(String(outstanding(o)))}
                    </option>
                  ))}
                </select>
              </label>
              {moneyField("Amount to match", "amount", tx?.amount || "")}
              <p>Account, currency and direction must match.</p>
              {preview && (
                <section className={styles.preview}>
                  <strong>Confirm this allocation</strong>
                  <p>
                    Outstanding {amount(preview.remaining_before)} →{" "}
                    {amount(preview.remaining_after)}.
                  </p>
                  <p>
                    Cash effect {amount(preview.cash_effect)}. {preview.message}
                  </p>
                </section>
              )}
            </>
          )}
          {(modal === "legacy" || modal === "exclude") && (
            <>
              <p>
                Review historical amounts before assigning an account/currency
                or excluding them from this workspace.
              </p>
              <div className={styles.legacyList}>
                {legacy.data?.map((t) => (
                  <label className={styles.check} key={t.id}>
                    {modal === "legacy" && (
                      <input
                        type="checkbox"
                        checked={legacySelection.includes(t.id)}
                        onChange={(e) =>
                          setLegacySelection((old) =>
                            e.target.checked
                              ? [...old, t.id]
                              : old.filter((id) => id !== t.id),
                          )
                        }
                      />
                    )}
                    <span>
                      {t.title} · {t.date} · {t.direction} · {t.amount}{" "}
                      (currency unverified)
                    </span>
                  </label>
                ))}
              </div>
              {!!state && state.legacy_count > 500 && (
                <p>
                  Only 500 records are shown. Assign reviewed batches; full-set
                  exclusion is unavailable.
                </p>
              )}
              {modal === "legacy" ? (
                <>
                  {accountSelect()}
                  <label className={styles.field}>
                    Confirm historical currency
                    <select
                      value={draft.confirmed_currency || currency}
                      onChange={(e) =>
                        draftField("confirmed_currency", e.target.value)
                      }
                    >
                      <option>THB</option>
                      <option>USD</option>
                    </select>
                  </label>
                  <p>
                    IDs and plan/trip links stay intact. Amounts are assigned
                    without conversion.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    These records remain in the unassigned view. New or edited
                    records require review again.
                  </p>
                  <label className={styles.check}>
                    <input required type="checkbox" />I reviewed these records
                    and confirm they are outside this workspace.
                  </label>
                </>
              )}
            </>
          )}
          {modal === "reverse" && (
            <p>
              This adds an opposite entry on the original date and keeps both
              records. Unmatch allocations first. Record an actual refund on
              another date separately.
            </p>
          )}
          {modal === "unmatch" && (
            <p>
              This restores the outstanding commitment without reversing
              recorded cash.
            </p>
          )}
          {modal === "cancel" && (
            <p>
              Cancel the unpaid remainder. Recorded money and matching history
              stay intact.
            </p>
          )}
          {error && (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal("")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primary}
              disabled={
                pending ||
                (modal === "exclude" && (state?.legacy_count || 0) > 500) ||
                (modal === "match" && (!tx || !occurrenceId))
              }
            >
              {pending
                ? "Saving…"
                : modal === "match"
                  ? preview
                    ? "Confirm match"
                    : "Preview match"
                  : modal === "exclude"
                    ? "Confirm exclusion"
                    : modal === "reverse"
                      ? "Confirm reversal"
                      : modal === "unmatch"
                        ? "Undo match"
                        : modal === "cancel"
                          ? "Cancel remaining"
                          : modal === "legacy"
                            ? "Confirm assignment"
                            : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
