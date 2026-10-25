"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  financeAPI,
  formatTHB,
  parseTHB,
  newCommandKey,
  type FinanceAccount,
} from "@/lib/finance-api";
import { FinanceError, FinanceHeader } from "@/components/finance/shared";
import { Statements } from "@/components/finance/statements";
import { LedgerLineConnection } from "@/components/finance/line-connection";
import s from "@/components/finance/finance.module.css";

type OpeningReview = {
  cutoff_at: string;
  reviewed: true;
  accounts: { account_id: string; signed_balance_minor: string }[];
};

export default function AccountsPage() {
  const owner = useAuthStore((state) => state.user?.id);
  return owner ? (
    <AccountsScreen key={owner} owner={owner} />
  ) : (
    <p role="status">Loading your accounts…</p>
  );
}

function AccountsScreen({ owner }: { owner: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["finance", owner, "balances"],
    queryFn: financeAPI.balances,
    retry: false,
  });
  const [name, setName] = useState("");
  const [subtype, setSubtype] = useState<FinanceAccount["subtype"]>("bank");
  const [cutoff, setCutoff] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [review, setReview] = useState<OpeningReview | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const createKey = useRef<string | null>(null);
  const openingKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const balances = query.data;
  const unopened = (balances?.accounts || []).filter(
    (account) => !account.opening,
  );
  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    createKey.current ||= newCommandKey();
    try {
      await financeAPI.createAccount(
        { name: name.trim(), subtype, currency: "THB" },
        createKey.current,
      );
      setName("");
      createKey.current = null;
      setNotice(
        "Account created. Review its opening balance and cutoff before recording movements.",
      );
      await client.invalidateQueries({ queryKey: ["finance", owner] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  function reviewOpenings(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice("");
    try {
      if (!cutoff || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cutoff))
        throw new Error("Choose a complete opening cutoff in Bangkok time.");
      const accounts = unopened
        .filter((account) => amounts[account.id]?.trim())
        .map((account) => {
          const signed = parseTHB(amounts[account.id], true);
          if (account.subtype === "cash" && BigInt(signed) < BigInt(0))
            throw new Error("A cash wallet opening cannot be negative.");
          return { account_id: account.id, signed_balance_minor: signed };
        });
      if (!accounts.length)
        throw new Error(
          "Enter an opening balance for at least one account. Enter 0 for a verified zero balance.",
        );
      setReview({ cutoff_at: `${cutoff}:00+07:00`, reviewed: true, accounts });
      openingKey.current = newCommandKey();
      setChecked(false);
    } catch (e) {
      setError(e);
    }
  }
  async function saveOpenings() {
    if (!review || !checked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await financeAPI.openAccounts(
        review,
        openingKey.current || newCommandKey(),
      );
      setReview(null);
      setAmounts({});
      setChecked(false);
      openingKey.current = null;
      setNotice(
        "Opening balances recorded. New movements must fall after each account’s verified cutoff.",
      );
      await client.invalidateQueries({ queryKey: ["finance", owner] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <div className={s.page}>
      <FinanceHeader title="Know what each account holds">
        Set a verified starting point, then track confirmed movements. These
        balances cover the accounts recorded here; they do not synchronize with
        your bank.
      </FinanceHeader>
      {query.isPending && <p role="status">Loading tracked balances…</p>}
      {query.isError && (
        <FinanceError error={query.error} retry={() => void query.refetch()} />
      )}
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      {error != null && <FinanceError error={error} />}
      {balances && (
        <>
          <dl className={s.grid}>
            {[
              ["Tracked assets", balances.asset_balance_minor],
              ["Card debt", balances.liability_balance_minor],
              ["Net position", balances.net_position_minor],
            ].map(([label, value]) => (
              <div key={label} className={`${s.panel} ${s.metric}`}>
                <dt>{label}</dt>
                <dd>{formatTHB(value)}</dd>
              </div>
            ))}
          </dl>
          <p className={s.muted}>
            THB · Net position = tracked assets − card debt. Last reconciled:{" "}
            {balances.last_reconciled_at
              ? new Date(balances.last_reconciled_at).toLocaleString("en-GB", {
                  timeZone: "Asia/Bangkok",
                }) + " Bangkok"
              : "Not reconciled"}
            . Opening balances are a starting position, separate from earned
            income.
          </p>
          <section
            className={`${s.panel} ${s.stack}`}
            aria-labelledby="tracked-accounts"
          >
            <div className={s.row}>
              <h2 id="tracked-accounts">Your accounts</h2>
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={query.isFetching || busy}
                onClick={() => void query.refetch()}
              >
                Refresh balances
              </button>
            </div>
            {!balances.accounts.length && (
              <p className={s.muted}>
                Create your first account, then review its opening.
              </p>
            )}
            {balances.accounts.map((account) => (
              <article className={s.account} key={account.id}>
                <div className={s.row}>
                  <div>
                    <h3>{account.name}</h3>
                    <p className={s.muted}>
                      {account.subtype === "card"
                        ? "Credit card · positive balance means debt"
                        : `${account.subtype} · THB`}
                    </p>
                  </div>
                  <strong className={s.amount}>
                    {account.opening
                      ? formatTHB(account.balance_minor)
                      : "Opening needed"}
                  </strong>
                </div>
                <p className={s.muted}>
                  {account.opening
                    ? `Cutoff: ${new Date(account.opening.cutoff_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} Bangkok`
                    : "This account has no verified opening yet."}
                </p>
                <details>
                  <summary className={s.muted}>
                    Account ID for LINE messages
                  </summary>
                  <code className={s.code}>{account.id}</code>
                </details>
              </article>
            ))}
          </section>
          <div className={s.columns}>
            <section className={s.panel} aria-labelledby="new-account-title">
              <h2 id="new-account-title">Add an account</h2>
              <form
                className={s.form}
                onSubmit={(event) => void createAccount(event)}
              >
                <fieldset disabled={busy || review !== null} className={s.form}>
                  <label className={s.field}>
                    Account name
                    <input
                      required
                      maxLength={100}
                      value={name}
                      autoComplete="off"
                      onChange={(event) => {
                        setName(event.target.value);
                        createKey.current = null;
                      }}
                      placeholder="For example, Daily bank"
                    />
                  </label>
                  <label className={s.field}>
                    Account type
                    <select
                      value={subtype}
                      onChange={(event) => {
                        setSubtype(
                          event.target.value as FinanceAccount["subtype"],
                        );
                        createKey.current = null;
                      }}
                    >
                      <option value="bank">Bank account</option>
                      <option value="savings">Savings account</option>
                      <option value="cash">Cash wallet</option>
                      <option value="card">Credit card</option>
                    </select>
                  </label>
                  <p className={s.muted}>
                    Currency: THB. Creating an account does not add an opening
                    or an income entry.
                  </p>
                  <button
                    className={s.button}
                    type="submit"
                    disabled={!name.trim()}
                  >
                    Create account
                  </button>
                </fieldset>
              </form>
            </section>
            <section className={s.panel} aria-labelledby="opening-title">
              <h2 id="opening-title">Review opening balances</h2>
              {!unopened.length ? (
                <p className={s.muted}>
                  {balances.accounts.length
                    ? "All existing accounts have an opening. Add an account to establish another starting position."
                    : "Create an account first, then establish its verified starting position."}
                </p>
              ) : review ? (
                <div className={s.stack}>
                  <p className={s.notice}>
                    Review this starting snapshot carefully. Include posted
                    movements through the cutoff once. Pending holds are
                    separate.
                  </p>
                  <p>
                    Cutoff:{" "}
                    <strong>
                      {cutoff.replace("T", " ")} Bangkok (UTC+07:00)
                    </strong>
                  </p>
                  <dl className={s.detail}>
                    {review.accounts.map((opening) => (
                      <div key={opening.account_id}>
                        <dt>
                          {
                            unopened.find(
                              (account) => account.id === opening.account_id,
                            )?.name
                          }
                        </dt>
                        <dd className={s.amount}>
                          {formatTHB(opening.signed_balance_minor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <label className={s.check}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={(event) => setChecked(event.target.checked)}
                    />
                    <span>
                      I verified these posted balances and the cutoff. Earlier
                      records are already included and must not be replayed
                      against this snapshot.
                    </span>
                  </label>
                  <div className={s.actions}>
                    <button
                      type="button"
                      className={s.button}
                      disabled={busy || !checked}
                      onClick={() => void saveOpenings()}
                    >
                      {busy ? "Recording…" : "Confirm opening balances"}
                    </button>
                    <button
                      type="button"
                      className={`${s.button} ${s.secondary}`}
                      disabled={busy}
                      onClick={() => {
                        setReview(null);
                        setChecked(false);
                      }}
                    >
                      Edit snapshot
                    </button>
                  </div>
                </div>
              ) : (
                <form className={s.form} onSubmit={reviewOpenings}>
                  <fieldset disabled={busy} className={s.form}>
                    <p className={s.muted}>
                      Use one verified cutoff where possible. Leave an account
                      blank to set it up later. Enter 0 for a verified zero
                      balance.
                    </p>
                    <label className={s.field}>
                      Snapshot cutoff · Bangkok (UTC+07:00)
                      <input
                        required
                        type="datetime-local"
                        value={cutoff}
                        onInput={(event) =>
                          setCutoff(event.currentTarget.value)
                        }
                        onChange={(event) => setCutoff(event.target.value)}
                      />
                    </label>
                    {unopened.map((account) => (
                      <label key={account.id} className={s.field}>
                        {account.name} ·{" "}
                        {account.subtype === "card"
                          ? "amount owed (THB)"
                          : "money held (THB)"}
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={amounts[account.id] ?? ""}
                          placeholder="0.00"
                          onChange={(event) =>
                            setAmounts((old) => ({
                              ...old,
                              [account.id]: event.target.value,
                            }))
                          }
                        />
                        <small>
                          {account.subtype === "card"
                            ? "Positive means debt; negative means the card has a credit balance."
                            : account.subtype === "cash"
                              ? "Cash cannot have a negative opening."
                              : "A negative amount represents an overdraft."}
                        </small>
                      </label>
                    ))}
                    <button type="submit" className={s.button}>
                      Review snapshot
                    </button>
                  </fieldset>
                </form>
              )}
            </section>
          </div>
        </>
      )}
      {balances && <Statements accounts={balances.accounts} owner={owner} />}
      <LedgerLineConnection owner={owner} />
    </div>
  );
}
