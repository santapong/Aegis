"use client";

import { useRef, useState } from "react";
import {
  financeAPI,
  formatTHB,
  newCommandKey,
  type DraftPayload,
  type FinanceAccount,
  type FinancialTransaction,
  type Operation,
} from "@/lib/finance-api";
import type { Trip } from "@/types";
import { DraftForm, operationLabels } from "./draft-form";
import { FinanceError } from "./shared";
import s from "./finance.module.css";

export function PostedCorrection({
  row,
  accounts,
  transactions,
  trips,
  onUpdated,
}: {
  row: FinancialTransaction;
  accounts: FinanceAccount[];
  transactions: FinancialTransaction[];
  trips: Trip[];
  onUpdated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"closed" | "correction" | "classification">(
    "closed",
  );
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [replacement, setReplacement] = useState(false);
  const [afterCutoff, setAfterCutoff] = useState(false);
  const [review, setReview] = useState<{
    correction_effective_on: string;
    cutoff_resolution?: "after" | null;
    reason: string;
    replacement: DraftPayload | null;
  } | null>(null);
  const [checked, setChecked] = useState(false);
  const [category, setCategory] = useState(row.category || "uncategorized");
  const [trip, setTrip] = useState(row.trip_id || "");
  const [tags, setTags] = useState(row.tags?.join(", ") || "");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const key = useRef<string | null>(null);
  const classificationKey = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );
  const id = row.journal_entry_id || row.journal_id || row.id;
  const kind = row.operation_kind || row.type || row.kind || "";
  const sameCutoffDay = accounts.some(
    (account) =>
      account.opening &&
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(account.opening.cutoff_at)) === date,
  );
  function prepare(payload: DraftPayload | null) {
    setError(null);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(new Error("Choose the correction’s effective occurrence date."));
      return;
    }
    if (!reason.trim()) {
      setError(new Error("Explain why this correction is needed."));
      return;
    }
    if (sameCutoffDay && !afterCutoff) {
      setError(
        new Error(
          "Review whether this correction occurred after the affected account’s opening snapshot.",
        ),
      );
      return;
    }
    setReview({
      correction_effective_on: date,
      cutoff_resolution: sameCutoffDay && afterCutoff ? "after" : null,
      reason: reason.trim(),
      replacement: payload,
    });
    key.current = newCommandKey();
    setChecked(false);
  }
  async function post(classification = false) {
    if (inFlight.current || (!classification && (!review || !checked))) return;
    if (classification && (!category.trim() || !reason.trim())) {
      setError(
        new Error(
          "Provide a category and an audit reason for the classification change.",
        ),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (classification) {
        const body = {
          category: category.trim(),
          trip_id: trip || null,
          tags: [
            ...new Set(
              tags
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ],
          reason: reason.trim(),
        };
        const fingerprint = JSON.stringify(body);
        if (classificationKey.current?.fingerprint !== fingerprint)
          classificationKey.current = { fingerprint, key: newCommandKey() };
        await financeAPI.classifyTransaction(
          id,
          body,
          classificationKey.current.key,
        );
      } else if (review)
        await financeAPI.correctTransaction(
          id,
          review,
          key.current || newCommandKey(),
        );
      setNotice(
        classification
          ? "Classification updated with its audit reason. Account balances are unchanged."
          : "Correction posted. The original and its reversing entry remain in activity.",
      );
      setMode("closed");
      setReview(null);
      setChecked(false);
      await onUpdated();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  if (mode === "closed")
    return (
      <div className={s.stack}>
        {notice && (
          <p role="status" className={s.notice}>
            {notice}
          </p>
        )}
        <div className={s.actions}>
          {!row.reversed &&
            !row.reversal_of &&
            !["opening", "reversal"].includes(kind) && (
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                onClick={() => {
                  setMode("correction");
                  setReason("");
                  setError(null);
                }}
              >
                Correct financial facts…
              </button>
            )}
          <button
            type="button"
            className={`${s.button} ${s.secondary}`}
            onClick={() => {
              setMode("classification");
              setReason("");
              setError(null);
            }}
          >
            Change classification…
          </button>
        </div>
        {error != null && <FinanceError error={error} />}
      </div>
    );
  return (
    <div className={`${s.notice} ${s.stack}`}>
      <h3>
        {mode === "correction"
          ? "Correct a posted movement"
          : "Change reporting classification"}
      </h3>
      <p className={s.muted}>
        Original: {row.occurred_on} ·{" "}
        {operationLabels[kind as Operation] || kind} ·{" "}
        {formatTHB(row.amount_minor)}.{" "}
        {mode === "correction"
          ? "Financial corrections create a reversing entry and, optionally, a replacement. Both remain in history."
          : "Category, trip and tag changes keep an audit record and leave balances unchanged."}
      </p>
      {review ? (
        <>
          <p>
            <strong>
              Effective correction date: {review.correction_effective_on}
            </strong>
          </p>
          <p>Reason: {review.reason}</p>
          <p>
            {review.replacement
              ? `Reverse the original and post ${operationLabels[review.replacement.type]} for ${formatTHB(review.replacement.amount_minor)} on the effective date.`
              : "Reverse the original without a replacement."}
          </p>
          {review.replacement && (
            <dl className={s.detail}>
              <div>
                <dt>Money leaves</dt>
                <dd>
                  {accounts.find(
                    (account) =>
                      account.id === review.replacement?.source_account_id,
                  )?.name || "—"}
                </dd>
              </div>
              <div>
                <dt>Money received by</dt>
                <dd>
                  {accounts.find(
                    (account) =>
                      account.id === review.replacement?.target_account_id,
                  )?.name || "—"}
                </dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{review.replacement.category}</dd>
              </div>
            </dl>
          )}
          <label className={s.check}>
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              I reviewed this correction and its date. I understand it updates
              tracked balances and preserves the original history.
            </span>
          </label>
          <div className={s.actions}>
            <button
              className={s.button}
              type="button"
              disabled={busy || !checked}
              onClick={() => void post()}
            >
              Confirm correction
            </button>
            <button
              className={`${s.button} ${s.secondary}`}
              type="button"
              disabled={busy}
              onClick={() => {
                setReview(null);
                setChecked(false);
              }}
            >
              Edit correction
            </button>
          </div>
        </>
      ) : (
        <>
          {mode === "correction" && (
            <label className={s.field}>
              Effective correction date · Bangkok
              <input
                type="date"
                required
                value={date}
                disabled={busy}
                onInput={(event) => {
                  setDate(event.currentTarget.value);
                  setAfterCutoff(false);
                }}
                onChange={(event) => {
                  setDate(event.target.value);
                  setAfterCutoff(false);
                }}
              />
              <small>
                The reversal and replacement use this explicit date. Past
                activity is retained.
              </small>
            </label>
          )}
          {mode === "correction" && sameCutoffDay && (
            <label className={s.check}>
              <input
                type="checkbox"
                disabled={busy}
                checked={afterCutoff}
                onChange={(event) => setAfterCutoff(event.target.checked)}
              />
              <span>
                I verified this correction occurred after each affected
                account’s opening snapshot on this date.
              </span>
            </label>
          )}
          <label className={s.field}>
            Audit reason
            <textarea
              required
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {mode === "correction" ? (
            <>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={replacement}
                  disabled={busy}
                  onChange={(event) => setReplacement(event.target.checked)}
                />
                <span>
                  Post a corrected replacement along with the reversal.
                </span>
              </label>
              {replacement ? (
                date ? (
                  <DraftForm
                    key={date}
                    correctionDate={date}
                    initial={{
                      type: kind as Operation,
                      currency: row.currency,
                      amount_minor: row.amount_minor,
                      occurred_on: date,
                      category: row.category,
                      description: row.description,
                      trip_id: row.trip_id,
                      tags: row.tags,
                    }}
                    accounts={accounts}
                    transactions={transactions}
                    trips={trips}
                    busy={busy}
                    onSave={async (payload) => prepare(payload)}
                  />
                ) : (
                  <p className={s.muted}>
                    Choose the effective correction date before preparing a
                    replacement.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  className={s.button}
                  disabled={busy}
                  onClick={() => prepare(null)}
                >
                  Review reversal
                </button>
              )}
              <p className={s.muted}>
                An expense with active linked refunds cannot be reversed until
                that refund chain is resolved. The server validates this before
                any posting.
              </p>
            </>
          ) : (
            <>
              <div className={s.fields}>
                <label className={s.field}>
                  Category
                  <input
                    required
                    maxLength={100}
                    disabled={busy}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  />
                </label>
                <label className={s.field}>
                  Trip
                  <select
                    value={trip}
                    disabled={busy}
                    onChange={(event) => setTrip(event.target.value)}
                  >
                    <option value="">No trip</option>
                    {trip && !trips.some((row) => row.id === trip) && (
                      <option value={trip}>Existing assigned trip</option>
                    )}
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={s.field}>
                Tags
                <input
                  disabled={busy}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="Comma-separated tags"
                />
              </label>
              <button
                className={s.button}
                type="button"
                disabled={busy || !reason.trim() || !category.trim()}
                onClick={() => void post(true)}
              >
                Save classification with audit reason
              </button>
            </>
          )}
        </>
      )}
      {error != null && <FinanceError error={error} />}
      <button
        type="button"
        className={`${s.button} ${s.secondary}`}
        disabled={busy}
        onClick={() => {
          setMode("closed");
          setReview(null);
          setError(null);
        }}
      >
        Keep original
      </button>
    </div>
  );
}
