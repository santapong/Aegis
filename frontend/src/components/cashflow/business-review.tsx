"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { businessAPI, type BusinessDocument } from "@/lib/cashflow";
import {
  CashTaskDialog,
  TaskFeedback,
  cashFormat,
  dateInputChange,
  useCashTask,
  type EverydayProps,
} from "./everyday-common";
import styles from "./workspace.module.css";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const varianceLabels: Record<string, string> = {
  amount_change: "Reviewed amounts and credits",
  timing_or_unpaid: "Timing or still unpaid",
  new_sources: "New matched plans",
  unmatched_activity: "Recorded money without a saved-plan match",
  internal_transfers: "Transfers in this account scope",
  opening_balance_revision: "Opening balance changes",
  unclassified: "Unexplained difference",
};
type Form =
  | "new"
  | "review"
  | "credit"
  | "cancel"
  | "settle"
  | "unmatch"
  | "snapshot"
  | "";

export default function BusinessReview(p: EverydayProps) {
  const task = useCashTask();
  const available = Array.isArray(p.state.business_documents);
  const [modal, setModal] = useState<Form>("");
  const [offset, setOffset] = useState(0);
  const panel = p.drafts.business_view?.panel || "documents";
  const kind =
    modal === "new"
      ? "business_document_new"
      : modal === "snapshot"
        ? "business_snapshot_new"
        : "business_document_edit";
  const draft = p.drafts[kind] || {};
  const patch = (values: Record<string, string>) =>
    p.saveDraft(kind, (old) => ({ ...old, ...values }));
  const accounts = p.state.accounts.filter((a) => !a.archived);
  const fmt = (value?: string | null) =>
    cashFormat(value ?? undefined, p.state.workspace.currency);
  const docs = useQuery({
    queryKey: [
      "cash",
      p.owner,
      "business-documents",
      p.wid,
      p.asOf,
      offset,
      p.state.workspace.revision,
    ],
    queryFn: () => businessAPI.documents(p.wid, p.asOf, offset),
    enabled: available && p.active && panel === "documents",
  });
  const weekly = useQuery({
    queryKey: [
      "cash",
      p.owner,
      "business-weeks",
      p.wid,
      p.asOf,
      p.accounts,
      p.state.workspace.revision,
    ],
    queryFn: () => businessAPI.weeks(p.wid, p.asOf, p.accounts),
    enabled: available && p.active && panel === "weeks",
  });
  const snapshots = useQuery({
    queryKey: [
      "cash",
      p.owner,
      "business-snapshots",
      p.wid,
      p.state.workspace.revision,
    ],
    queryFn: () => businessAPI.snapshots(p.wid),
    enabled: available && p.active && panel === "snapshots",
  });
  const snapshotId =
    p.drafts.business_variance?.snapshot_id || snapshots.data?.[0]?.id || "";
  const saved = snapshots.data?.find((s) => s.id === snapshotId);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: p.state.workspace.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const lastReviewDate = saved && saved.end < today ? saved.end : today;
  const through =
    p.drafts.business_variance?.reviewed_through || lastReviewDate;
  const variance = useQuery({
    queryKey: [
      "cash",
      p.owner,
      "business-variance",
      p.wid,
      snapshotId,
      through,
      p.state.workspace.revision,
    ],
    queryFn: () => businessAPI.variance(p.wid, snapshotId, through),
    enabled:
      available &&
      p.active &&
      panel === "snapshots" &&
      !!saved &&
      through >= saved.as_of &&
      through <= lastReviewDate,
  });
  const target = docs.data?.documents.find((d) => d.id === draft.document_id);
  const oncePlans = p.state.commitments.filter(
    (c) =>
      c.recurrence === "once" &&
      !c.cancelled &&
      available &&
      !p.state.business_documents.some((d) => d.commitment_id === c.id),
  );
  const targetOccurrence = p.state.occurrences.find(
    (o) => o.id === target?.occurrence_id,
  );
  const payments = p.state.movements.filter(
    (m) =>
      m.account_id === target?.account_id &&
      m.direction === targetOccurrence?.direction &&
      !m.cash_reversal_of_id &&
      !p.state.movements.some((r) => r.cash_reversal_of_id === m.id),
  );

  function newForm(form: "new" | "snapshot") {
    task.setError("");
    task.setNotice("");
    setModal(form);
  }
  function review(
    d: BusinessDocument,
    form: Exclude<Form, "new" | "snapshot" | "">,
    settlementId = "",
  ) {
    task.setError("");
    task.setNotice("");
    p.saveDraft("business_document_edit", (old) =>
      old.document_id === d.id &&
      old.action === form &&
      old.settlement_id === settlementId
        ? old
        : {
            document_id: d.id,
            action: form,
            counterparty: d.counterparty,
            reference: d.reference,
            due_date: d.due_date,
            expected_date: d.expected_date,
            amount: d.remaining_amount,
            date: today,
            mode: "new",
            settlement_id: settlementId,
          },
    );
    setModal(form);
  }
  function field(
    label: string,
    name: string,
    fallback = "",
    type = "text",
    required = true,
  ) {
    return (
      <label className={styles.field}>
        {label}
        <input
          type={type}
          required={required}
          value={draft[name] ?? fallback}
          {...(type === "date"
            ? {
                min: "1900-01-01",
                max: "2100-12-31",
                ...dateInputChange((v) => patch({ [name]: v })),
              }
            : {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  patch({ [name]: e.target.value }),
              })}
        />
      </label>
    );
  }
  function moneyField(label: string) {
    return (
      <label className={styles.field}>
        {label} · {p.state.workspace.currency}
        <input
          required
          inputMode="decimal"
          pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
          value={draft.amount || ""}
          onChange={(e) => patch({ amount: e.target.value })}
        />
      </label>
    );
  }
  const errorView = (error: unknown, retry: () => void) =>
    error ? (
      <p className={styles.warning} role="alert">
        Unable to load this review.{" "}
        <button onClick={retry}>Retry review</button>
      </p>
    ) : null;

  if (!available) {
    return (
      <section className={styles.card} hidden={!p.active}>
        <h2>Business review is unavailable on this server</h2>
        <p>
          Cash overview remains available. Try again after your administrator
          enables business review.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Business cash review" hidden={!p.active}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          BUSINESS CASH, WITH THE SOURCE ATTACHED
        </span>
        <h2>What is owed. What actually arrived.</h2>
        <p>
          Keep customer receivables and supplier bills separate from recorded
          cash. Review partial payments and the dates behind the next thirteen
          weeks.
        </p>
        <nav className={styles.tabs} aria-label="Business review tasks">
          {[
            ["documents", "Receivables & bills"],
            ["weeks", "13-week cash"],
            ["snapshots", "Saved forecast review"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={panel === key}
              onClick={() =>
                p.saveDraft("business_view", () => ({ panel: key }))
              }
            >
              {label}
            </button>
          ))}
        </nav>
        <TaskFeedback task={task} />
      </section>
      {panel === "documents" && (
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2>Receivables and supplier bills</h2>
            <button
              className={styles.primary}
              disabled={!accounts.length || task.pending}
              onClick={() => newForm("new")}
            >
              Add a business document
            </button>
          </div>
          <p>
            A document uses one linked plan. Matching a payment reduces its
            unpaid amount and never adds another cash movement. Due dates show
            lateness; expected dates control the forecast.
          </p>
          <p className={styles.caption}>
            Payment aging as of {p.asOf}; current reviewed credits and
            cancellations apply. Documents cover the workspace; each card names
            its cash account.
          </p>
          {docs.isFetching && <p role="status">Loading business documents…</p>}
          {errorView(docs.error, () => {
            void docs.refetch();
          })}
          {docs.data?.documents.map((d) => (
            <article className={styles.businessDocument} key={d.id}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.eyebrow}>
                    {d.kind === "receivable"
                      ? "CUSTOMER RECEIVABLE"
                      : "SUPPLIER BILL"}{" "}
                    · {d.status}
                  </span>
                  <h3>
                    {d.counterparty} · {d.reference}
                  </h3>
                </div>
                <strong>Remaining {fmt(d.remaining_amount)}</strong>
              </div>
              <p>
                Original {fmt(d.original_amount)} · credited{" "}
                {fmt(d.credited_amount)} · matched {fmt(d.matched_amount)}
              </p>
              <p>
                Due {d.due_date} · expected {d.expected_date} ·{" "}
                {p.state.accounts.find((a) => a.id === d.account_id)?.name}
              </p>
              {d.overdue_days > 0 && (
                <p className={styles.warning}>
                  {d.overdue_days} day{d.overdue_days === 1 ? "" : "s"} overdue
                  by its due date.
                </p>
              )}
              {d.needs_expected_date_review && (
                <p className={styles.warning}>
                  This unpaid expected date has passed. Review a future
                  expectation or match money that actually moved.
                </p>
              )}
              {d.status === "cancelled" && (
                <p>
                  Cancelled: {d.cancellation_reason}. Recorded payments remain;
                  no unpaid amount enters the forecast.
                </p>
              )}
              {d.status === "open" && (
                <div className={styles.actions}>
                  <button
                    disabled={task.pending}
                    onClick={() => review(d, "settle")}
                  >
                    Record or match a payment
                  </button>
                  <button
                    disabled={task.pending}
                    onClick={() => review(d, "review")}
                  >
                    Review document dates
                  </button>
                  <button
                    disabled={task.pending}
                    onClick={() => review(d, "credit")}
                  >
                    Enter a credit
                  </button>
                  <button
                    disabled={task.pending}
                    onClick={() => review(d, "cancel")}
                  >
                    Cancel unpaid plan
                  </button>
                </div>
              )}
              {(d.adjustments.length > 0 || d.settlements.length > 0) && (
                <details>
                  <summary>Inspect matched payments and credits</summary>
                  {d.settlements.map((s) => (
                    <div className={styles.row} key={s.id}>
                      <p>
                        Matched {fmt(s.amount)} ·{" "}
                        {p.state.movements.find(
                          (m) => m.id === s.transaction_id,
                        )?.date || "Recorded payment"}
                      </p>
                      <button
                        disabled={task.pending}
                        onClick={() => review(d, "unmatch", s.id)}
                      >
                        Undo this match
                      </button>
                    </div>
                  ))}
                  {d.adjustments.map((a) => (
                    <p key={a.id}>
                      Credit {fmt(a.amount)} · {a.reason}
                    </p>
                  ))}
                </details>
              )}
            </article>
          ))}
          {docs.data && !docs.data.documents.length && (
            <p>
              No business documents on this page. Add a receivable or supplier
              bill, or link an existing once-only plan.
            </p>
          )}
          <div className={styles.actions}>
            <button
              disabled={!offset || docs.isFetching}
              onClick={() => setOffset((n) => Math.max(0, n - 20))}
            >
              Previous documents
            </button>
            <span>Page {Math.floor(offset / 20) + 1}</span>
            <button
              disabled={!docs.data?.has_more || docs.isFetching}
              onClick={() => setOffset((n) => n + 20)}
            >
              Next documents
            </button>
          </div>
        </section>
      )}
      {panel === "weeks" && (
        <section className={styles.card}>
          <h2>Thirteen weeks, with the lowest day visible.</h2>
          <p>
            Base plan for the selected accounts. Weeks begin on{" "}
            {weekdays[p.state.workspace.week_start]}; the first week starts at
            the selected cash-as-of date. A positive weekly close can still
            contain a daily shortage.
          </p>
          {weekly.isFetching && (
            <p role="status">Building the thirteen-week view…</p>
          )}
          {errorView(weekly.error, () => {
            void weekly.refetch();
          })}
          {weekly.data?.base.warnings.map((w) => (
            <p className={styles.warning} key={w}>
              {w}
            </p>
          ))}
          {weekly.data?.weeks.map((w) => (
            <article className={styles.businessDocument} key={w.week_start}>
              <div className={styles.sectionHead}>
                <h3>
                  {w.week_start} → {w.week_end}
                  {w.partial ? " · Partial first week" : ""}
                </h3>
                <strong>Close {fmt(w.closing_cash)}</strong>
              </div>
              <p>
                Lowest {fmt(w.minimum?.cash)}
                {w.minimum
                  ? ` on ${w.minimum.date}`
                  : " · Add checked opening balances"}
                . Expected in {fmt(w.incoming)} · out {fmt(w.outgoing)}.
              </p>
              {w.minimum && w.minimum.cash.startsWith("-") && (
                <p className={styles.warning}>
                  A daily cash shortage appears in this week.
                </p>
              )}
              <details>
                <summary>
                  Inspect daily cash and sources for week {w.week_start}
                </summary>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Cash</th>
                        <th>After buffer and goals</th>
                        <th>Expected in</th>
                        <th>Expected out</th>
                        <th>Sources</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.days.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td>{fmt(d.cash)}</td>
                          <td>{fmt(d.headroom)}</td>
                          <td>{fmt(d.incoming)}</td>
                          <td>{fmt(d.outgoing)}</td>
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
            </article>
          ))}
          {!!weekly.data?.base.later.length && (
            <details>
              <summary>
                Later items beyond these thirteen weeks (
                {weekly.data.base.later.length})
              </summary>
              {weekly.data.base.later.map((o) => (
                <p key={o.id}>
                  {o.title} · {o.expected_date} · {fmt(o.remaining)}
                </p>
              ))}
            </details>
          )}
          <p className={styles.caption}>{weekly.data?.base.limit}</p>
        </section>
      )}
      {panel === "snapshots" && (
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2>Review a saved forecast.</h2>
            <button
              className={styles.primary}
              disabled={!accounts.length || task.pending}
              onClick={() => newForm("snapshot")}
            >
              Save this forecast
            </button>
          </div>
          <p>
            A saved forecast keeps its original dates, account scope, source
            versions and assumptions. Later edits create a comparison; they
            never replace the saved plan.
          </p>
          {snapshots.isFetching && (
            <p role="status">Loading saved forecasts…</p>
          )}
          {errorView(snapshots.error, () => {
            void snapshots.refetch();
          })}
          {snapshots.data && !snapshots.data.length && (
            <p>
              Save a forecast, then review it after a payment, changed amount or
              changed expectation.
            </p>
          )}
          {!!snapshots.data?.length && (
            <label className={styles.field}>
              Saved forecast
              <select
                value={snapshotId}
                onChange={(e) =>
                  p.saveDraft("business_variance", () => ({
                    snapshot_id: e.target.value,
                  }))
                }
              >
                {snapshots.data.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.as_of} → {s.end}
                  </option>
                ))}
              </select>
            </label>
          )}
          {saved && (
            <>
              <p>
                Saved scope:{" "}
                {saved.account_ids
                  .map(
                    (id) =>
                      p.state.accounts.find((a) => a.id === id)?.name || id,
                  )
                  .join(", ")}{" "}
                · {saved.as_of} → {saved.end}. This review uses those saved
                accounts.
              </p>
              {lastReviewDate < saved.as_of ? (
                <p>
                  No actual review date is available yet for this future saved
                  period.
                </p>
              ) : (
                <label className={styles.field}>
                  Review actual cash through
                  <input
                    type="date"
                    min={saved.as_of}
                    max={lastReviewDate}
                    value={through}
                    {...dateInputChange((v) =>
                      p.saveDraft("business_variance", (old) => ({
                        ...old,
                        snapshot_id: snapshotId,
                        reviewed_through: v,
                      })),
                    )}
                  />
                </label>
              )}
            </>
          )}
          {variance.isFetching && (
            <p role="status">Comparing the saved plan with reviewed cash…</p>
          )}
          {errorView(variance.error, () => {
            void variance.refetch();
          })}
          {variance.data && (
            <>
              <div className={styles.metrics}>
                {[
                  ["Expected cash at review date", variance.data.expected_cash],
                  ["Recorded cash at review date", variance.data.recorded_cash],
                  ["Difference", variance.data.difference],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>
                      {label} · {through}
                    </span>
                    <strong>{fmt(value)}</strong>
                  </article>
                ))}
              </div>
              {!variance.data.known && (
                <p className={styles.warning}>
                  The comparison needs checked balances before a numerical
                  difference is known.
                </p>
              )}
              <h3>Where the difference comes from</h3>
              {Object.entries(variance.data.components).map(([key, value]) => (
                <div className={styles.row} key={key}>
                  <span>{varianceLabels[key] || key}</span>
                  <strong>{fmt(value)}</strong>
                </div>
              ))}
              {variance.data.sources.map((s) => (
                <article className={styles.businessDocument} key={s.source_id}>
                  <strong>{s.title}</strong>
                  {s.saved_expected_date ? (
                    <>
                      <p>
                        Saved expectation {s.saved_expected_date}; now reviewed
                        for {s.reviewed_expected_date}.
                      </p>
                      <p>
                        Saved remaining {fmt(s.saved_remaining)} · reviewed
                        effective amount {fmt(s.reviewed_effective_amount)} ·
                        matched cash change {fmt(s.matched_cash_change)}
                      </p>
                      <p>
                        Amount difference {fmt(s.amount_change)} · timing or
                        unpaid difference {fmt(s.timing_or_unpaid)}
                      </p>
                    </>
                  ) : (
                    <p>
                      {varianceLabels[s.kind || ""] || "Recorded source"} ·{" "}
                      {fmt(s.cash_change)}
                    </p>
                  )}
                </article>
              ))}
              <details>
                <summary>Inspect saved and reviewed opening balances</summary>
                <p>
                  Opening changes are shown separately from customer payments.
                </p>
                {[
                  ["Saved", variance.data.saved_anchors],
                  ["Reviewed", variance.data.reviewed_anchors],
                ].map(([label, anchors]) => (
                  <div key={String(label)}>
                    <strong>{String(label)}</strong>
                    {(anchors as typeof variance.data.saved_anchors).map(
                      (a) => (
                        <p key={a.id}>
                          {
                            p.state.accounts.find((x) => x.id === a.account_id)
                              ?.name
                          }{" "}
                          · {a.date} · {fmt(a.amount)} · {a.source}
                        </p>
                      ),
                    )}
                  </div>
                ))}
              </details>
              <p>
                Original end-date forecast{" "}
                {fmt(variance.data.saved_closing_cash)}; reviewed end-date
                forecast {fmt(variance.data.reviewed_closing_cash)}. The
                reviewed close still depends on remaining expected money.
              </p>
              {variance.data.warnings.map((w) => (
                <p className={styles.warning} key={w}>
                  {w}
                </p>
              ))}
              <p className={styles.caption}>{variance.data.assumption}</p>
            </>
          )}
        </section>
      )}
      <CashTaskDialog
        open={!!modal}
        close={() => setModal("")}
        pending={task.pending}
        title={
          {
            new: "Review a business document",
            review: "Review document dates",
            credit: "Review a document credit",
            cancel: "Cancel the unpaid document plan",
            settle: "Record or match a document payment",
            unmatch: "Undo a document match",
            snapshot: "Save an immutable forecast",
            "": "Business review",
          }[modal]
        }
        submitLabel={
          modal === "settle"
            ? draft.mode === "existing"
              ? "Confirm existing match"
              : "Confirm record and match"
            : modal === "cancel"
              ? "Confirm cancellation"
              : modal === "unmatch"
                ? "Confirm undo match"
                : "Save reviewed changes"
        }
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            if (modal === "new") {
              if (draft.confirmed !== "yes")
                throw new Error(
                  "Confirm the document and cash account use the workspace currency.",
                );
              await p.mutate("business/documents", {
                account_id: draft.account_id || accounts[0]?.id,
                commitment_id: draft.commitment_id || null,
                kind: draft.kind || "receivable",
                counterparty: draft.counterparty,
                reference: draft.reference,
                amount: draft.amount,
                due_date: draft.due_date || p.asOf,
                expected_date: draft.expected_date || p.end,
                confirmed_currency: p.state.workspace.currency,
              });
            } else if (modal === "review") {
              await p.mutate(`business/documents/${draft.document_id}`, {
                counterparty: draft.counterparty,
                reference: draft.reference,
                due_date: draft.due_date,
                expected_date: draft.expected_date,
              });
            } else if (modal === "credit") {
              await p.mutate(`business/documents/${draft.document_id}/credit`, {
                amount: draft.amount,
                reason: draft.reason,
              });
            } else if (modal === "cancel") {
              await p.mutate(`business/documents/${draft.document_id}/cancel`, {
                reason: draft.reason,
              });
            } else if (modal === "settle") {
              await p.mutate(`business/documents/${draft.document_id}/settle`, {
                amount: draft.amount,
                ...(draft.mode === "existing"
                  ? { transaction_id: draft.transaction_id }
                  : { date: draft.date || today }),
              });
            } else if (modal === "unmatch") {
              await p.mutate(`settlements/${draft.settlement_id}/reverse`);
            } else if (modal === "snapshot") {
              await p.mutate("business/snapshots", {
                name: draft.name,
                as_of: draft.as_of || p.asOf,
                end: draft.end || p.end,
                account_ids: p.accounts.length ? p.accounts : undefined,
              });
            }
            p.saveDraft(kind, () => ({}));
            setModal("");
            task.setNotice(
              "Saved. The cash plan and sources have been refreshed.",
            );
          });
        }}
      >
        {modal === "new" && (
          <>
            <label className={styles.field}>
              Document type
              <select
                value={draft.kind || "receivable"}
                onChange={(e) =>
                  patch({
                    kind: e.target.value,
                    commitment_id: "",
                    confirmed: "",
                  })
                }
              >
                <option value="receivable">Customer receivable</option>
                <option value="bill">Supplier bill</option>
              </select>
            </label>
            <label className={styles.field}>
              Link a reviewed existing plan (optional)
              <select
                value={draft.commitment_id || ""}
                onChange={(e) => {
                  const c = oncePlans.find((x) => x.id === e.target.value);
                  const o = p.state.occurrences.find(
                    (x) => x.commitment_id === c?.id,
                  );
                  patch(
                    o
                      ? {
                          commitment_id: c!.id,
                          account_id: o.account_id,
                          kind:
                            o.direction === "income" ? "receivable" : "bill",
                          amount: o.amount,
                          expected_date: o.expected_date,
                          due_date: o.due_date || p.asOf,
                          confirmed: "",
                        }
                      : { commitment_id: "", confirmed: "" },
                  );
                }}
              >
                <option value="">Create one new linked plan</option>
                {oncePlans.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Cash account
              <select
                required
                value={draft.account_id || accounts[0]?.id || ""}
                onChange={(e) =>
                  patch({ account_id: e.target.value, confirmed: "" })
                }
              >
                {accounts.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {field("Customer or supplier", "counterparty")}
            {field("Document reference", "reference")}
            {moneyField("Full reviewed amount, including matched payments")}
            {field("Due date", "due_date", p.asOf, "date")}
            {field("Expected cash date", "expected_date", p.end, "date")}
            <p>
              Creating this record adds a plan, with no recorded cash. Linking
              an existing plan preserves its payment identity and does not add
              another plan.
            </p>
            <label className={styles.check}>
              <input
                type="checkbox"
                required
                checked={draft.confirmed === "yes"}
                onChange={(e) =>
                  patch({ confirmed: e.target.checked ? "yes" : "" })
                }
              />
              I checked this document and cash account use{" "}
              {p.state.workspace.currency}.
            </label>
          </>
        )}
        {modal === "review" && (
          <>
            {field("Customer or supplier", "counterparty")}
            {field("Document reference", "reference")}
            {field("Due date", "due_date", "", "date")}
            {field("Expected cash date", "expected_date", "", "date")}
            <p>
              Due dates control aging. Expected dates control the cash plan;
              this review does not record a payment.
            </p>
          </>
        )}
        {modal === "credit" && (
          <>
            <p>
              {target?.counterparty} · {target?.reference}. Current unpaid
              amount {fmt(target?.remaining_amount)}. A credit reduces the
              obligation, with no cash movement.
            </p>
            {moneyField("Reviewed credit")}
            {field("Reason for credit", "reason")}
          </>
        )}
        {modal === "cancel" && (
          <>
            <p>
              Cancel the unpaid plan for {target?.counterparty} ·{" "}
              {target?.reference}? Its payments and original amount remain in
              history.
            </p>
            {field("Reason for cancellation", "reason")}
          </>
        )}
        {modal === "settle" && (
          <>
            <p>
              {target?.counterparty} · {target?.reference}. Remaining{" "}
              {fmt(target?.remaining_amount)}. Record money that already moved,
              or match a recorded payment. This action does not send money.
            </p>
            <label className={styles.field}>
              Payment review
              <select
                value={draft.mode || "new"}
                onChange={(e) =>
                  patch({ mode: e.target.value, transaction_id: "" })
                }
              >
                <option value="new">
                  Record an actual payment and match it
                </option>
                <option value="existing">
                  Match an existing recorded payment
                </option>
              </select>
            </label>
            {draft.mode === "existing" ? (
              <label className={styles.field}>
                Recorded payment
                <select
                  required
                  value={draft.transaction_id || ""}
                  onChange={(e) => patch({ transaction_id: e.target.value })}
                >
                  <option value="">Choose a reviewed payment</option>
                  {payments.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.title} · {m.date} · {fmt(m.amount)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              field("Actual payment date", "date", today, "date")
            )}
            {moneyField("Amount to match")}
            <p>
              {draft.mode === "existing"
                ? "Matching has zero cash effect. The server checks the unallocated amount before saving."
                : "Recording changes account cash once; its linked match removes only this amount from the future plan."}
            </p>
          </>
        )}
        {modal === "unmatch" && (
          <p>
            Undo this allocation to {target?.counterparty} · {target?.reference}
            ? Recorded cash stays unchanged and the unpaid amount returns.
            Reverse an incorrect recorded entry separately in Review & match.
          </p>
        )}
        {modal === "snapshot" && (
          <>
            {field("Saved forecast name", "name")}
            {field("Cash as of", "as_of", p.asOf, "date")}
            {field("Plan through", "end", p.end, "date")}
            <p>
              Selected accounts:{" "}
              {(p.accounts.length ? p.accounts : accounts.map((a) => a.id))
                .map((id) => p.state.accounts.find((a) => a.id === id)?.name)
                .join(", ")}
              . This saves the base plan, its assumptions and source versions.
              It cannot be edited afterwards.
            </p>
          </>
        )}
        <TaskFeedback task={task} />
      </CashTaskDialog>
    </section>
  );
}
