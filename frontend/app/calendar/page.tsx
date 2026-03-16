import CalendarView from "./CalendarView";

export const metadata = {
  title: "Calendar | Aegis Wealth OS",
  description: "Plan and track scheduled payments and subscriptions",
};

export default function CalendarPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <CalendarView />
    </div>
  );
}
