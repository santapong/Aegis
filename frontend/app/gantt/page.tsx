import GanttChart from "./GanttChart";

export const metadata = {
  title: "Gantt Chart | Aegis Wealth OS",
  description: "Goal-oriented financial timeline",
};

export default function GanttPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <GanttChart />
    </div>
  );
}
