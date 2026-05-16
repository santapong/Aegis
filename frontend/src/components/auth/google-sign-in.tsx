"use client";

import { useEffect, useRef, useState } from "react";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_black" | "filled_blue";
              size?: "small" | "medium" | "large";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number | string;
            }
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void | Promise<void>;
  /** Match the surrounding context. */
  label?: "signin_with" | "signup_with" | "continue_with";
  /** Width in px. The GIS button maxes out around 400. */
  width?: number;
}

/**
 * GoogleSignInButton — renders Google's official sign-in widget (Google
 * Identity Services). The button posts a one-time JWT credential back to
 * the parent via `onCredential`. The parent then sends it to
 * `POST /api/auth/google` for verification.
 *
 * Requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to be set at build time. When
 * unset, the component renders nothing (graceful degradation — the
 * email/password form is still usable).
 */
export function GoogleSignInButton({
  onCredential,
  label = "continue_with",
  width = 360,
}: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inject the GIS script once, regardless of how many buttons we mount.
  useEffect(() => {
    if (!clientId) return;
    if (typeof window === "undefined") return;
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError("Failed to load Google sign-in.");
    document.head.appendChild(script);
  }, [clientId]);

  // Initialize + render the button once the script is in.
  useEffect(() => {
    if (!clientId || !scriptLoaded || !buttonRef.current) return;
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          void onCredential(response.credential);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: label,
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
  }, [clientId, scriptLoaded, label, width, onCredential]);

  if (!clientId) return null;

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div ref={buttonRef} style={{ minHeight: 44, width: "100%" }} />
      {error && (
        <p
          className="font-mono text-[11px]"
          style={{ color: "var(--bad)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
