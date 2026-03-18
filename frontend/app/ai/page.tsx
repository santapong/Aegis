import AIChat from "./AIChat";

export const metadata = {
  title: "AI Advisor | Aegis Wealth OS",
  description: "AI-powered financial advice and analysis",
};

export default function AIPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <AIChat />
    </div>
  );
}
