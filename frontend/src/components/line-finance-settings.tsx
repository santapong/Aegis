"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  APIError,
  lineFinanceAPI,
  type LineFinanceDestination,
} from "@/lib/api";
import { cashAPI } from "@/lib/cashflow";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function LineFinanceSettings() {
  const owner = useAuthStore((state) => state.user?.id);
  return owner ? (
    <LineFinanceConnection key={owner} owner={owner} />
  ) : (
    <p role="status">Loading your connection…</p>
  );
}

function LineFinanceConnection({ owner }: { owner: string }) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState<{
    command: string;
    destination: LineFinanceDestination;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const statusQuery = useQuery({
    queryKey: ["line-finance", owner, "status"],
    queryFn: lineFinanceAPI.status,
  });
  const status = statusQuery.data;
  const workspaces = useQuery({
    queryKey: ["cash", owner, "workspaces"],
    queryFn: cashAPI.workspaces,
    enabled: !!status?.cash_enabled,
  });
  const stateQuery = useQuery({
    queryKey: ["cash", owner, "line-destination", workspaceId],
    queryFn: () => cashAPI.state(workspaceId),
    enabled: !!workspaceId && !!status?.cash_enabled,
  });
  const workspace = workspaces.data?.find((w) => w.id === workspaceId);
  const accounts =
    stateQuery.data?.accounts.filter(
      (a) => !a.archived && a.currency === "THB",
    ) || [];
  const account = accounts.find((a) => a.id === accountId);
  const selected =
    workspace?.currency === "THB" &&
    !!account &&
    !stateQuery.isFetching &&
    !stateQuery.isError;
  useEffect(() => {
    if (status?.linked) setCode(null);
  }, [status?.linked]);
  const act = async (action: "connect" | "disconnect" | "refresh") => {
    setBusy(true);
    setError("");
    try {
      if (action === "connect") {
        if (!selected || !checked)
          throw new Error(
            "Choose and confirm a THB workspace and cash account first.",
          );
        setCode(
          await lineFinanceAPI.linkCode({
            workspace_id: workspaceId,
            account_id: accountId,
            confirmed_currency: "THB",
          }),
        );
      }
      if (action === "disconnect") {
        await lineFinanceAPI.disconnect();
        setCode(null);
        setChecked(false);
      }
      const result = await statusQuery.refetch();
      if (result.error) throw result.error;
      if (action === "refresh" && status?.cash_enabled) {
        await workspaces.refetch();
        if (workspaceId) await stateQuery.refetch();
      }
    } catch (caught) {
      setError(
        caught instanceof APIError
          ? String(caught.detail || caught.message)
          : caught instanceof Error
            ? caught.message
            : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-5 min-w-0">
        <h3 className="card-title">LINE finance</h3>
        <p className="text-sm" style={{ color: "var(--dim)" }}>
          Send a short money entry to your separate finance bot. Review its
          destination, amount and date in chat, then confirm before Aegis
          records it. This does not send money.
        </p>
        {statusQuery.isLoading && <p role="status">Loading connection…</p>}
        {statusQuery.isError && (
          <p role="alert">
            Could not load the connection. Check it again below.
          </p>
        )}
        {status && (
          <>
            <p>
              {status.linked
                ? "Connected · " +
                  status.pending +
                  " entries awaiting confirmation"
                : "Not connected"}
            </p>
            {status.destination && (
              <div className="rounded-lg border p-4 space-y-2">
                <p>
                  <strong>{status.destination.workspace_name}</strong> →{" "}
                  {status.destination.account_name} · THB
                </p>
                <p className="text-sm" style={{ color: "var(--dim)" }}>
                  New confirmed entries use this cash account. Disconnect and
                  create a new link to change the destination.
                </p>
              </div>
            )}
            {status.needs_destination_review && (
              <p role="status">
                Your older connection has no reviewed cash destination.
                Disconnect, choose a THB workspace and account, then reconnect.
                Existing entries remain in Aegis.
              </p>
            )}
            {!status.cash_enabled && (
              <p>Workspace capture is awaiting rollout on this server.</p>
            )}
            {!status.configured && (
              <p>The separate finance bot is awaiting server setup.</p>
            )}
            {status.configured && !status.delivery_configured && (
              <p>The finance bot’s reply delivery is awaiting server setup.</p>
            )}
            {!status.linked && status.cash_enabled && (
              <fieldset disabled={busy} className="space-y-4 min-w-0">
                <legend className="text-sm font-medium mb-3">
                  Choose where confirmed money is recorded
                </legend>
                {workspaces.isLoading && (
                  <p role="status">Loading owned workspaces…</p>
                )}
                {workspaces.isError && (
                  <p role="alert">
                    Could not load cash workspaces. Check the connection again.
                  </p>
                )}
                <Select
                  label="LINE cash workspace"
                  placeholder="Choose a THB workspace"
                  value={workspaceId}
                  options={(workspaces.data || [])
                    .filter((w) => w.currency === "THB")
                    .map((w) => ({
                      value: w.id,
                      label: w.name + " · " + w.kind + " · THB",
                    }))}
                  onChange={(event) => {
                    setWorkspaceId(event.target.value);
                    setAccountId("");
                    setChecked(false);
                    setCode(null);
                  }}
                />
                {workspaceId && (
                  <>
                    {stateQuery.isLoading && (
                      <p role="status">Loading cash accounts…</p>
                    )}
                    {stateQuery.isError && (
                      <p role="alert">
                        Could not load this workspace. Check the connection
                        again.
                      </p>
                    )}
                    <Select
                      label="LINE cash account"
                      placeholder="Choose a cash account"
                      value={accountId}
                      disabled={stateQuery.isFetching || stateQuery.isError}
                      options={accounts.map((a) => ({
                        value: a.id,
                        label: a.name + " · THB",
                      }))}
                      onChange={(event) => {
                        setAccountId(event.target.value);
                        setChecked(false);
                        setCode(null);
                      }}
                    />
                  </>
                )}
                {!workspaces.isLoading &&
                  !workspaces.isError &&
                  !(workspaces.data || []).some(
                    (w) => w.currency === "THB",
                  ) && (
                    <p>
                      Create a reviewed THB workspace in{" "}
                      <Link href="/cashflow">Cash planning</Link> first.
                      Changing a currency label does not convert existing money.
                    </p>
                  )}
                {workspaceId &&
                  !stateQuery.isLoading &&
                  !stateQuery.isError &&
                  !accounts.length && (
                    <p>
                      Add an active THB cash account in{" "}
                      <Link href="/cashflow">Cash planning</Link> first.
                    </p>
                  )}
                {selected && (
                  <label className="flex gap-3 items-start text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setChecked(event.target.checked)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span>
                      I checked that confirmed entries belong in{" "}
                      {workspace?.name} → {account?.name}, in THB.
                    </span>
                  </label>
                )}
                <Button
                  className="max-w-full h-auto min-h-9 whitespace-normal"
                  disabled={
                    !status.configured ||
                    !status.delivery_configured ||
                    !selected ||
                    !checked ||
                    busy
                  }
                  onClick={() => act("connect")}
                >
                  Generate destination link code
                </Button>
              </fieldset>
            )}
            {code && !status.linked && (
              <div className="space-y-3 rounded-lg border p-4 min-w-0">
                <p>
                  {code.destination.workspace_name} →{" "}
                  {code.destination.account_name} · THB
                </p>
                <p className="text-sm">
                  Copy this one-use command into a private chat with the
                  separate finance bot within 10 minutes. Then check the
                  connection here.
                </p>
                <Input
                  label="Private connection command"
                  value={code.command}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
              </div>
            )}
            {status.linked && (
              <p className="text-sm">
                Reply delivery: {status.delivery?.pending || 0} waiting ·{" "}
                {status.delivery?.["needs-review"] || 0} need review ·{" "}
                {status.delivery?.delivered || 0} accepted by LINE. Acceptance
                does not prove receipt on a phone.
              </p>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || statusQuery.isFetching}
            onClick={() => act("refresh")}
          >
            Check connection
          </Button>
          {status?.linked && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act("disconnect")}
            >
              Disconnect LINE
            </Button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <p className="text-sm" style={{ color: "var(--dim)" }}>
          Try “expense 65 coffee” or “รับ 35000 เงินเดือน”. Each draft names its
          workspace and account. If the workspace changes, send a fresh draft.
          Use “month” for recorded activity in this account; match payments in{" "}
          <Link href="/cashflow">Cash planning</Link>. Undo preserves cash
          history; unmatch a payment before reversing it. Receipt images and
          transfers are not enabled.
        </p>
      </CardContent>
    </Card>
  );
}
