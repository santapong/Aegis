"use client";

import Link from "next/link";
import { FinanceAPIError, financeErrorMessage } from "@/lib/finance-api";
import s from "./finance.module.css";

export function FinanceHeader({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className={s.header}>
      <div>
        <p className={s.eyebrow}>AEGIS · Tracked money · THB</p>
        <h1 className={s.title}>{title}</h1>
        <p className={s.intro}>{children}</p>
      </div>
      <nav className={s.nav} aria-label="Tracked money">
        <Link href="/accounts">Accounts</Link>
        <Link href="/review">Review drafts</Link>
        <Link href="/review#posted">Posted activity</Link>
      </nav>
    </header>
  );
}

export function FinanceError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const disabled = error instanceof FinanceAPIError && error.status === 503;
  const fields =
    error instanceof FinanceAPIError
      ? validationMessages(error.detail.field_errors)
      : [];
  return (
    <div className={`${s.notice} ${s.error}`} role="alert">
      <p>
        <strong>
          {disabled
            ? "Account tracking awaits server setup"
            : "This request needs attention"}
        </strong>
      </p>
      <p>{financeErrorMessage(error)}</p>
      {fields.length > 0 && (
        <ul className={s.list}>
          {fields.map((field, index) => (
            <li key={index}>{field}</li>
          ))}
        </ul>
      )}
      {error instanceof FinanceAPIError && error.detail.correlation_id && (
        <p className={s.code}>
          Support reference: {error.detail.correlation_id}
        </p>
      )}
      {retry && (
        <button
          type="button"
          className={`${s.button} ${s.secondary}`}
          onClick={retry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function validationMessages(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(validationMessages);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string") return [record.message];
    if (typeof record.msg === "string")
      return [
        Array.isArray(record.loc)
          ? `${record.loc.filter((part) => part !== "body").join(".")}: ${record.msg}`
          : record.msg,
      ];
    return Object.entries(record).flatMap(([field, detail]) =>
      validationMessages(detail).map(
        (message) => `${field.replaceAll("_", " ")}: ${message}`,
      ),
    );
  }
  return [];
}
