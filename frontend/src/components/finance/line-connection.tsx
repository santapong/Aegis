"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { financeAPI } from "@/lib/finance-api";
import { FinanceError } from "./shared";
import s from "./finance.module.css";

export function LedgerLineConnection({ owner }: { owner: string }) {
  // A new owner gets fresh setup state, including in-flight request completions.
  return <LineConnection key={owner} owner={owner} />;
}

function LineConnection({ owner }: { owner: string }) {
  const client = useQueryClient();
  const [command, setCommand] = useState<
    (Awaited<ReturnType<typeof financeAPI.createLineChallenge>> & { deadline: number }) | null
  >(null);
  const [now, setNow] = useState(() => Date.now());
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ["finance", owner, "line"],
    queryFn: financeAPI.lineStatus,
    retry: false,
    refetchInterval: command ? 5000 : false,
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [disconnectReview, setDisconnectReview] = useState(false);
  useEffect(() => {
    if (!command) return;
    const tick = () => {
      const value = Date.now();
      setNow(value);
      if (value >= command.deadline) {
        setCommand(null);
        setExpired(true);
        setCopied(false);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [command]);
  useEffect(() => {
    if (query.data?.linked) {
      setCommand(null);
      setExpired(false);
      setCopied(false);
    }
  }, [query.data?.linked]);
  async function connect(disconnect = false) {
    setBusy(true);
    setError(null);
    try {
      if (disconnect) {
        await financeAPI.disconnectLine();
        setCommand(null);
        setDisconnectReview(false);
      } else {
        const result = await financeAPI.createLineChallenge();
        const received = Date.now();
        setNow(received);
        setCommand({ ...result, deadline: received + result.expires_in_seconds * 1000 });
      }
      setExpired(false);
      setCopied(false);
      await client.invalidateQueries({ queryKey: ["finance", owner, "line"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!command || Date.now() >= command.deadline) return;
    try {
      await navigator.clipboard.writeText(command.command);
      setCopied(true);
    } catch {
      setError(new Error("Copy is unavailable. Select the private command and copy it manually."));
    }
  }
  const status = query.data;
  const remaining = command ? Math.max(0, Math.ceil((command.deadline - now) / 1000)) : 0;
  const timeLeft = `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m ${remaining % 60}s`;
  return (
    <section
      className={`${s.panel} ${s.stack}`}
      aria-labelledby="ledger-line-title"
    >
      <div>
        <h2 id="ledger-line-title">LINE account tracking</h2>
        <p className={s.muted}>
          Connect once to check budgets, track balances and review entries in LINE.
          Your connection stays active until you disconnect it.
        </p>
      </div>
      {query.isPending && <p role="status">Checking LINE setup…</p>}
      {query.isError && (
        <FinanceError error={query.error} retry={() => void query.refetch()} />
      )}
      {status && (
        <>
          <p>
            {status.linked
              ? "LINE is connected. You do not need a new QR code each day."
              : "No LINE identity is linked to these accounts."}
          </p>
          <p className={s.muted}>
            New setup codes last {status.setup_lifetime_seconds / 3600} hours.
            Your web login lasts {status.web_session_lifetime_seconds / 3600} hours;
            signing in again does not disconnect LINE.
          </p>
          {(!status.enabled || !status.configured) && (
            <p className={s.notice}>
              The account-tracking bot is awaiting operator configuration and
              activation. You can prepare accounts and review drafts in Aegis.
            </p>
          )}
          {!status.delivery_enabled && (
            <p className={s.muted}>
              LINE delivery is disabled. A saved link or draft does not prove a
              message reached your phone.
            </p>
          )}
          <p className={s.muted}>
            Pending jobs: {status.pending_jobs}. Tracked balance replies come
            from Aegis; messages create proposals that require your
            confirmation.
          </p>
          <div className={s.actions}>
            <button
              type="button"
              className={`${s.button} ${s.secondary}`}
              disabled={busy || query.isFetching}
              onClick={() => void query.refetch()}
            >
              Check connection
            </button>
            {!status.linked && (
              <button
                type="button"
                className={s.button}
                disabled={busy || !status.enabled || !status.configured}
                onClick={() => void connect()}
              >
                {command || expired ? "Create a new setup code" : "Connect LINE / show QR"}
              </button>
            )}
            {status.linked && (
              <button
                type="button"
                className={`${s.button} ${s.secondary}`}
                disabled={busy}
                onClick={() => setDisconnectReview(true)}
              >
                Disconnect LINE…
              </button>
            )}
          </div>
          {status.linked && (
            <p className={s.muted}>
              Send <strong>budgets</strong>, <strong>balances</strong>,{" "}
              <strong>pending</strong> or <strong>help</strong> in LINE.
              If replies stop, check service availability before reconnecting.
            </p>
          )}
          {disconnectReview && (
            <div className={s.notice}>
              <p>
                Disconnect this LINE identity? Existing financial history
                remains in Aegis.
              </p>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.button}
                  disabled={busy}
                  onClick={() => void connect(true)}
                >
                  Confirm disconnect
                </button>
                <button
                  type="button"
                  className={`${s.button} ${s.secondary}`}
                  disabled={busy}
                  onClick={() => setDisconnectReview(false)}
                >
                  Keep connection
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {expired && !status?.linked && (
        <p className={s.notice} role="status">
          This setup code has expired. Create a new setup code above; the old QR
          and command will no longer connect your account.
        </p>
      )}
      {command && remaining > 0 && !status?.linked && (
        <div className={s.notice}>
          <p>
            {command.bot_basic_id
              ? `Scan the QR or open LINE, check that the bot is ${command.bot_basic_id}, then press Send.`
              : "Copy the command and send it in a private chat with your configured Aegis bot."}{" "}
            This setup code can be used once. Creating a new code replaces this one.
          </p>
          {command.qr_image_data_url && (
            // The API generates this QR locally; its private contents never go to an image service.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={command.qr_image_data_url}
              alt="Private QR code to open your Aegis bot in LINE with the setup command"
              width={256}
              height={256}
              className={s.lineQr}
              referrerPolicy="no-referrer"
            />
          )}
          <p>Setup time remaining: <strong>{timeLeft}</strong></p>
          <div className={s.actions}>
            {command.line_url && (
              <a href={command.line_url} target="_blank" rel="noopener noreferrer"
                referrerPolicy="no-referrer" className={s.button}>
                Open LINE
              </a>
            )}
            <button type="button" className={`${s.button} ${s.secondary}`} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy setup command"}
            </button>
          </div>
          {!command.line_url && (
            <p className={s.muted}>
              QR and Open LINE need this bot&apos;s public @ID configured. You can
              still connect using the private command below.
            </p>
          )}
          <label className={s.field}>
            Private link command
            <input
              readOnly
              value={command.command}
              onFocus={(e) => e.target.select()}
              autoComplete="off"
            />
          </label>
        </div>
      )}
      {error != null && <FinanceError error={error} />}
    </section>
  );
}
