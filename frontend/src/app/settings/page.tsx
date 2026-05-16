"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, COSMIC_THEMES, type CosmicTheme } from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { PageHead } from "@/components/shell/page-head";
import { CodeChip } from "@/components/shell/code-chip";
import { Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { theme, setTheme, settings, updateSettings, resetSettings, restartTour } =
    useAppStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("appearance");
  const [showReset, setShowReset] = useState(false);

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
                    className="text-[12.5px] mb-4 font-mono"
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
                    className="text-[12.5px] mb-3 font-mono"
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
                        className="text-[12.5px] mt-1 font-mono"
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
                        className="text-[12.5px] mt-1 font-mono"
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
                      ["Version", "1.0.0"],
                      ["Frontend", "Next.js 15 + React 19 + shadcn/ui"],
                      ["Backend", "FastAPI + SQLAlchemy"],
                      ["AI Engine", "Claude (Anthropic) + tool_use"],
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
                    className="text-[12.5px] mb-4 font-mono"
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
