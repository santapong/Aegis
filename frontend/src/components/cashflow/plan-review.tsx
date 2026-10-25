"use client";
import { useState } from "react";
import type { Occurrence } from "@/lib/cashflow";
import {
  type EverydayProps,
  useCashTask,
  TaskFeedback,
  CashTaskDialog,
  cashFormat,
  dateInputChange,
} from "./everyday-common";
import styles from "./workspace.module.css";
const cents = (s: string) => {
  const [whole, fraction = ""] = s.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
};
const money = (n: bigint) =>
  `${n / BigInt(100)}.${String(n % BigInt(100)).padStart(2, "0")}`;
export default function PlanReview(p: EverydayProps) {
  const task = useCashTask();
  const [modal, setModal] = useState<"edit" | "extend" | "cancel" | "">("");
  const [page, setPage] = useState(0);
  const draft = p.drafts.plan_review || {};
  const patch = (values: Record<string, string>) =>
    p.saveDraft("plan_review", (old) => ({ ...old, ...values }));
  const fmt = (s?: string) => cashFormat(s, p.state.workspace.currency);
  const linkedDocument = (commitmentId: string) =>
    p.state.business_documents?.find((d) => d.commitment_id === commitmentId);
  function remaining(o: Occurrence) {
    const matched = p.state.settlements
      .filter((s) => !s.reversed && s.occurrence_id === o.id)
      .reduce((sum, s) => sum + cents(s.amount), BigInt(0));
    return money(cents(o.amount) - matched);
  }
  const filter = draft.filter || "open";
  const rows = p.state.occurrences
    .filter(
      (o) =>
        filter === "all" ||
        (filter === "cancelled"
          ? o.cancelled
          : !o.cancelled &&
            (filter === "paid"
              ? remaining(o) === "0.00"
              : remaining(o) !== "0.00")),
    )
    .sort(
      (a, b) =>
        a.expected_date.localeCompare(b.expected_date) ||
        a.id.localeCompare(b.id),
    );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 20) - 1),
  );
  function edit(o: Occurrence) {
    task.setError("");
    task.setNotice("");
    const values = {
      occurrence_id: o.id,
      title: o.title,
      amount: o.amount,
      expected_date: o.expected_date,
      due_date: o.due_date || "",
      cancelled: o.cancelled ? "yes" : "",
    };
    p.saveDraft("plan_review", (old) =>
      old.occurrence_id === o.id
        ? { ...values, ...old }
        : { ...old, ...values },
    );
    setModal("edit");
  }
  function series(id: string, mode: "extend" | "cancel") {
    task.setError("");
    task.setNotice("");
    const c = p.state.commitments.find((x) => x.id === id)!;
    const year = Number((c.generated_through || p.end).slice(0, 4)) + 1;
    p.saveDraft("plan_review", (old) => ({
      ...old,
      commitment_id: id,
      through:
        old.commitment_id === id && old.through
          ? old.through
          : `${Math.min(year, 2100)}-12-31`,
    }));
    setModal(mode);
  }
  const selected = p.state.occurrences.find(
    (o) => o.id === draft.occurrence_id,
  );
  const commitment = p.state.commitments.find(
    (c) => c.id === draft.commitment_id,
  );
  return (
    <section hidden={!p.active} aria-label="Upcoming plan review">
      <section className={styles.card}>
        <span className={styles.eyebrow}>ENTERED DATES / REVIEWED CHANGES</span>
        <h2>Upcoming plans</h2>
        <p>
          Edit one payment without rebuilding its series. Paid amounts stay
          linked when you extend a recurring plan. Nothing here records an
          actual payment.
        </p>
        <TaskFeedback task={task} />
        <label className={styles.field}>
          Show payments
          <select
            value={filter}
            onChange={(e) => {
              patch({ filter: e.target.value });
              setPage(0);
            }}
          >
            <option value="open">Unpaid, including overdue</option>
            <option value="paid">Fully matched</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All entered payments</option>
          </select>
        </label>
        {rows.slice(currentPage * 20, currentPage * 20 + 20).map((o) => (
          <article key={o.id} className={styles.row}>
            <div>
              <strong>{o.title}</strong>
              <p>
                {o.expected_date} · {o.direction} · remaining{" "}
                {fmt(remaining(o))} · due {o.due_date || "Not entered"}
                {o.cancelled
                  ? " · Cancelled"
                  : o.expected_date <= p.asOf && remaining(o) !== "0.00"
                    ? " · Review overdue timing"
                    : ""}
              </p>
              <p>
                {p.state.accounts.find((a) => a.id === o.account_id)?.name} ·
                original schedule {o.nominal_date}
              </p>
              {linkedDocument(o.commitment_id) && (
                <p>
                  Business document. Review credits and cancellation in Business
                  review.
                </p>
              )}
            </div>
            <button
              className={styles.secondary}
              disabled={task.pending}
              onClick={() => edit(o)}
            >
              Review payment
            </button>
          </article>
        ))}
        {!rows.length && <p>No payments in this view.</p>}
        {rows.length > 20 && (
          <div className={styles.actions}>
            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous payments
            </button>
            <span>
              Page {currentPage + 1} of {Math.ceil(rows.length / 20)}
            </span>
            <button
              disabled={(currentPage + 1) * 20 >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next payments
            </button>
          </div>
        )}
      </section>
      <section className={styles.card}>
        <h2>Recurring series and installments</h2>
        <p>
          Monthly dates clamp to the last available day. Split schedules keep
          separate payments when two dates land on the same day. A weekend rule
          moves the expected cash date; the original scheduled date stays
          visible.
        </p>
        {p.state.commitments.map((c) => (
          <article className={styles.row} key={c.id}>
            <div>
              <strong>{c.title}</strong>
              <p>
                {linkedDocument(c.id)
                  ? `Business document · original ${fmt(c.amount)}. Review credits and outstanding amounts in Business review.`
                  : c.recurrence === "installments"
                    ? "Entered installment dates"
                    : `${c.recurrence} · every ${c.interval_every}${c.recurrence_days?.length ? ` · days ${c.recurrence_days.join(", ")}` : ""} · ${fmt(c.amount)} per payment`}
                {c.cancelled ? " · Cancelled" : ""}
              </p>
              <p>
                {c.recurrence !== "once" && c.recurrence !== "installments"
                  ? `Generated through ${c.generated_through || "the original five-year horizon"}`
                  : `Starts ${c.start_date}`}
                {c.end_date ? ` · stops after nominal date ${c.end_date}` : ""}
              </p>
            </div>
            <div className={styles.actions}>
              {!c.cancelled &&
                !["once", "installments"].includes(c.recurrence) && (
                  <button
                    className={styles.secondary}
                    disabled={task.pending}
                    onClick={() => series(c.id, "extend")}
                  >
                    Extend reviewed horizon
                  </button>
                )}
              {!c.cancelled && !linkedDocument(c.id) && (
                <button
                  disabled={task.pending}
                  onClick={() => series(c.id, "cancel")}
                >
                  Cancel future series
                </button>
              )}
            </div>
          </article>
        ))}
        {!p.state.commitments.length && (
          <p>Use “Add upcoming money” to enter your first plan.</p>
        )}
      </section>
      <CashTaskDialog
        open={!!modal}
        close={() => setModal("")}
        title={
          modal === "edit"
            ? "Review an entered payment"
            : modal === "extend"
              ? "Extend a reviewed schedule"
              : "Cancel a future series"
        }
        pending={task.pending}
        submitLabel={
          modal === "cancel" ? "Confirm cancellation" : "Save reviewed change"
        }
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            if (modal === "edit" && selected)
              await p.mutate(
                `occurrences/${selected.id}`,
                linkedDocument(selected.commitment_id)
                  ? {
                      expected_date: draft.expected_date,
                      due_date: draft.due_date,
                    }
                  : {
                      title: draft.title,
                      amount: draft.amount,
                      expected_date: draft.expected_date,
                      due_date: draft.due_date || null,
                      cancelled: draft.cancelled === "yes",
                    },
              );
            if (modal === "extend" && commitment)
              await p.mutate(`commitments/${commitment.id}/extend`, {
                through: draft.through,
              });
            if (modal === "cancel" && commitment)
              await p.mutate(`commitments/${commitment.id}/cancel`);
            setModal("");
            p.saveDraft("plan_review", (old) => ({
              filter: old.filter || "open",
            }));
            task.setNotice(
              "Reviewed plan saved. Existing payment matches are preserved.",
            );
          });
        }}
      >
        {modal === "edit" && (
          <>
            {selected && linkedDocument(selected.commitment_id) ? (
              <p>
                Dates for {selected.title}. Review its amount, credits and
                cancellation in Business review; this task keeps the document
                and payment history intact.
              </p>
            ) : (
              <>
                <label className={styles.field}>
                  Payment description
                  <input
                    required
                    maxLength={255}
                    value={draft.title || ""}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  Full payment amount · {p.state.workspace.currency}
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
                    value={draft.amount || ""}
                    onChange={(e) => patch({ amount: e.target.value })}
                  />
                </label>
                <p>
                  The full amount includes money already matched. It cannot be
                  reduced below the matched amount.
                </p>
              </>
            )}
            <label className={styles.field}>
              Expected cash date
              <input
                required
                type="date"
                value={draft.expected_date || ""}
                {...dateInputChange((value) => patch({ expected_date: value }))}
              />
            </label>
            <label className={styles.field}>
              {selected && linkedDocument(selected.commitment_id)
                ? "Contractual due date"
                : "Contractual due date (optional)"}
              <input
                required={
                  !!selected && !!linkedDocument(selected.commitment_id)
                }
                type="date"
                value={draft.due_date || ""}
                {...dateInputChange((value) => patch({ due_date: value }))}
              />
            </label>
            {selected && !linkedDocument(selected.commitment_id) && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draft.cancelled === "yes"}
                  onChange={(e) =>
                    patch({ cancelled: e.target.checked ? "yes" : "" })
                  }
                />
                Cancel this payment’s remaining amount
              </label>
            )}
          </>
        )}
        {modal === "extend" && (
          <>
            <p>
              {commitment?.title}. Generate only missing payments. Existing
              edits, cancellations, and matches remain in place. Each review can
              add at most 1,000 payments.
            </p>
            <label className={styles.field}>
              Generate nominal dates through
              <input
                required
                type="date"
                max="2100-12-31"
                value={draft.through || ""}
                {...dateInputChange((value) => patch({ through: value }))}
              />
            </label>
          </>
        )}
        {modal === "cancel" && (
          <p>
            Cancel the remaining payments in {commitment?.title}? Recorded cash
            and existing matches remain in the history. Individual cancelled
            payments can be reviewed again.
          </p>
        )}
        <TaskFeedback task={task} />
      </CashTaskDialog>
    </section>
  );
}
