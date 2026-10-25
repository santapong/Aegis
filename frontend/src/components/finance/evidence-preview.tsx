"use client";

import { useEffect, useRef, useState } from "react";
import { financeAPI } from "@/lib/finance-api";
import { FinanceError } from "./shared";
import s from "./finance.module.css";

export function EvidencePreview({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);
  const objectUrl = useRef("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);
  async function preview() {
    if (busy) return;
    if (url) {
      URL.revokeObjectURL(url);
      objectUrl.current = "";
      setUrl("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await financeAPI.evidence(id);
      if (!mounted.current) return;
      if (
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          blob.type,
        )
      )
        throw new Error(
          "This evidence cannot be previewed as a supported receipt image.",
        );
      objectUrl.current = URL.createObjectURL(blob);
      setUrl(objectUrl.current);
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={s.stack}>
      <button
        type="button"
        className={`${s.button} ${s.secondary}`}
        disabled={busy}
        onClick={() => void preview()}
      >
        {busy
          ? "Loading private evidence…"
          : url
            ? "Close receipt preview"
            : "Preview private receipt"}
      </button>
      {url && (
        <img
          src={url}
          alt="Private receipt attached to this transaction proposal. Check it against the fields before confirming."
          style={{
            maxWidth: "100%",
            maxHeight: 520,
            objectFit: "contain",
            borderRadius: 8,
          }}
        />
      )}
      {error != null && <FinanceError error={error} />}
    </div>
  );
}
