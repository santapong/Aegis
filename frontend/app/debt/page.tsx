import DebtTracker from "./DebtTracker";

export const metadata = {
  title: "Debt Tracker | Aegis Wealth OS",
  description: "Track and plan debt payoff",
};

export default function DebtPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <DebtTracker />
    </div>
  );
}
