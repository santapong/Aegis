"use client";

import { useState } from "react";
import {
  minorToInput,
  formatLedgerAmount,
  parseTHB,
  type DraftPayload,
  type FinanceAccount,
  type FinancialTransaction,
  type Operation,
} from "@/lib/finance-api";
import type { Trip } from "@/types";
import { FinanceError } from "./shared";
import s from "./finance.module.css";

export const operationLabels: Record<Operation, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Own-account transfer",
  card_purchase: "Card purchase",
  card_repayment: "Card repayment",
  refund: "Linked refund",
};

function bangkokDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function DraftForm({
  initial,
  accounts,
  transactions,
  trips,
  busy,
  onSave,
  onCancel,
  correctionDate,
  allowDistinct = false,
}: {
  initial?: Partial<DraftPayload>;
  accounts: FinanceAccount[];
  transactions: FinancialTransaction[];
  trips: Trip[];
  busy: boolean;
  onSave: (payload: DraftPayload) => Promise<void>;
  onCancel?: () => void;
  correctionDate?: string;
  allowDistinct?: boolean;
}) {
  const [type, setType] = useState<Operation>(initial?.type || "expense");
  const [amount, setAmount] = useState(() => {
    try {
      return initial?.amount_minor ? minorToInput(initial.amount_minor) : "";
    } catch {
      return "";
    }
  });
  const [inputDate, setDate] = useState(
    initial?.occurred_on || bangkokDay(new Date().toISOString()),
  );
  const date = correctionDate || inputDate;
  const [source, setSource] = useState(initial?.source_account_id || "");
  const [target, setTarget] = useState(initial?.target_account_id || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [trip, setTrip] = useState(initial?.trip_id || "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") || "");
  const [original, setOriginal] = useState(
    initial?.original_expense_entry_id || "",
  );
  const [after, setAfter] = useState(initial?.cutoff_resolution === "after");
  const [distinct, setDistinct] = useState(
    initial?.duplicate_resolution === "distinct",
  );
  const [error, setError] = useState<unknown>(null);
  const needsCurrencyReview = !!initial && initial.currency !== "THB";
  const [currencyReviewed, setCurrencyReviewed] = useState(false);
  const needsSource = [
    "expense",
    "transfer",
    "card_purchase",
    "card_repayment",
  ].includes(type);
  const needsTarget = [
    "income",
    "transfer",
    "card_repayment",
    "refund",
  ].includes(type);
  const selectedAccounts = accounts.filter(
    (account) => account.id === source || account.id === target,
  );
  const sameDay = selectedAccounts.some(
    (account) =>
      account.opening && bangkokDay(account.opening.cutoff_at) === date,
  );
  const sourceOptions = accounts.filter(
    (account) =>
      !!account.opening &&
      (type === "card_purchase"
        ? account.subtype === "card"
        : account.subtype !== "card"),
  );
  const targetOptions = accounts.filter(
    (account) =>
      !!account.opening &&
      (type === "card_repayment"
        ? account.subtype === "card"
        : type === "refund" || account.subtype !== "card"),
  );
  const originals = transactions.filter((transaction) =>
    ["expense", "card_purchase"].includes(
      transaction.operation_kind || transaction.type || transaction.kind || "",
    ),
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (needsCurrencyReview && !currencyReviewed)
        throw new Error(
          "Verify the source currency before changing this proposal to THB.",
        );
      const payload: DraftPayload = {
        type,
        amount_minor: parseTHB(amount),
        currency: "THB",
        occurred_on: date,
        date_precision:
          initial?.date_precision === "instant" &&
          initial.occurred_on === date &&
          !correctionDate
            ? "instant"
            : "day",
        occurred_at:
          initial?.date_precision === "instant" &&
          initial.occurred_on === date &&
          !correctionDate
            ? initial.occurred_at || null
            : null,
        source_account_id: needsSource ? source : null,
        target_account_id: needsTarget ? target : null,
        category: category.trim() || "uncategorized",
        description: description.trim(),
        trip_id: trip || null,
        tags: [
          ...new Set(
            tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
        original_expense_entry_id: type === "refund" ? original : null,
        cutoff_resolution: sameDay && after ? "after" : null,
        duplicate_resolution: distinct ? "distinct" : null,
      };
      if (needsSource && !source)
        throw new Error("Choose the account money leaves.");
      if (needsTarget && !target)
        throw new Error("Choose the receiving account.");
      if (needsSource && needsTarget && source === target)
        throw new Error("Choose two different accounts.");
      if (type === "refund" && !original)
        throw new Error("Choose the original posted expense for this refund.");
      await onSave(payload);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <form className={s.form} onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy} className={s.form}>
        {needsCurrencyReview && (
          <div className={s.notice}>
            <p>
              Source currency: {initial?.currency || "unresolved"}. This account
              tracker supports THB. No conversion rate is applied.
            </p>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={currencyReviewed}
                onChange={(event) => setCurrencyReviewed(event.target.checked)}
              />
              <span>
                I verified the original source and the entered amount is THB. I
                am correcting the proposal’s currency.
              </span>
            </label>
          </div>
        )}
        <p className={s.notice}>
          {correctionDate
            ? "Preparing a replacement leaves balances unchanged. Review the correction before posting its reversal and replacement."
            : "Saving this proposal leaves balances unchanged. Review the saved version and explicitly confirm it to post."}
        </p>
        {initial?.date_precision === "instant" && (
          <p className={s.muted}>
            Source time: {initial.occurred_at || "unresolved"}. Its precision is
            preserved while this date stays unchanged. Changing the date creates
            a day-precision proposal.
          </p>
        )}
        {initial?.fee_minor && initial.fee_minor !== "0" && (
          <p className={s.notice}>
            This proposal includes a separate transfer fee of{" "}
            {formatLedgerAmount(initial.fee_minor, initial.currency)}. Editing
            the fields below keeps that fee in the saved proposal.
          </p>
        )}
        <div className={s.fields}>
          <label className={s.field}>
            Movement type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as Operation);
                setSource("");
                setTarget("");
                setAfter(false);
              }}
            >
              {Object.entries(operationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Amount · THB
            <input
              required
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="150.25"
            />
            <small>Positive amount; at most two decimal places.</small>
          </label>
        </div>
        <label className={s.field}>
          Occurrence date · Bangkok
          <input
            type="date"
            required
            readOnly={!!correctionDate}
            value={date}
            onInput={(event) => {
              setDate(event.currentTarget.value);
              setAfter(false);
            }}
            onChange={(event) => {
              setDate(event.target.value);
              setAfter(false);
            }}
          />
          <small>
            {initial?.date_precision === "instant" &&
            initial.occurred_on === date &&
            !correctionDate
              ? "The existing source timestamp is preserved for this date."
              : "The record keeps day precision. A timestamp will not be invented."}
          </small>
        </label>
        <div className={s.fields}>
          {needsSource && (
            <label className={s.field}>
              {type === "card_purchase" ? "Card charged" : "Money leaves"}
              <select
                required
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setAfter(false);
                }}
              >
                <option value="">Choose an opened account</option>
                {sourceOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.subtype}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsTarget && (
            <label className={s.field}>
              {type === "card_repayment" ? "Card repaid" : "Money received by"}
              <select
                required
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setAfter(false);
                }}
              >
                <option value="">Choose an opened account</option>
                {targetOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.subtype}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {sameDay && !correctionDate && (
          <label className={s.check}>
            <input
              type="checkbox"
              checked={after}
              onChange={(event) => setAfter(event.target.checked)}
            />
            <span>
              This movement happened after the selected account’s opening
              snapshot on the same day. Leave unchecked if unsure; resolve the
              cutoff before confirming.
            </span>
          </label>
        )}
        {type === "refund" && (
          <label className={s.field}>
            Original posted expense
            <select
              required
              value={original}
              onChange={(event) => setOriginal(event.target.value)}
            >
              <option value="">Choose the expense being refunded</option>
              {original &&
                !originals.some(
                  (row) =>
                    (row.journal_entry_id || row.journal_id || row.id) ===
                    original,
                ) && (
                  <option value={original}>
                    {original} · existing linked expense
                  </option>
                )}
              {originals.map((row) => (
                <option
                  key={row.id}
                  value={row.journal_entry_id || row.journal_id || row.id}
                >
                  {row.occurred_on} ·{" "}
                  {row.description || row.category || "Expense"} ·{" "}
                  {minorToInput(row.amount_minor)} THB
                </option>
              ))}
            </select>
            <small>
              The server checks the remaining refundable principal. Refunds
              reduce spending on their own occurrence date.
            </small>
          </label>
        )}
        <div className={s.fields}>
          <label className={s.field}>
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={100}
              placeholder="For example, food"
            />
          </label>
          <label className={s.field}>
            Trip · optional
            <select
              value={trip}
              onChange={(event) => setTrip(event.target.value)}
            >
              <option value="">No trip</option>
              {trip && !trips.some((row) => row.id === trip) && (
                <option value={trip}>{trip} · existing trip</option>
              )}
              {trips.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={s.field}>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </label>
        <label className={s.field}>
          Tags · optional
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="work, travel"
            maxLength={500}
          />
          <small>
            Separate tags with commas. Transfers and card repayments do not
            count as income or spending.
          </small>
        </label>
        {(allowDistinct || distinct) && (
          <label className={s.check}>
            <input
              type="checkbox"
              checked={distinct}
              onChange={(event) => setDistinct(event.target.checked)}
            />
            <span>
              If a repeated-payment warning applies, I checked the records and
              this is a separate real movement. Leave unchecked if unsure.
            </span>
          </label>
        )}
        <div className={s.actions}>
          <button
            type="submit"
            className={s.button}
            disabled={needsCurrencyReview && !currencyReviewed}
          >
            {busy
              ? "Saving…"
              : correctionDate
                ? "Review replacement"
                : initial
                  ? "Save edited draft"
                  : "Save draft for review"}
          </button>
          {onCancel && (
            <button
              type="button"
              className={`${s.button} ${s.secondary}`}
              onClick={onCancel}
            >
              Keep saved draft
            </button>
          )}
        </div>
      </fieldset>
      {error != null && <FinanceError error={error} />}
    </form>
  );
}
