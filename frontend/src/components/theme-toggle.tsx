"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
/** Shared appearance control. Switching themes never remounts a form or guide. */
export function ThemeToggle() {
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dark = ready && theme === "horizon-dark";
  return <button type="button" className="aegis-theme-toggle" disabled={!ready} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} onClick={() => setTheme(dark ? "horizon" : "horizon-dark")} title={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}<span className="sr-only">{dark ? "Light mode" : "Dark mode"}</span></button>;
}
