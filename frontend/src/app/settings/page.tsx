"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, COSMIC_THEMES, type CosmicTheme } from "@/stores/app-store";
import {
  aiAPI,
  preferencesAPI,
  secretsAPI,
  type AIModelsPayload,
  type AIUsagePayload,
  type SecretStatus,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { PageHead } from "@/components/shell/page-head";
import { CodeChip } from "@/components/shell/code-chip";
import { Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Must match SECRET_AI_PROVIDER_KEY in backend/app/models/user_secret.py. */
const AI_PROVIDER_KEY = "ai_provider_key";

/** Injected from package.json by next.config.ts. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Per-call AI costs are fractions of a cent, so the usual 2-decimal currency
 * format would render every row as "$0.00" and make the panel useless. Show
 * enough precision to distinguish a cheap model from an expensive one.
 */
function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

interface ThemeMeta {
  name: CosmicTheme;
  label: string;
  tagline: string;
  swatch: { void: string; pane: string; accent: string };
  display: { fontFamily: string; fontStyle: string };
}

const THEME_META: ThemeMeta[] = [
  {
    name: "observatory",
    label: "Observatory",
    tagline: "Restrained. Most professional. Hairline cyan on near-black.",
    swatch: { void: "#050810", pane: "#0e1422", accent: "#5ad8ff" },
    display: { fontFamily: "var(--font-sans)", fontStyle: "normal" },
  },
  {
    name: "constellation",
    label: "Constellation",
    tagline: "Editorial. Gold on midnight. Roman serif, star-chart lines.",
    swatch: { void: "#08091c", pane: "#12162e", accent: "#d4a85a" },
    display: { fontFamily: "var(--font-serif)", fontStyle: "normal" },
  },
  {
    name: "supernova",
    label: "Supernova",
    tagline: "Kinetic. Warm amber on void. Black hole atmosphere.",
    swatch: { void: "#07050a", pane: "#1a1426", accent: "#e8a85c" },
    display: { fontFamily: "var(--font-serif)", fontStyle: "italic" },
  },
];

export default function SettingsPage() {
  // Per-field selectors — settings page legitimately needs most of the
  // store, but per-field selectors at least skip re-renders triggered
  // by fields this page doesn't read (e.g. sidebarOpen, aiPanelOpen).
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);
  const restartTour = useAppStore((s) => s.restartTour);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("appearance");
  const [showReset, setShowReset] = useState(false);
  const [aiModels, setAiModels] = useState<AIModelsPayload | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsagePayload | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [apiKeySecret, setApiKeySecret] = useState<SecretStatus | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [keySaving, setKeySaving] = useState(false);

  // The catalog is fetched rather than hard-coded so a retired model drops
  // out of the picker instead of 404-ing at request time. The endpoint never
  // throws for an unreachable provider — it returns `stale: true` — so a
  // rejection here means the request itself failed (offline, auth), and the
  // card stays in its loading state rather than showing a wrong list.
  useEffect(() => {
    let cancelled = false;
    aiAPI
      .models()
      .then((data) => {
        if (!cancelled) setAiModels(data);
      })
      .catch(() => {
        /* leave null — the card renders its loading copy */
      });
    aiAPI
      .usage()
      .then((data) => {
        if (!cancelled) setAiUsage(data);
      })
      .catch(() => {
        /* leave null — the card renders its loading copy */
      });
    secretsAPI
      .list()
      .then((rows) => {
        if (!cancelled) {
          setApiKeySecret(
            rows.find((r) => r.key_name === AI_PROVIDER_KEY) ?? null
          );
        }
      })
      .catch(() => {
        /* leave null — the card renders its loading copy */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModelChange = async (value: string) => {
    const next = value === "" ? null : value;
    setModelSaving(true);
    try {
      // Deliberately NOT `updateSettings` here. That helper fires its PUT
      // with `.catch(() => {})` and returns void, so a failed save is
      // indistinguishable from a successful one — the user would see the
      // model change locally and silently revert on the next page load.
      // Writing directly is the only way to observe the result.
      await preferencesAPI.update({ ai_model: next ?? "" });
      // Mirror into the store without triggering a second PUT.
      useAppStore.setState((s) => ({
        settings: { ...s.settings, aiModel: next },
      }));
      setAiModels(await aiAPI.models());
      toast.success(
        next ? `AI model set to ${next}` : "AI model reset to server default"
      );
    } catch {
      // Nothing to roll back — the store is only written after the save
      // succeeds, so the <select> still shows the previous value.
      toast.error("Could not save the model choice");
    } finally {
      setModelSaving(false);
    }
  };

  const handleSaveKey = async () => {
    const value = apiKeyDraft.trim();
    if (!value) return;
    setKeySaving(true);
    try {
      setApiKeySecret(await secretsAPI.set(AI_PROVIDER_KEY, value));
      // Clear the draft immediately on success: the plaintext key has no
      // reason to stay in React state once it is stored.
      setApiKeyDraft("");
      // The stored key may unlock a provider the env value could not reach,
      // so the catalog can differ now.
      setAiModels(await aiAPI.models());
      toast.success("Provider key saved");
    } catch {
      toast.error("Could not save the provider key");
    } finally {
      setKeySaving(false);
    }
  };

  const handleClearKey = async () => {
    setKeySaving(true);
    try {
      setApiKeySecret(await secretsAPI.clear(AI_PROVIDER_KEY));
      setApiKeyDraft("");
      toast.success("Provider key cleared — falling back to the server .env");
    } catch {
      toast.error("Could not clear the provider key");
    } finally {
      setKeySaving(false);
    }
  };

  const handleReset = () => {
    resetSettings();
    setTheme("observatory");
    setShowReset(false);
    toast.success("Settings reset to defaults");
  };

  const handleRestartTour = () => {
    restartTour();
    toast.success("Onboarding tour will replay on your next visit");
  };

  const handleThemePick = (t: CosmicTheme) => {
    setTheme(t);
    toast.success(`Theme set to ${t}`);
  };

  return (
    <motion.div
      className="max-w-3xl mx-auto space-y-6 px-6 py-7"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHead
          eyebrow={<>SET · system / preferences</>}
          title="Settings"
          crumb={<>Customize your Aegis experience.</>}
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab value="appearance">Appearance</Tab>
            <Tab value="preferences">Preferences</Tab>
            <Tab value="about">About</Tab>
          </TabList>

          <TabPanel value="appearance">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="aegis-card-head">
                    <CodeChip>APP</CodeChip>
                    <h3 className="card-title">Theme</h3>
                    <span className="card-action">
                      currently · <b style={{ color: "var(--fg)" }}>{theme}</b>
                    </span>
                  </div>
                  <p
                    className="text-xs mb-4 font-mono"
                    style={{ color: "var(--dim)" }}
                  >
                    Pick a cosmic theme. Switches instantly, persists across sessions.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {THEME_META.map((meta) => {
                      const active = theme === meta.name;
                      return (
                        <button
                          key={meta.name}
                          onClick={() => handleThemePick(meta.name)}
                          aria-pressed={active}
                          aria-label={`Apply ${meta.label} theme`}
                          className={cn(
                            "flex flex-col items-stretch gap-3 p-4 rounded transition-all text-left",
                            active
                              ? "border"
                              : "border hover:border-[color:var(--pane-edge-2)]"
                          )}
                          style={{
                            borderColor: active ? "var(--accent)" : "var(--pane-edge)",
                            background: active ? "var(--accent-soft)" : "var(--pane)",
                          }}
                        >
                          <div
                            className="flex gap-1 rounded overflow-hidden"
                            style={{
                              height: 60,
                              border: "1px solid var(--pane-edge)",
                            }}
                          >
                            <div
                              style={{ flex: "1 1 0", background: meta.swatch.void }}
                            />
                            <div
                              style={{ flex: "1 1 0", background: meta.swatch.pane }}
                            />
                            <div
                              style={{ flex: "1 1 0", background: meta.swatch.accent }}
                            />
                          </div>
                          <div>
                            <div
                              className="text-[18px] mb-1"
                              style={{
                                fontFamily: meta.display.fontFamily,
                                fontStyle: meta.display.fontStyle,
                                color: active ? "var(--accent)" : "var(--fg)",
                              }}
                            >
                              {meta.label}
                            </div>
                            <div
                              className="text-[11px] font-mono leading-snug"
                              style={{ color: "var(--dim)" }}
                            >
                              {meta.tagline}
                            </div>
                          </div>
                          {active && (
                            <div
                              className="font-mono text-[10px] tracking-[1.4px] uppercase"
                              style={{ color: "var(--accent)" }}
                            >
                              ◆ active
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {process.env.NODE_ENV !== "production" && (
                    <p
                      className="mt-4 font-mono text-[10px] tracking-[1.4px]"
                      style={{ color: "var(--dim-2)" }}
                    >
                      DEV · valid themes: {COSMIC_THEMES.join(" / ")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="aegis-card-head">
                    <CodeChip>CUR</CodeChip>
                    <h3 className="card-title">Currency</h3>
                  </div>
                  <Select
                    value={settings.currency}
                    onChange={(e) => {
                      updateSettings({ currency: e.target.value });
                      toast.success(`Currency set to ${e.target.value}`);
                    }}
                    options={[
                      { value: "USD", label: "USD - US Dollar" },
                      { value: "EUR", label: "EUR - Euro" },
                      { value: "GBP", label: "GBP - British Pound" },
                      { value: "JPY", label: "JPY - Japanese Yen" },
                      { value: "THB", label: "THB - Thai Baht" },
                      { value: "CNY", label: "CNY - Chinese Yuan" },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="preferences">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="aegis-card-head">
                    <CodeChip>DTR</CodeChip>
                    <h3 className="card-title">Default Date Range</h3>
                  </div>
                  <p
                    className="text-xs mb-3 font-mono"
                    style={{ color: "var(--dim)" }}
                  >
                    How many days of data to show by default in reports and filters.
                  </p>
                  <Select
                    value={String(settings.defaultDateRangeDays)}
                    onChange={(e) =>
                      updateSettings({
                        defaultDateRangeDays: parseInt(e.target.value),
                      })
                    }
                    options={[
                      { value: "7", label: "Last 7 days" },
                      { value: "14", label: "Last 14 days" },
                      { value: "30", label: "Last 30 days" },
                      { value: "60", label: "Last 60 days" },
                      { value: "90", label: "Last 90 days" },
                      { value: "180", label: "Last 6 months" },
                      { value: "365", label: "Last year" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="aegis-card-head">
                    <CodeChip>PGN</CodeChip>
                    <h3 className="card-title">Items Per Page</h3>
                  </div>
                  <Select
                    value={String(settings.itemsPerPage)}
                    onChange={(e) =>
                      updateSettings({ itemsPerPage: parseInt(e.target.value) })
                    }
                    options={[
                      { value: "10", label: "10 items" },
                      { value: "25", label: "25 items" },
                      { value: "50", label: "50 items" },
                      { value: "100", label: "100 items" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="aegis-card-head mb-2 pb-0 border-0">
                        <CodeChip>AI</CodeChip>
                        <h3 className="card-title">AI Auto-Suggestions</h3>
                      </div>
                      <p
                        className="text-xs mt-1 font-mono"
                        style={{ color: "var(--dim)" }}
                      >
                        Automatically analyze spending and provide recommendations.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({
                          aiAutoSuggestions: !settings.aiAutoSuggestions,
                        })
                      }
                      role="switch"
                      aria-checked={settings.aiAutoSuggestions}
                      aria-label="Toggle AI auto-suggestions"
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      )}
                      style={{
                        background: settings.aiAutoSuggestions
                          ? "var(--accent)"
                          : "var(--pane-2)",
                      }}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full transition-transform shadow-sm",
                          settings.aiAutoSuggestions ? "translate-x-6" : "translate-x-1"
                        )}
                        style={{ background: "var(--fg)" }}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="aegis-card-head mb-2 pb-0 border-0">
                    <CodeChip>MDL</CodeChip>
                    <h3 className="card-title">AI Model</h3>
                  </div>
                  <p
                    className="text-xs font-mono"
                    style={{ color: "var(--dim)" }}
                  >
                    {aiModels
                      ? `Provider: ${aiModels.provider}. Listed live from the provider, so retired models drop off automatically.`
                      : "Loading the provider's model list…"}
                  </p>

                  {aiModels?.stale && (
                    <p
                      className="text-xs font-mono"
                      style={{ color: "var(--warn, #e8a85c)" }}
                    >
                      Could not reach {aiModels.provider} to list models
                      {aiModels.error ? ` (${aiModels.error})` : ""}. Showing the
                      model currently in effect only.
                    </p>
                  )}

                  <Select
                    label="Model"
                    // Driven by the server's `override`, not the persisted
                    // store copy — the store hydrates asynchronously and
                    // could briefly disagree with what the backend will
                    // actually use for the next AI call.
                    value={aiModels?.override ?? ""}
                    disabled={!aiModels || modelSaving}
                    onChange={(e) => handleModelChange(e.target.value)}
                    options={[
                      {
                        value: "",
                        label: aiModels
                          ? `Use server default (${aiModels.default})`
                          : "Use server default",
                      },
                      ...(aiModels?.models ?? []).map((m) => ({
                        value: m,
                        label: m,
                      })),
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="aegis-card-head mb-2 pb-0 border-0">
                    <CodeChip>KEY</CodeChip>
                    <h3 className="card-title">Provider API Key</h3>
                  </div>
                  <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                    Stored encrypted on the server. Leave unset to use the key
                    from the server&apos;s <code>.env</code>.
                  </p>

                  {apiKeySecret?.configured && (
                    <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                      {apiKeySecret.decryptable ? (
                        <>
                          Currently stored:{" "}
                          <b style={{ color: "var(--fg)" }}>
                            {apiKeySecret.masked}
                          </b>
                        </>
                      ) : (
                        // "set but unreadable" and "not set" need different
                        // fixes, so they are shown differently.
                        <span style={{ color: "var(--warn, #e8a85c)" }}>
                          A key is stored but cannot be decrypted — the server&apos;s
                          encryption key changed. Re-enter it below; meanwhile the{" "}
                          <code>.env</code> value is used.
                        </span>
                      )}
                    </p>
                  )}

                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      apiKeySecret?.configured
                        ? "Enter a new key to replace the stored one"
                        : "Paste your provider API key"
                    }
                    value={apiKeyDraft}
                    disabled={keySaving}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveKey}
                      disabled={keySaving || !apiKeyDraft.trim()}
                    >
                      {apiKeySecret?.configured ? "Replace key" : "Save key"}
                    </Button>
                    {apiKeySecret?.configured && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearKey}
                        disabled={keySaving}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="aegis-card-head mb-2 pb-0 border-0">
                    <CodeChip>USE</CodeChip>
                    <h3 className="card-title">AI Usage</h3>
                  </div>

                  {!aiUsage ? (
                    <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                      Loading usage…
                    </p>
                  ) : aiUsage.total_calls === 0 ? (
                    <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                      No AI calls in the last {aiUsage.period_days} days.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px]">
                        <span>
                          <span style={{ color: "var(--dim)" }}>calls </span>
                          {aiUsage.total_calls}
                        </span>
                        <span>
                          <span style={{ color: "var(--dim)" }}>in </span>
                          {aiUsage.total_input_tokens.toLocaleString()}
                        </span>
                        <span>
                          <span style={{ color: "var(--dim)" }}>out </span>
                          {aiUsage.total_output_tokens.toLocaleString()}
                        </span>
                        {aiUsage.estimated_cost_usd !== null && (
                          <span>
                            <span style={{ color: "var(--dim)" }}>est. </span>
                            {formatUsd(aiUsage.estimated_cost_usd)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 font-mono text-[12px]">
                        {aiUsage.by_model.map((m) => (
                          <div
                            key={m.model}
                            className="flex justify-between gap-3 py-1"
                            style={{ borderBottom: "1px dashed var(--pane-edge)" }}
                          >
                            <span className="truncate">{m.model}</span>
                            <span style={{ color: "var(--dim)" }}>
                              {m.calls} ·{" "}
                              {m.estimated_cost_usd !== null
                                ? formatUsd(m.estimated_cost_usd)
                                : "no price"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Token counts are measured and exact. The cost is
                          derived, so its provenance is stated rather than
                          presented as fact. */}
                      <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                        Token counts are measured.
                        {aiUsage.by_model.some((m) => m.cost_source === "table")
                          ? ` Costs marked from the built-in table use prices as of ${aiUsage.prices_as_of}.`
                          : " Costs use the provider's own published prices."}
                      </p>

                      {aiUsage.models_missing_price.length > 0 && (
                        <p className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                          No price available for{" "}
                          {aiUsage.models_missing_price.join(", ")} — excluded
                          from the total.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="aegis-card-head mb-2 pb-0 border-0">
                        <CodeChip>TUR</CodeChip>
                        <h3 className="card-title flex items-center gap-2">
                          <Sparkles size={14} style={{ color: "var(--accent)" }} />
                          Onboarding tour
                        </h3>
                      </div>
                      <p
                        className="text-xs mt-1 font-mono"
                        style={{ color: "var(--dim)" }}
                      >
                        Replay the first-run walkthrough on your next visit.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRestartTour}>
                      Restart tour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="about">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="p-3 rounded"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--accent), var(--accent-2))",
                      }}
                    >
                      <Shield size={24} style={{ color: "var(--void)" }} />
                    </div>
                    <div>
                      <h2
                        className="text-xl font-medium"
                        style={{
                          fontFamily: "var(--display-font)",
                          fontStyle: "var(--display-style)",
                          color: "var(--fg)",
                        }}
                      >
                        Aegis
                      </h2>
                      <p className="text-sm font-mono" style={{ color: "var(--dim)" }}>
                        AI-Powered Financial Planning
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-[12px]">
                    {[
                      // Sourced from package.json at build time rather than
                      // typed in here — a hardcoded literal had drifted to
                      // 1.0.0 while the repo shipped 1.2.0.
                      ["Version", APP_VERSION],
                      ["Frontend", "Next.js 15 + React 19 + shadcn/ui"],
                      ["Backend", "FastAPI + SQLAlchemy"],
                      // Read from the server: this line used to claim
                      // "Claude (Anthropic)" unconditionally, which is wrong
                      // on a Groq or Typhoon deploy.
                      [
                        "AI Engine",
                        aiModels
                          ? `${aiModels.provider} · ${aiModels.current}`
                          : "loading…",
                      ],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between py-2"
                        style={{ borderBottom: "1px dashed var(--pane-edge)" }}
                      >
                        <span style={{ color: "var(--dim)" }}>{k}</span>
                        <span style={{ color: "var(--fg)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card style={{ borderColor: "var(--bad)" }}>
                <CardContent className="p-6">
                  <div className="aegis-card-head" style={{ borderColor: "var(--bad)" }}>
                    <CodeChip>DNG</CodeChip>
                    <h3 className="card-title" style={{ color: "var(--bad)" }}>
                      Danger Zone
                    </h3>
                  </div>
                  <p
                    className="text-xs mb-4 font-mono"
                    style={{ color: "var(--dim)" }}
                  >
                    Reset all settings to their default values. This cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowReset(true)}
                  >
                    Reset All Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      <Modal
        open={showReset}
        onClose={() => setShowReset(false)}
        title="Reset Settings"
        size="sm"
      >
        <ModalBody>
          <p className="text-sm" style={{ color: "var(--dim)" }}>
            Are you sure you want to reset all settings to their default values?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowReset(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset}>
            Reset
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
