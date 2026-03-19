import HistoryView from "./HistoryView";

export const metadata = {
  title: "History | Aegis Wealth OS",
  description: "Financial snapshots and analysis history",
};

export default function HistoryPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <HistoryView />
    </div>
  );
}
