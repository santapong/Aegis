const RETURN_PATHS = new Set([
  "/",
  "/accounts",
  "/review",
  "/transactions",
  "/settings",
  "/cashflow",
  "/trips",
  "/budgets",
  "/reports",
  "/plans",
  "/calendar",
  "/savings",
  "/debts",
  "/investments",
]);

/** Keep authenticated deep links local and limited to known application routes. */
export function safeAuthReturn(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://aegis.invalid");
    if (
      url.origin !== "https://aegis.invalid" ||
      !RETURN_PATHS.has(url.pathname)
    )
      return "/";
    const query = new URLSearchParams();
    const draft = url.searchParams.get("draft");
    if (
      url.pathname === "/review" &&
      draft &&
      /^[a-zA-Z0-9-]{1,100}$/.test(draft)
    )
      query.set("draft", draft);
    return url.pathname + (query.size ? `?${query}` : "");
  } catch {
    return "/";
  }
}
