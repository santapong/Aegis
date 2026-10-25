"use client";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { everydayAPI, type CashAlert } from "@/lib/cashflow";
import {
  type EverydayProps,
  useCashTask,
  TaskFeedback,
  cashFormat,
} from "./everyday-common";
import styles from "./workspace.module.css";
const labels: Record<string, string> = {
  negative_cash: "Expected cash below zero",
  below_buffer: "Expected cash below your buffer",
  reserved_gap: "Your buffer and reservations do not fit",
  incomplete_inputs: "Review incomplete cash inputs",
};
export default function CashAlerts(p: EverydayProps) {
  const task = useCashTask();
  const attempted = useRef("");
  const accounts = p.accounts.join(",");
  const review = useQuery({
    queryKey: [
      "cash",
      p.owner,
      "alerts",
      p.wid,
      p.asOf,
      p.end,
      accounts,
      p.forecast?.base_revision,
    ],
    queryFn: () => everydayAPI.alerts(p.wid, p.asOf, p.end, p.accounts),
    enabled: p.active && !!p.forecast,
  });
  const attemptKey = [
    p.wid,
    p.asOf,
    p.end,
    accounts,
    review.data?.input_fingerprint,
  ].join(":");
  const latest = useRef(p);
  latest.current = p;
  const latestTask = useRef(task);
  latestTask.current = task;
  async function evaluate() {
    await latest.current.mutate("alerts/evaluate", {
      as_of: latest.current.asOf,
      end: latest.current.end,
      account_ids: latest.current.accounts,
    });
  }
  useEffect(() => {
    if (
      !p.active ||
      !review.data?.needs_evaluation ||
      attempted.current === attemptKey
    )
      return;
    attempted.current = attemptKey;
    void latestTask.current.run(evaluate);
  }, [p.active, review.data?.needs_evaluation, attemptKey]);
  const active = review.data?.alerts.filter((a) => !a.resolved_at) || [];
  const resolved = review.data?.alerts.filter((a) => a.resolved_at) || [];
  function detail(a: CashAlert) {
    const fmt = (s?: string) => cashFormat(s, a.details.currency);
    return (
      <details>
        <summary>Why this alert appeared</summary>
        <p>
          Base plan · {a.details.as_of} to {a.details.end} ·{" "}
          {a.details.account_ids
            .map(
              (id) =>
                p.state.accounts.find((x) => x.id === id)?.name ||
                "Cash account",
            )
            .join(", ")}
        </p>
        {a.details.cash != null && (
          <p>
            Expected cash {fmt(a.details.cash)} · buffer {fmt(a.details.buffer)}{" "}
            · reservations {fmt(a.details.reserved_cash)}. Cash includes entered
            actuals; future amounts are still plans.
          </p>
        )}
        {a.details.sources
          ?.slice()
          .sort(
            (x, y) =>
              x.expected_date.localeCompare(y.expected_date) ||
              x.id.localeCompare(y.id),
          )
          .map((o) => (
            <p key={o.id}>
              {o.expected_date} · {o.title} · {o.direction} · remaining{" "}
              {fmt(o.remaining || o.amount)}
            </p>
          ))}
        {a.details.opening_balances?.map((b, i) => (
          <p key={i}>
            Opening cash: {b.date} · {fmt(b.amount)} · {b.source}
          </p>
        ))}
        {a.details.recorded_sources?.length ? (
          <details>
            <summary>
              Recorded movements behind cash (
              {a.details.recorded_sources.length})
            </summary>
            {a.details.recorded_sources.map((t) => (
              <p key={t.id}>
                {t.date} · {t.title || t.kind} · cash effect{" "}
                {fmt(t.cash_effect)}
              </p>
            ))}
          </details>
        ) : null}
        {a.details.reservations?.map((g) => (
          <p key={g.id}>
            Reserved purpose: {g.name} · {fmt(g.amount)}. This money stays in
            its account.
          </p>
        ))}
        {a.details.warnings.map((w, i) => (
          <p className={styles.warning} key={i}>
            {w}
          </p>
        ))}
        {a.details.assumption && <p>{a.details.assumption}</p>}
        <p>
          Evaluated from base revision {a.base_revision}. Acknowledging keeps
          the condition visible until reviewed changes resolve it.
        </p>
      </details>
    );
  }
  return (
    <section
      className={styles.card}
      aria-label="Cash alerts"
      hidden={!p.active}
    >
      <span className={styles.eyebrow}>UNDERSTAND THE CASH GAP</span>
      <div className={styles.sectionHead}>
        <h2>Cash alerts</h2>
        <button disabled={task.pending} onClick={() => void task.run(evaluate)}>
          Refresh alert review
        </button>
      </div>
      <p>
        Alerts explain the base plan for these dates and included accounts.
        Comparisons remain separate. This review stays inside Aegis.
      </p>
      <TaskFeedback task={task} />
      {review.isError && (
        <p role="alert">
          Unable to load this alert scope.{" "}
          <button onClick={() => review.refetch()}>Retry alerts</button>
        </p>
      )}
      {(review.isFetching || task.pending) && (
        <p role="status">Checking the entered cash plan…</p>
      )}
      {review.data?.needs_evaluation && !task.pending && (
        <p className={styles.caption}>
          This scope needs a saved evaluation. Refresh the review before relying
          on its alert history.
        </p>
      )}
      {active.map((a) => (
        <article className={styles.importRow} key={a.id}>
          <div className={styles.sectionHead}>
            <strong>
              {labels[a.kind] || a.kind}
              {a.event_date ? ` · ${a.event_date}` : ""}
            </strong>
            {a.acknowledged ? (
              <span className={styles.caption}>Reviewed</span>
            ) : (
              <button
                disabled={task.pending || review.data?.needs_evaluation}
                onClick={() =>
                  void task.run(async () => {
                    await p.mutate(`alerts/${a.id}/acknowledge`);
                    task.setNotice(
                      "Alert marked as reviewed. Its condition stays visible until resolved.",
                    );
                  })
                }
              >
                Mark reviewed
              </button>
            )}
          </div>
          {detail(a)}
        </article>
      ))}
      {review.data?.scope &&
        !review.data.needs_evaluation &&
        !active.length && (
          <p className={styles.notice}>
            No cash-gap alerts in this entered base plan. Check your inputs and
            dates when the plan changes.
          </p>
        )}
      {!!resolved.length && (
        <details>
          <summary>Resolved alert history ({resolved.length})</summary>
          {resolved.map((a) => (
            <article className={styles.importRow} key={a.id}>
              <strong>
                {labels[a.kind]} · {a.event_date || "Inputs"}
              </strong>
              <p className={styles.caption}>
                Resolved {a.resolved_at?.slice(0, 10)}
              </p>
              {detail(a)}
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
