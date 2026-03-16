import ReportsView from "./ReportsView";

export const metadata = {
  title: "Reports | Aegis Wealth OS",
  description: "Financial analytics and insights",
};

export default function ReportsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <ReportsView />
    </div>
  );
}
