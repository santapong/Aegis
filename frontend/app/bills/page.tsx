import BillReminders from "./BillReminders";

export const metadata = {
  title: "Bill Reminders | Aegis Wealth OS",
  description: "Never miss a payment",
};

export default function BillsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <BillReminders />
    </div>
  );
}
