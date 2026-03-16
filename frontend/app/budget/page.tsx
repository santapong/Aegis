import BudgetTracker from "./BudgetTracker";

export const metadata = {
  title: "Budget | Aegis Wealth OS",
  description: "Income and expense tracking",
};

export default function BudgetPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <BudgetTracker />
    </div>
  );
}
