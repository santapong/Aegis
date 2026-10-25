"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { financeAPI } from "@/lib/finance-api";
import { useAuthStore } from "@/stores/auth-store";
import { FinanceError } from "./shared";
import s from "./finance.module.css";

export function BudgetCurrencyReview({ budgets }: {
  budgets: { id: string; name: string }[];
}) {
  const owner = useAuthStore((state) => state.user?.id);
  return <CurrencyReview key={owner} owner={owner} budgets={budgets} />;
}

function CurrencyReview({ owner, budgets }: {
  owner?: string;
  budgets: { id: string; name: string }[];
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const status = useQuery({
    queryKey: ["finance", owner, "status"], queryFn: financeAPI.status,
    enabled: !!owner, retry: false,
  });
  const enabled = !!status.data?.enabled && !!status.data?.cutover_active;
  const reports = useQuery({
    queryKey: ["finance", owner, "budgets"], queryFn: financeAPI.budgets,
    enabled, retry: false,
  });
  if (!enabled) return null;
  const active = new Map(budgets.map((budget) => [budget.id, budget.name]));
  const pending = reports.data?.filter((row) => active.has(row.id) && !row.budget_currency_confirmed) || [];
  async function confirm(id: string, factsHash: string) {
    setBusy(true);
    setError(null);
    try {
      await financeAPI.confirmBudgetCurrency(id, factsHash);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["finance", owner, "budgets"] }),
        cache.invalidateQueries({ queryKey: ["budget-comparison"] }),
      ]);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  if (!reports.isPending && !reports.isError && !pending.length) {
    return <p className={s.muted}>In LINE, send <strong>budgets</strong> or tap My budgets to check your spending and remaining limits.</p>;
  }
  return (
    <section className={`${s.panel} ${s.stack}`} aria-labelledby="budget-currency-title">
      <h2 id="budget-currency-title">Review budget currency</h2>
      <p className={s.muted}>
        Confirm each limit is in Thai baht before comparing it with tracked THB
        spending. This records the limit&apos;s currency; it does not move money.
      </p>
      {reports.isPending && <p role="status">Checking budget currencies…</p>}
      {reports.isError && <FinanceError error={reports.error} retry={() => void reports.refetch()} />}
      {pending.map((row) => (
        <div className={s.notice} key={row.id}>
          <p><strong>{active.get(row.id)}</strong> · {row.category}</p>
          <p>{row.period_start} to {row.period_end}</p>
          <p>Entered limit: <strong>{row.unverified_legacy_budget_amount}</strong></p>
          <button type="button" disabled={busy}
            className={s.button} onClick={() => void confirm(row.id, row.facts_hash)}>
            Confirm this limit is THB
          </button>
        </div>
      ))}
      {error != null && <FinanceError error={error} retry={() => {
        setError(null);
        void reports.refetch();
      }} />}
    </section>
  );
}
