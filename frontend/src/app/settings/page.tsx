"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Sun, Moon, Monitor, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme, settings, updateSettings, resetSettings } = useAppStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("appearance");
  const [showReset, setShowReset] = useState(false);

  const handleReset = () => {
    resetSettings();
    setTheme("light");
    setShowReset(false);
    toast.success("Settings reset to defaults");
  };

  return (
    <motion.div
      className="max-w-3xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader title="Settings" subtitle="Customize your Aegis experience" />
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
              {/* Theme Selection */}
              <Card>
                <CardBody>
                  <h3 className="font-semibold mb-4">Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "light"
                          ? "border-[var(--primary)] bg-blue-500/5"
                          : "border-[var(--border)] hover:border-[var(--text-muted)]"
                      )}
                    >
                      <Sun size={20} className="text-yellow-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Light</p>
                        <p className="text-xs text-[var(--text-muted)]">Clean and bright</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                        theme === "dark"
                          ? "border-[var(--primary)] bg-blue-500/5"
                          : "border-[var(--border)] hover:border-[var(--text-muted)]"
                      )}
                    >
                      <Moon size={20} className="text-indigo-500" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Dark</p>
                        <p className="text-xs text-[var(--text-muted)]">Easy on the eyes</p>
                      </div>
                    </button>
                  </div>
                </CardBody>
              </Card>

              {/* Currency */}
              <Card>
                <CardBody>
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
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="preferences">
            <div className="space-y-6">
              {/* Default Date Range */}
              <Card>
                <CardBody>
                  <h3 className="font-semibold mb-4">Default Date Range</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
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
                </CardBody>
              </Card>

              {/* Items Per Page */}
              <Card>
                <CardBody>
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
                </CardBody>
              </Card>

              {/* AI Auto-Suggestions */}
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">AI Auto-Suggestions</h3>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        Automatically analyze spending and provide recommendations
                      </p>
                    </div>
                    <button
                      onClick={() => updateSettings({ aiAutoSuggestions: !settings.aiAutoSuggestions })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        settings.aiAutoSuggestions ? "bg-[var(--primary)]" : "bg-[var(--border)]"
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
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="about">
            <div className="space-y-6">
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Shield size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                        Aegis
                      </h2>
                      <p className="text-sm text-[var(--text-muted)]">AI-Powered Financial Planning</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-sm text-[var(--text-muted)]">Version</span>
                      <span className="text-sm font-medium">0.5.0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-sm text-[var(--text-muted)]">Frontend</span>
                      <span className="text-sm font-medium">Next.js 15 + React 19</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-sm text-[var(--text-muted)]">Backend</span>
                      <span className="text-sm font-medium">FastAPI + PostgreSQL</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-sm text-[var(--text-muted)]">AI Engine</span>
                      <span className="text-sm font-medium">Claude (Anthropic)</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Danger Zone */}
              <Card className="border-red-500/30">
                <CardBody>
                  <h3 className="font-semibold text-red-500 mb-2">Danger Zone</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    Reset all settings to their default values. This cannot be undone.
                  </p>
                  <Button variant="danger" size="sm" onClick={() => setShowReset(true)}>
                    Reset All Settings
                  </Button>
                </CardBody>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      {/* Reset Confirmation */}
      <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Settings" size="sm">
        <ModalBody>
          <p className="text-sm text-[var(--text-muted)]">
            Are you sure you want to reset all settings to their default values?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowReset(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleReset}>Reset</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
