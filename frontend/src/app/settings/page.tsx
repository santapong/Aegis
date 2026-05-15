"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Sun, Moon, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme, settings, updateSettings, resetSettings, restartTour } = useAppStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("appearance");
  const [showReset, setShowReset] = useState(false);

  const handleReset = () => {
    resetSettings();
    setTheme("light");
    setShowReset(false);
    toast.success("Settings reset to defaults");
  };

  const handleRestartTour = () => {
    restartTour();
    toast.success("Onboarding tour will replay on your next visit");
  };

  return (
    <motion.div
      className="max-w-3xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Settings"
          subtitle="Local preferences for this device — they live in your browser's storage. Sync to your account is coming in a future release."
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
                  <h3 className="font-semibold mb-4">Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "light"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <Sun size={20} className="text-amber-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Light</p>
                        <p className="text-xs text-muted-foreground">Clean and bright</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "dark"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <Moon size={20} className="text-indigo-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Dark</p>
                        <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Currency</h3>
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
                  <h3 className="font-semibold mb-4">Default Date Range</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    How many days of data to show by default in reports and filters
                  </p>
                  <Select
                    value={String(settings.defaultDateRangeDays)}
                    onChange={(e) => updateSettings({ defaultDateRangeDays: parseInt(e.target.value) })}
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
                  <h3 className="font-semibold mb-4">Items Per Page</h3>
                  <Select
                    value={String(settings.itemsPerPage)}
                    onChange={(e) => updateSettings({ itemsPerPage: parseInt(e.target.value) })}
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
                      <h3 className="font-semibold">AI Auto-Suggestions</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically analyze spending and provide recommendations
                      </p>
                    </div>
                    <button
                      onClick={() => updateSettings({ aiAutoSuggestions: !settings.aiAutoSuggestions })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        settings.aiAutoSuggestions ? "bg-primary" : "bg-input"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                          settings.aiAutoSuggestions ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Sparkles size={16} className="text-primary" />
                        Onboarding tour
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
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
                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500">
                      <Shield size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                        Aegis
                      </h2>
                      <p className="text-sm text-muted-foreground">AI-Powered Financial Planning</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Version</span>
                      <span className="text-sm font-medium">1.0.0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Frontend</span>
                      <span className="text-sm font-medium">Next.js 15 + React 19 + shadcn/ui</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">Backend</span>
                      <span className="text-sm font-medium">FastAPI + SQLAlchemy (SQLite / PostgreSQL / MySQL)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">AI Engine</span>
                      <span className="text-sm font-medium">Claude (Anthropic) + tool_use</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/30">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reset all settings to their default values. This cannot be undone.
                  </p>
                  <Button variant="destructive" size="sm" onClick={() => setShowReset(true)}>
                    Reset All Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Settings" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to reset all settings to their default values?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowReset(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleReset}>Reset</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
