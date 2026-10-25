"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { APIError } from "@/lib/api";
import type { CashState, Forecast } from "@/lib/cashflow";
import styles from "./workspace.module.css";

export type CashDraft = Record<string, string>;
export interface EverydayProps {
  owner: string;
  wid: string;
  state: CashState;
  asOf: string;
  end: string;
  accounts: string[];
  forecast?: Forecast;
  active: boolean;
  drafts: Record<string, CashDraft>;
  saveDraft: (kind: string, update: (old: CashDraft) => CashDraft) => void;
  mutate: <T extends { revision: number }>(
    path: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>;
}
export function useCashTask() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof APIError && typeof e.detail === "string"
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Please retry after reviewing the inputs.",
      );
    } finally {
      setPending(false);
    }
  }
  return { pending, error, notice, setError, setNotice, run };
}
export function TaskFeedback({
  task,
}: {
  task: ReturnType<typeof useCashTask>;
}) {
  return (
    <>
      {task.error && (
        <p className={styles.warning} role="alert">
          {task.error}
        </p>
      )}
      {task.notice && (
        <p className={styles.notice} role="status">
          {task.notice}
        </p>
      )}
    </>
  );
}
export function cashFormat(value: string | undefined, currency: string) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
}
export function dateInputChange(patch: (value: string) => void) {
  return {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      patch(e.currentTarget.value),
    onInput: (e: React.FormEvent<HTMLInputElement>) =>
      patch(e.currentTarget.value),
  };
}
export function CashTaskDialog({
  open,
  close,
  title,
  pending,
  onSubmit,
  submitLabel = "Save",
  children,
}: {
  open: boolean;
  close: () => void;
  title: string;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  submitLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && ref.current && !ref.current.open) {
      ref.current.showModal();
      ref.current
        .querySelector<HTMLElement>("input,select,textarea,button[type=submit]")
        ?.focus();
    } else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else close();
      }}
      onClose={() => {
        if (!ref.current?.open) close();
      }}
    >
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        <button
          type="button"
          aria-label="Close form"
          disabled={pending}
          onClick={close}
        >
          ✕
        </button>
      </div>
      <form onSubmit={onSubmit}>
        {children}
        <div className={styles.dialogActions}>
          <button type="button" disabled={pending} onClick={close}>
            Cancel
          </button>
          <button className={styles.primary} disabled={pending} type="submit">
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
