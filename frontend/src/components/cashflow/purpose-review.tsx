"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { everydayAPI } from "@/lib/cashflow";
import {
  type EverydayProps,
  useCashTask,
  TaskFeedback,
  CashTaskDialog,
  cashFormat,
  dateInputChange,
} from "./everyday-common";
import styles from "./workspace.module.css";
export default function PurposeReview(p: EverydayProps) {
  const task = useCashTask();
  const [modal, setModal] = useState<
    "goal" | "installments" | "release" | "resize" | ""
  >("");
  const kind =
    modal === "installments"
      ? "installment_draft"
      : modal === "release" || modal === "resize"
        ? "allocation_edit"
        : "allocation_draft";
  const draft = p.drafts[kind] || {};
  const patch = (values: Record<string, string>) =>
    p.saveDraft(kind, (old) => ({ ...old, ...values }));
  const sources = useQuery({
    queryKey: ["cash", p.owner, "purpose-sources", p.wid],
    queryFn: () => everydayAPI.purposeSources(p.wid),
    enabled: p.active,
  });
  const accounts = p.state.accounts.filter((a) => !a.archived);
  const accountId = draft.account_id || accounts[0]?.id || "";
  const mode = draft.mode || "reserved";
  const transfers = p.state.transfers.filter(
    (t) => t.from_account_id === accountId || t.to_account_id === accountId,
  );
  const transfer = transfers.find((t) => t.id === draft.transfer_id);
  const selected = p.state.goal_allocations.find(
    (g) => g.id === draft.allocation_id,
  );
  const count = Number(draft.count || 3);
  const fmt = (s?: string) => cashFormat(s, p.state.workspace.currency);
  function openForm(action: "goal" | "installments") {
    task.setError("");
    task.setNotice("");
    setModal(action);
  }
  function edit(id: string, action: "release" | "resize") {
    task.setError("");
    task.setNotice("");
    const allocation = p.state.goal_allocations.find((g) => g.id === id)!;
    p.saveDraft("allocation_edit", (old) =>
      old.allocation_id === id
        ? { ...old, allocation_id: id, amount: old.amount || allocation.amount }
        : { allocation_id: id, amount: allocation.amount },
    );
    setModal(action);
  }
  const moneyField = (label: string, name: string, defaultValue = "") => (
    <label className={styles.field}>
      {label} · {p.state.workspace.currency}
      <input
        required
        inputMode="decimal"
        pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
        value={draft[name] ?? defaultValue}
        onChange={(e) => patch({ [name]: e.target.value })}
      />
    </label>
  );
  return (
    <section aria-label="Goals and installments" hidden={!p.active}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>GIVE CASH A PURPOSE</span>
        <h2>Goals without counting money twice.</h2>
        <p>
          A reservation leaves money in its account and reduces available
          headroom. A transferred goal links a transfer you already recorded. It
          creates no second cash movement or reservation.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.primary}
            disabled={!accounts.length || task.pending}
            onClick={() => openForm("goal")}
          >
            Add a goal allocation
          </button>
        </div>
        <TaskFeedback task={task} />
        {p.state.goal_allocations.map((g) => (
          <article className={styles.row} key={g.id}>
            <div>
              <strong>{g.name}</strong>
              <p>
                {fmt(g.amount)} ·{" "}
                {g.mode === "reserved"
                  ? "Reserved in the account"
                  : "Linked to a recorded transfer"}{" "}
                · {p.state.accounts.find((a) => a.id === g.account_id)?.name}
                {g.released ? " · Released" : ""}
              </p>
            </div>
            {!g.released && (
              <div className={styles.actions}>
                {g.mode === "reserved" && (
                  <button
                    disabled={task.pending}
                    onClick={() => edit(g.id, "resize")}
                  >
                    Review reserved amount
                  </button>
                )}
                <button
                  disabled={task.pending}
                  onClick={() => edit(g.id, "release")}
                >
                  Release allocation
                </button>
              </div>
            )}
          </article>
        ))}
        {!p.state.goal_allocations.length && (
          <p>No cash has been reserved for a goal in this workspace.</p>
        )}
      </section>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          ENTER WHAT YOU OWE WHEN YOU KNOW IT
        </span>
        <h2>Installments on real dates</h2>
        <p>
          Enter each expected payment and its full amount. You can link an
          existing debt after checking its currency. Aegis does not calculate
          interest, amortization, or update the debt’s principal from these
          entered dates.
        </p>
        <button
          className={styles.secondary}
          disabled={!accounts.length || task.pending}
          onClick={() => openForm("installments")}
        >
          Enter an installment schedule
        </button>
        {p.state.installment_schedules.map((s) => {
          const c = p.state.commitments.find((x) => x.id === s.commitment_id);
          return (
            <article className={styles.row} key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>
                  {
                    p.state.occurrences.filter(
                      (o) => o.commitment_id === s.commitment_id,
                    ).length
                  }{" "}
                  entered payments ·{" "}
                  {s.debt_id ? "Linked debt" : "Manual schedule"}
                  {c?.cancelled ? " · Cancelled" : ""}
                </p>
                <p>
                  Review dates, matches, and cancellations in Upcoming plans.
                </p>
              </div>
            </article>
          );
        })}
      </section>
      <CashTaskDialog
        open={!!modal}
        close={() => setModal("")}
        title={
          modal === "goal"
            ? "Allocate cash to a goal"
            : modal === "installments"
              ? "Enter an installment schedule"
              : modal === "resize"
                ? "Review reserved cash"
                : "Release a goal allocation"
        }
        pending={task.pending}
        submitLabel={
          modal === "release"
            ? "Confirm release"
            : modal === "installments"
              ? "Save entered schedule"
              : "Save reviewed allocation"
        }
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            if (modal === "goal" || modal === "installments") {
              if (draft.confirmed !== "yes")
                throw new Error(
                  `Confirm the selected account and ${p.state.workspace.currency} currency first.`,
                );
              if (modal === "goal") {
                if (mode === "transferred" && !transfer)
                  throw new Error(
                    "Select the existing recorded transfer to link.",
                  );
                await p.mutate("goal-allocations", {
                  account_id: accountId,
                  name: draft.name,
                  amount:
                    mode === "transferred" ? transfer!.amount : draft.amount,
                  mode,
                  goal_id: draft.goal_id || null,
                  transfer_id: mode === "transferred" ? transfer!.id : null,
                  confirmed_currency: p.state.workspace.currency,
                });
              } else
                await p.mutate("installments", {
                  account_id: accountId,
                  name: draft.name,
                  debt_id: draft.debt_id || null,
                  confirmed_currency: p.state.workspace.currency,
                  entries: Array.from({ length: count }, (_, i) => ({
                    date: draft[`date_${i}`] || "",
                    amount: draft[`amount_${i}`] || "",
                  })),
                });
            } else if (selected)
              await p.mutate(
                `goal-allocations/${selected.id}`,
                modal === "release"
                  ? { released: true }
                  : { amount: draft.amount },
              );
            p.saveDraft(kind, () => ({}));
            setModal("");
            task.setNotice(
              "Saved. Reserved headroom and entered payments have been recalculated. Legacy goal progress and debt principal are unchanged.",
            );
          });
        }}
      >
        {(modal === "goal" || modal === "installments") && (
          <>
            <label className={styles.field}>
              {modal === "goal" ? "Goal name" : "Installment name"}
              <input
                required
                maxLength={100}
                value={draft.name || ""}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Cash account for this purpose
              <select
                required
                value={accountId}
                onChange={(e) =>
                  patch({
                    account_id: e.target.value,
                    transfer_id: "",
                    confirmed: "",
                  })
                }
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </label>
            {sources.isError && (
              <p role="alert">
                Existing goals and debts could not load.{" "}
                <button type="button" onClick={() => sources.refetch()}>
                  Retry purpose sources
                </button>
              </p>
            )}
            {modal === "goal" ? (
              <>
                <label className={styles.field}>
                  How is this money set aside?
                  <select
                    value={mode}
                    onChange={(e) =>
                      patch({
                        mode: e.target.value,
                        transfer_id: "",
                        confirmed: "",
                      })
                    }
                  >
                    <option value="reserved">
                      Reserve within the selected account
                    </option>
                    <option value="transferred">
                      Link an existing recorded transfer
                    </option>
                  </select>
                </label>
                {mode === "reserved" ? (
                  moneyField("Amount to reserve", "amount")
                ) : (
                  <>
                    <label className={styles.field}>
                      Existing transfer
                      <select
                        required
                        value={draft.transfer_id || ""}
                        onChange={(e) =>
                          patch({ transfer_id: e.target.value, confirmed: "" })
                        }
                      >
                        <option value="">Choose a recorded transfer</option>
                        {transfers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.date} · {t.description} · {fmt(t.amount)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      Linked amount: {fmt(transfer?.amount)}. This allocation
                      does not reserve or move cash again. Each transfer can be
                      linked once.
                    </p>
                  </>
                )}
                <label className={styles.field}>
                  Existing savings goal (optional)
                  <select
                    value={draft.goal_id || ""}
                    onChange={(e) =>
                      patch({ goal_id: e.target.value, confirmed: "" })
                    }
                  >
                    <option value="">Keep as a new cash purpose</option>
                    {sources.data?.goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  Existing debt (optional)
                  <select
                    value={draft.debt_id || ""}
                    onChange={(e) =>
                      patch({ debt_id: e.target.value, confirmed: "" })
                    }
                  >
                    <option value="">Manual entered schedule</option>
                    {sources.data?.debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                {Array.from({ length: count }, (_, i) => (
                  <fieldset key={i}>
                    <legend>Payment {i + 1}</legend>
                    <label className={styles.field}>
                      Installment date {i + 1}
                      <input
                        required
                        type="date"
                        value={draft[`date_${i}`] || ""}
                        {...dateInputChange((value) =>
                          patch({ [`date_${i}`]: value }),
                        )}
                      />
                    </label>
                    {moneyField(`Installment amount ${i + 1}`, `amount_${i}`)}
                  </fieldset>
                ))}
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={count >= 60}
                    onClick={() => patch({ count: String(count + 1) })}
                  >
                    Add payment date
                  </button>
                  <button
                    type="button"
                    disabled={count <= 1}
                    onClick={() => patch({ count: String(count - 1) })}
                  >
                    Remove last date
                  </button>
                </div>
              </>
            )}
            <p>
              Existing goal and debt records do not carry a trusted currency.
              Check the original record before linking it.
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
              I checked this purpose, linked record if any, and selected account
              use {p.state.workspace.currency}.
            </label>
          </>
        )}
        {modal === "resize" && (
          <>
            <p>
              {selected?.name}. Updating this reservation changes available
              headroom, with no recorded cash movement.
            </p>
            {moneyField("Reviewed reserved amount", "amount")}
          </>
        )}
        {modal === "release" && (
          <p>
            Release {selected?.name} ({fmt(selected?.amount)})? A reservation
            stops reducing headroom. Releasing a transfer link does not reverse
            the recorded transfer.
          </p>
        )}
        <TaskFeedback task={task} />
      </CashTaskDialog>
    </section>
  );
}
