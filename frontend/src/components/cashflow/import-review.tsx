"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { everydayAPI, type ImportRow } from "@/lib/cashflow";
import {
  type EverydayProps,
  useCashTask,
  TaskFeedback,
  CashTaskDialog,
  cashFormat,
} from "./everyday-common";
import styles from "./workspace.module.css";

export default function ImportReview(p: EverydayProps) {
  const task = useCashTask();
  const draft = p.drafts.csv || {};
  const patch = (values: Record<string, string>) =>
    p.saveDraft("csv", (old) => ({ ...old, ...values }));
  const [confirming, setConfirming] = useState(false);
  const fileRead = useRef(0);
  const batches = useQuery({
    queryKey: ["cash", p.owner, "imports", p.wid],
    queryFn: () => everydayAPI.imports(p.wid),
    enabled: p.active,
  });
  const bid = draft.batch_id || batches.data?.[0]?.id || "";
  const review = useQuery({
    queryKey: ["cash", p.owner, "import", p.wid, bid],
    queryFn: () => everydayAPI.import(p.wid, bid),
    enabled: p.active && !!bid,
  });
  const selected =
    review.data?.rows.filter(
      (r) => r.status === "pending" && draft["select_" + r.id] === "yes",
    ) || [];
  const accounts = p.state.accounts.filter((a) => !a.archived);
  const accountId = draft.account_id || accounts[0]?.id || "";
  const fmt = (value?: string) => cashFormat(value, p.state.workspace.currency);
  async function loadFile(file?: File) {
    if (!file) return;
    const token = ++fileRead.current;
    if (file.size > 262144) {
      task.setError("Choose a UTF-8 CSV up to 256 KiB.");
      return;
    }
    try {
      const content = await file.text();
      if (token === fileRead.current) {
        patch({ content, filename: file.name, currency_confirmed: "" });
        task.setError("");
      }
    } catch {
      task.setError(
        "The file could not be read. Your previous draft is still available.",
      );
    }
  }
  function match(row: ImportRow, id: string) {
    patch({
      ["match_" + row.id]: id,
      ["match_amount_" + row.id]:
        row.candidate_matches.find((m) => m.id === id)?.suggested_amount || "",
    });
  }
  return (
    <section className={styles.card} aria-label="CSV review" hidden={!p.active}>
      <span className={styles.eyebrow}>REVIEW BEFORE RECORDING</span>
      <h2>Bring in a CSV, one reviewed batch at a time.</h2>
      <p>
        The file is saved for review first. Only selected, confirmed rows become
        recorded money. Re-uploading a file does not automatically import it.
      </p>
      <details>
        <summary>CSV format and example</summary>
        <p>
          UTF-8, up to 256 KiB and 500 rows. Required columns:
          date,description,amount,type,currency. Optional: reference,category.
          Use YYYY-MM-DD, positive amounts with up to two decimals, and income
          or expense.
        </p>
        <a href="/docs/example-cash-import.csv" download>
          Download a fictional CSV example
        </a>
        <p>
          Adjust dates to money that has already moved. Each row must use{" "}
          {p.state.workspace.currency}; no conversion is performed.
        </p>
      </details>
      <form
        className={styles.taskGrid}
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            if (!draft.content?.trim() || draft.currency_confirmed !== "yes")
              throw new Error(
                "Choose a file and explicitly confirm its currency before saving the review batch.",
              );
            const saved = await p.mutate<{ id: string; revision: number }>(
              "imports",
              {
                account_id: accountId,
                filename: draft.filename || "pasted-cash.csv",
                content: draft.content,
                confirmed_currency: p.state.workspace.currency,
              },
            );
            patch({
              batch_id: saved.id,
              content: "",
              filename: "",
              currency_confirmed: "",
            });
            task.setNotice("Review batch saved. No cash has been posted.");
          });
        }}
      >
        <label className={styles.field}>
          Destination cash account
          <select
            required
            disabled={task.pending}
            value={accountId}
            onChange={(e) =>
              patch({ account_id: e.target.value, currency_confirmed: "" })
            }
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={task.pending}
            onChange={(e) => void loadFile(e.currentTarget.files?.[0])}
          />
        </label>
        <label className={styles.field}>
          CSV contents
          <textarea
            rows={4}
            value={draft.content || ""}
            disabled={task.pending}
            onChange={(e) =>
              patch({ content: e.target.value, currency_confirmed: "" })
            }
            placeholder="date,description,amount,type,currency"
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            disabled={task.pending}
            checked={draft.currency_confirmed === "yes"}
            onChange={(e) =>
              patch({ currency_confirmed: e.target.checked ? "yes" : "" })
            }
          />
          I checked that these rows use {p.state.workspace.currency} and belong
          to the selected account.
        </label>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="submit"
            disabled={task.pending || !accounts.length}
          >
            Save review batch
          </button>
        </div>
      </form>
      <TaskFeedback task={task} />
      {batches.isError && (
        <p role="alert">
          Unable to load saved batches.{" "}
          <button onClick={() => batches.refetch()}>Retry batches</button>
        </p>
      )}
      {!!batches.data?.length && (
        <label className={styles.field}>
          Saved review batch
          <select
            value={bid}
            disabled={task.pending}
            onChange={(e) => patch({ batch_id: e.target.value })}
          >
            {batches.data.map((b) => (
              <option key={b.id} value={b.id}>
                {b.filename} · {b.imported_count}/{b.row_count} posted ·{" "}
                {b.created_at.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>
      )}
      {review.isError && (
        <p role="alert">
          Unable to load this review.{" "}
          <button onClick={() => review.refetch()}>Retry review</button>
        </p>
      )}
      {review.data && (
        <>
          <p className={styles.caption}>
            Saved destination:{" "}
            {
              p.state.accounts.find(
                (a) => a.id === review.data.batch.account_id,
              )?.name
            }{" "}
            · {review.data.batch.currency}. Changing the upload account does not
            remap a saved batch.
          </p>
          <p>{review.data.message}</p>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!selected.length || task.pending}
              onClick={() => setConfirming(true)}
            >
              Review {selected.length} selected{" "}
              {selected.length === 1 ? "row" : "rows"}
            </button>
          </div>
          <div className={styles.reviewRows}>
            {review.data.rows.map((row) => (
              <article className={styles.importRow} key={row.id}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    disabled={row.status !== "pending" || task.pending}
                    checked={
                      row.status === "pending" &&
                      draft["select_" + row.id] === "yes"
                    }
                    onChange={(e) =>
                      patch({
                        ["select_" + row.id]: e.target.checked ? "yes" : "",
                      })
                    }
                  />
                  Row {row.row_number}:{" "}
                  <strong>
                    {row.payload?.title || row.raw.description || "Invalid row"}
                  </strong>
                </label>
                <p>
                  {row.payload?.date || row.raw.date} ·{" "}
                  {row.status === "invalid"
                    ? `${row.raw.currency || "Unknown currency"} ${row.raw.amount || "—"}`
                    : fmt(row.payload?.amount)}{" "}
                  · {row.payload?.direction || row.raw.type} ·{" "}
                  {row.status === "imported"
                    ? "Recorded once"
                    : row.status === "invalid"
                      ? "Needs a corrected file"
                      : "Not recorded"}
                </p>
                {row.errors.length > 0 && (
                  <ul className={styles.warning}>
                    {row.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                )}
                {!!row.possible_duplicates.length && (
                  <div className={styles.warning}>
                    <strong>Possible duplicate — review it</strong>
                    <p>
                      Equal details are a signal, not proof. Leave this row
                      unchecked if it is already recorded.
                    </p>
                    <details>
                      <summary>
                        Inspect {row.possible_duplicates.length} similar{" "}
                        {row.possible_duplicates.length === 1
                          ? "entry"
                          : "entries"}
                      </summary>
                      {row.possible_duplicates.map((d, i) => (
                        <p key={i}>
                          {d.kind === "same_batch_row"
                            ? `Another row in this file: ${d.row_number}`
                            : d.kind === "same_reference"
                              ? `Recorded bank reference: ${d.reference}`
                              : `${d.date} · ${d.title} · ${fmt(d.amount)}`}
                        </p>
                      ))}
                    </details>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        disabled={task.pending}
                        checked={draft["distinct_" + row.id] === "yes"}
                        onChange={(e) =>
                          patch({
                            ["distinct_" + row.id]: e.target.checked
                              ? "yes"
                              : "",
                          })
                        }
                      />
                      Keep as a separate record; I checked this is distinct.
                    </label>
                  </div>
                )}
                {row.status === "pending" && (
                  <div className={styles.taskGrid}>
                    <label className={styles.field}>
                      Optional payment match for row {row.row_number}
                      <select
                        disabled={task.pending}
                        value={draft["match_" + row.id] || ""}
                        onChange={(e) => match(row, e.target.value)}
                      >
                        <option value="">Do not match</option>
                        {row.candidate_matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} · expected {m.expected_date} · remaining{" "}
                            {fmt(m.remaining)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft["match_" + row.id] && (
                      <label className={styles.field}>
                        Reviewed match amount · {p.state.workspace.currency}
                        <input
                          inputMode="decimal"
                          disabled={task.pending}
                          value={draft["match_amount_" + row.id] || ""}
                          onChange={(e) =>
                            patch({
                              ["match_amount_" + row.id]: e.target.value,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <CashTaskDialog
        open={confirming}
        close={() => setConfirming(false)}
        title="Confirm reviewed CSV rows"
        pending={task.pending}
        submitLabel="Confirm selected rows"
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(async () => {
            if (!selected.length)
              throw new Error("Choose at least one valid, unposted row.");
            const rows = selected.map((row) => {
              if (
                row.possible_duplicates.length &&
                draft["distinct_" + row.id] !== "yes"
              )
                throw new Error(
                  `Review the possible duplicate at row ${row.row_number} before confirming.`,
                );
              return {
                row_id: row.id,
                decision:
                  draft["distinct_" + row.id] === "yes"
                    ? "keep_distinct"
                    : "import",
                ...(draft["match_" + row.id]
                  ? {
                      occurrence_id: draft["match_" + row.id],
                      match_amount: draft["match_amount_" + row.id],
                    }
                  : {}),
              };
            });
            const result = await p.mutate<{
              imported_count: number;
              revision: number;
            }>(`imports/${encodeURIComponent(bid)}/confirm`, { rows });
            p.saveDraft("csv", (old) => {
              const next = { ...old };
              selected.forEach((r) => {
                delete next["select_" + r.id];
              });
              return next;
            });
            setConfirming(false);
            task.setNotice(
              `${result.imported_count} reviewed ${result.imported_count === 1 ? "row was" : "rows were"} recorded. Matching changes the unpaid plan, not cash a second time.`,
            );
          });
        }}
      >
        <p>
          This records {selected.length} selected movements in{" "}
          {
            p.state.accounts.find((a) => a.id === review.data?.batch.account_id)
              ?.name
          }{" "}
          · {p.state.workspace.currency}. Unselected and invalid rows stay in
          the review.
        </p>
        {selected.map((row) => (
          <p key={row.id}>
            {row.payload?.date} · {row.payload?.title} ·{" "}
            {fmt(row.payload?.amount)} · {row.payload?.direction}
            {draft["match_" + row.id] ? " · reviewed payment match" : ""}
          </p>
        ))}
        <p>
          Any failed or stale selection stops the whole confirmation. A
          confirmed row cannot be posted again, even after a recorded-entry
          correction.
        </p>
        <TaskFeedback task={task} />
      </CashTaskDialog>
    </section>
  );
}
