"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { tripsAPI } from "@/lib/api";
import {
  financeAPI,
  formatTHB,
  formatLedgerAmount,
  newCommandKey,
  type DraftPayload,
  type FinanceAccount,
  type TransactionDraft,
  type FinancialTransaction,
  type Operation,
} from "@/lib/finance-api";
import type { Trip } from "@/types";
import {
  FinanceError,
  FinanceHeader,
  validationMessages,
} from "@/components/finance/shared";
import { EvidencePreview } from "@/components/finance/evidence-preview";
import { PostedCorrection } from "@/components/finance/posted-correction";
import { DraftForm, operationLabels } from "@/components/finance/draft-form";
import s from "@/components/finance/finance.module.css";

export default function ReviewPage() {
  const owner = useAuthStore((state) => state.user?.id);
  return owner ? (
    <ReviewScreen key={owner} owner={owner} />
  ) : (
    <p role="status">Loading your review queue…</p>
  );
}

function ReviewScreen({ owner }: { owner: string }) {
  const client = useQueryClient();
  const balances = useQuery({
    queryKey: ["finance", owner, "balances"],
    queryFn: financeAPI.balances,
    retry: false,
  });
  const drafts = useQuery({
    queryKey: ["finance", owner, "drafts"],
    queryFn: financeAPI.drafts,
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["finance", owner, "activity"],
    queryFn: financeAPI.transactions,
    retry: false,
  });
  const trips = useQuery({
    queryKey: ["finance", owner, "trips"],
    queryFn: () => tripsAPI.list() as Promise<Trip[]>,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [createdCount, setCreatedCount] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    setTargetDraft(
      new URLSearchParams(window.location.search).get("draft") || "",
    );
  }, []);
  useEffect(() => {
    if (!targetDraft || !drafts.data) return;
    document
      .getElementById(`draft-${targetDraft}`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [targetDraft, drafts.data]);
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["finance", owner] });
  }
  async function create(payload: DraftPayload) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const saved = await financeAPI.createDraft(payload);
      setShowCreate(false);
      setCreatedCount((count) => count + 1);
      setTargetDraft(saved.id);
      setNotice(
        "Draft saved. Balances have not changed. Review it below, then confirm this version to post.",
      );
      await refresh();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  const accounts = balances.data?.accounts || [];
  const pending = (drafts.data || []).filter(
    (draft) => !["posted", "canceled", "cancelled"].includes(draft.status),
  );
  const finished = (drafts.data || []).filter((draft) =>
    ["posted", "canceled", "cancelled"].includes(draft.status),
  );
  return (
    <div className={s.page}>
      <FinanceHeader title="Review before money is recorded">
        Messages and manual entries are proposals. Confirming a saved draft
        posts its exact version; editing or canceling a pending draft leaves
        balances unchanged.
      </FinanceHeader>
      <div className={s.actions}>
        <button
          type="button"
          className={s.button}
          disabled={
            !accounts.some((account) => account.opening) ||
            balances.isError ||
            busy
          }
          onClick={() => setShowCreate((shown) => !shown)}
        >
          {showCreate ? "Close new draft" : "Create a draft"}
        </button>
        <button
          type="button"
          className={`${s.button} ${s.secondary}`}
          disabled={drafts.isFetching || busy}
          onClick={() => void refresh()}
        >
          Refresh queue and balances
        </button>
        <Link className={s.link} href="/accounts">
          Review account openings
        </Link>
      </div>
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      {balances.isPending && <p role="status">Loading accounts…</p>}
      {balances.isError && (
        <FinanceError
          error={balances.error}
          retry={() => void balances.refetch()}
        />
      )}
      {balances.data && !accounts.some((account) => account.opening) && (
        <p className={s.notice}>
          Set up a verified opening in Accounts before recording a new movement.
        </p>
      )}
      {showCreate && (
        <section className={s.panel} aria-labelledby="new-draft-title">
          <h2 id="new-draft-title">New proposal</h2>
          <DraftForm
            key={createdCount}
            accounts={accounts}
            transactions={activity.data || []}
            trips={trips.data || []}
            busy={busy}
            onSave={create}
          />
        </section>
      )}
      <section
        className={`${s.panel} ${s.stack}`}
        aria-labelledby="pending-title"
      >
        <div className={s.row}>
          <h2 id="pending-title">
            Pending review {drafts.data ? `· ${pending.length}` : ""}
          </h2>
          <span className={s.status}>No balance effect until confirmed</span>
        </div>
        {drafts.isPending && <p role="status">Loading pending drafts…</p>}
        {drafts.isError && (
          <FinanceError
            error={drafts.error}
            retry={() => void drafts.refetch()}
          />
        )}
        {drafts.data && !pending.length && (
          <p className={s.muted}>
            No pending drafts. Create a proposal here or send a message through
            your configured LINE connection.
          </p>
        )}
        {targetDraft &&
          drafts.data &&
          !drafts.data.some((draft) => draft.id === targetDraft) && (
            <p role="status" className={s.notice}>
              That draft is not available in your queue. Refresh the queue or
              check that you signed in to the intended account.
            </p>
          )}
        {pending.map((draft) => (
          <DraftCard
            key={`${draft.id}:${draft.version}`}
            draft={draft}
            highlighted={draft.id === targetDraft}
            accounts={accounts}
            transactions={activity.data || []}
            trips={trips.data || []}
            owner={owner}
            onUpdated={refresh}
          />
        ))}
      </section>
      <section
        className={`${s.panel} ${s.stack}`}
        id="posted"
        aria-labelledby="posted-title"
      >
        <h2 id="posted-title">Posted account activity</h2>
        <p className={s.muted}>
          Exact THB financial effects from the account ledger. Transfers and
          card repayments have no income or spending effect; linked refunds
          reduce spending. Opening positions are shown in Accounts.
        </p>
        {activity.isPending && <p role="status">Loading posted activity…</p>}
        {activity.isError && (
          <FinanceError
            error={activity.error}
            retry={() => void activity.refetch()}
          />
        )}
        {activity.data && (
          <PostedActivity
            rows={activity.data}
            accounts={accounts}
            trips={trips.data || []}
            onUpdated={refresh}
          />
        )}
      </section>
      {finished.length > 0 && (
        <section className={`${s.panel} ${s.stack}`}>
          <h2>Recent draft outcomes</h2>
          {finished.map((draft) => (
            <article
              className={s.account}
              key={draft.id}
              id={`draft-${draft.id}`}
            >
              <div className={s.row}>
                <strong>
                  {draft.payload.description || draft.payload.type || "Draft"}
                </strong>
                <span className={s.status}>
                  {draft.status} · version {draft.version}
                </span>
              </div>
              <p className={s.muted}>
                {draft.status === "posted"
                  ? `Posted journal: ${draft.posted_journal_id}`
                  : "Canceled without a financial posting."}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  highlighted,
  accounts,
  transactions,
  trips,
  owner,
  onUpdated,
}: {
  draft: TransactionDraft;
  highlighted: boolean;
  accounts: FinanceAccount[];
  transactions: FinancialTransaction[];
  trips: Trip[];
  owner: string;
  onUpdated: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const payload = draft.payload;
  const errors = validationMessages(draft.validation_errors);
  const accountName = (id?: string | null) =>
    id
      ? accounts.find((account) => account.id === id)?.name ||
        "Account unavailable"
      : "Not assigned";
  const source = accountName(payload.source_account_id);
  const target = accountName(payload.target_account_id);
  async function act(
    action: "confirm" | "cancel" | "edit" | "preview",
    patch?: DraftPayload,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "confirm") {
        key.current ||= newCommandKey();
        await financeAPI.confirmDraft(draft.id, draft.version, key.current);
      } else if (action === "cancel")
        await financeAPI.cancelDraft(draft.id, draft.version);
      else if (action === "edit" && patch)
        await financeAPI.editDraft(draft.id, draft.version, patch);
      else if (action === "preview") {
        await financeAPI.sendLinePreview(draft.id);
        setNotice(
          "Updated review queued for LINE. Delivery is independently retried; balances have not changed.",
        );
      }
      if (action !== "preview") await onUpdated();
    } catch (e) {
      setError(e);
      if (
        typeof e === "object" &&
        e !== null &&
        "status" in e &&
        e.status === 409
      )
        setConflict(true);
      if (action === "edit") throw e;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <article
      className={`${s.draft} ${s.stack}`}
      id={`draft-${draft.id}`}
      style={highlighted ? { borderColor: "var(--accent)" } : undefined}
    >
      <div className={s.row}>
        <div>
          <h3>
            {payload.type
              ? operationLabels[payload.type] || payload.type
              : "Unresolved movement"}
          </h3>
          <p className={s.muted}>{payload.description || "No description"}</p>
        </div>
        <div>
          <strong className={s.amount}>
            {payload.amount_minor
              ? formatLedgerAmount(payload.amount_minor, payload.currency)
              : "Amount missing"}
          </strong>
          <p className={s.status}>
            {draft.status} · version {draft.version}
          </p>
        </div>
      </div>
      {payload.evidence_ids?.map((id) => (
        <EvidencePreview key={id} id={id} />
      ))}
      {editing ? (
        <DraftForm
          allowDistinct={JSON.stringify(draft.validation_errors).includes(
            "POSSIBLE_DUPLICATE",
          )}
          initial={payload}
          accounts={accounts}
          transactions={transactions}
          trips={trips}
          busy={busy || conflict}
          onSave={(patch) => act("edit", patch)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <dl className={s.detail}>
            <div>
              <dt>Occurrence</dt>
              <dd>
                {payload.occurred_on || "Date missing"} ·{" "}
                {payload.date_precision || "unresolved"} precision
              </dd>
            </div>
            {payload.source_account_id && (
              <div>
                <dt>
                  {payload.type === "card_purchase"
                    ? "Card charged"
                    : "Money leaves"}
                </dt>
                <dd>{source}</dd>
              </div>
            )}
            {payload.target_account_id && (
              <div>
                <dt>
                  {payload.type === "card_repayment"
                    ? "Card repaid"
                    : "Money received by"}
                </dt>
                <dd>{target}</dd>
              </div>
            )}
            {payload.occurred_at && (
              <div>
                <dt>Source occurrence time</dt>
                <dd>{payload.occurred_at}</dd>
              </div>
            )}
            {payload.fee_minor && payload.fee_minor !== "0" && (
              <div>
                <dt>Separate transfer fee</dt>
                <dd>
                  {formatLedgerAmount(payload.fee_minor, payload.currency)}
                </dd>
              </div>
            )}
            <div>
              <dt>Category</dt>
              <dd>{payload.category || "Unassigned"}</dd>
            </div>
            <div>
              <dt>Trip</dt>
              <dd>
                {payload.trip_id
                  ? trips.find((trip) => trip.id === payload.trip_id)?.title ||
                    "Assigned trip"
                  : "No trip"}
              </dd>
            </div>
            {payload.tags?.length ? (
              <div>
                <dt>Tags</dt>
                <dd>{payload.tags.join(", ")}</dd>
              </div>
            ) : null}
            {payload.type === "refund" && (
              <div>
                <dt>Original expense</dt>
                <dd>
                  {payload.original_expense_entry_id ||
                    "Missing linked expense"}
                </dd>
              </div>
            )}
            {payload.cutoff_resolution === "after" && (
              <div>
                <dt>Opening-day review</dt>
                <dd>Owner marked this movement after the snapshot</dd>
              </div>
            )}
          </dl>
          {["transfer", "card_repayment"].includes(payload.type || "") && (
            <p className={s.muted}>
              This movement changes the selected accounts without creating
              income or spending.
            </p>
          )}
          {payload.type === "card_purchase" && (
            <p className={s.muted}>
              Posting records spending and increases the selected card’s debt.
            </p>
          )}
          {payload.type === "refund" && (
            <p className={s.muted}>
              Posting returns money to the selected account and reduces spending
              on the refund date.
            </p>
          )}
          {errors.length > 0 && (
            <div className={`${s.notice} ${s.error}`}>
              <strong>Resolve before confirmation</strong>
              <ul className={s.list}>
                {errors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {confirming && (
            <div className={s.notice}>
              <p>
                Confirm version {draft.version} for{" "}
                {payload.amount_minor
                  ? formatLedgerAmount(payload.amount_minor, payload.currency)
                  : "an unresolved amount"}
                ? This posts a financial journal and updates tracked balances.
              </p>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                <span>
                  I checked the amount, date, accounts and category for this
                  saved version.
                </span>
              </label>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.button}
                  disabled={busy || !checked || errors.length > 0 || conflict}
                  onClick={() => void act("confirm")}
                >
                  Confirm and post
                </button>
                <button
                  type="button"
                  className={`${s.button} ${s.secondary}`}
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setChecked(false);
                  }}
                >
                  Keep pending
                </button>
              </div>
            </div>
          )}
          {canceling && (
            <div className={s.notice}>
              <p>
                Cancel version {draft.version}? It will remain in history
                without a financial posting.
              </p>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.button}
                  disabled={busy || conflict}
                  onClick={() => void act("cancel")}
                >
                  Confirm cancellation
                </button>
                <button
                  type="button"
                  className={`${s.button} ${s.secondary}`}
                  disabled={busy}
                  onClick={() => setCanceling(false)}
                >
                  Keep pending
                </button>
              </div>
            </div>
          )}
          {!confirming && !canceling && (
            <div className={s.actions}>
              <button
                type="button"
                className={s.button}
                disabled={busy || errors.length > 0 || conflict}
                onClick={() => setConfirming(true)}
              >
                Review & confirm
              </button>
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={busy || conflict}
                onClick={() => setEditing(true)}
              >
                Edit draft
              </button>
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={busy || conflict}
                onClick={() => setCanceling(true)}
              >
                Cancel draft…
              </button>
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={busy || conflict}
                onClick={() => void act("preview")}
              >
                Send current review to LINE
              </button>
            </div>
          )}
        </>
      )}
      {conflict && (
        <p className={s.notice}>
          This saved version may have changed. Refresh the queue and review the
          latest version before another action.
          <br />
          <button
            type="button"
            className={`${s.button} ${s.secondary}`}
            disabled={busy}
            onClick={() =>
              void onUpdated().then(() => {
                setConflict(false);
                setConfirming(false);
                setChecked(false);
                key.current = null;
              })
            }
          >
            Refresh saved version
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      {error != null && <FinanceError error={error} />}
      <details>
        <summary className={s.muted}>Draft reference</summary>
        <code className={s.code}>
          {draft.id} · owner {owner}
        </code>
      </details>
    </article>
  );
}

function PostedActivity({
  rows,
  accounts,
  trips,
  onUpdated,
}: {
  rows: FinancialTransaction[];
  accounts: FinanceAccount[];
  trips: Trip[];
  onUpdated: () => Promise<void>;
}) {
  if (!rows.length)
    return (
      <p className={s.muted}>
        No financial movements have been posted to these accounts.
      </p>
    );
  return (
    <div className={s.stack}>
      {rows.map((row) => {
        const kind = row.operation_kind || row.type || row.kind || "movement";
        return (
          <article key={row.id} className={`${s.account} ${s.stack}`}>
            <div className={s.row}>
              <div>
                <h3>
                  {kind === "opening"
                    ? "Opening snapshot"
                    : kind === "reversal"
                      ? "Correction reversal"
                      : operationLabels[kind as Operation] || kind}
                </h3>
                <p className={s.muted}>
                  {row.occurred_on} · Bangkok ·{" "}
                  {row.description || row.category || "No description"}
                </p>
              </div>
              <strong className={s.amount}>
                {formatLedgerAmount(row.amount_minor, row.currency)}
              </strong>
            </div>
            <dl className={s.detail}>
              <div>
                <dt>Category</dt>
                <dd>{row.category || "Unassigned"}</dd>
              </div>
              <div>
                <dt>Income effect</dt>
                <dd className={s.amount}>
                  {row.income_effect_minor !== undefined
                    ? formatTHB(row.income_effect_minor)
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Spending effect</dt>
                <dd className={s.amount}>
                  {row.expense_effect_minor !== undefined
                    ? formatTHB(row.expense_effect_minor)
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
            {row.account_effects?.length ? (
              <div className={s.stack}>
                <p className={s.muted}>
                  Signed effects on tracked accounts. For a card, a negative
                  posting increases debt; a positive posting reduces it.
                </p>
                <dl className={s.detail}>
                  {row.account_effects.map((effect) => (
                    <div key={effect.account_id}>
                      <dt>
                        {effect.name ||
                          accounts.find(
                            (account) => account.id === effect.account_id,
                          )?.name ||
                          "Tracked account"}
                      </dt>
                      <dd className={s.amount}>
                        {effect.amount_minor !== undefined
                          ? formatLedgerAmount(
                              effect.amount_minor,
                              row.currency,
                            )
                          : "Unavailable"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {row.source && <p className={s.muted}>Source: {row.source}</p>}
            {row.evidence_ids?.map((id) => (
              <EvidencePreview key={id} id={id} />
            ))}
            {row.reversed && (
              <p className={s.notice}>
                Reversed by a later journal. This original stays visible
                alongside its reversal; the balance calculation includes both.
              </p>
            )}
            {row.reversal_of && (
              <p className={s.muted}>
                Reverses journal{" "}
                <code className={s.code}>{row.reversal_of}</code>
              </p>
            )}
            {row.original_expense_entry_id && (
              <p className={s.muted}>
                Refund linked to original expense{" "}
                <code className={s.code}>{row.original_expense_entry_id}</code>
              </p>
            )}
            <details>
              <summary className={s.muted}>Journal reference</summary>
              <code className={s.code}>
                {row.journal_entry_id || row.journal_id || row.id}
              </code>
            </details>
            {!["opening", "reversal"].includes(kind) && !row.reversed && (
              <PostedCorrection
                key={`${row.id}:${row.category}:${row.trip_id}:${row.tags?.join(",")}`}
                row={row}
                accounts={accounts}
                transactions={rows}
                trips={trips}
                onUpdated={onUpdated}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
