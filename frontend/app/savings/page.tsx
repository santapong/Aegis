import SavingsJars from "./SavingsJars";

export const metadata = {
  title: "Savings Jars | Aegis Wealth OS",
  description: "Visual savings goals",
};

export default function SavingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <SavingsJars />
    </div>
  );
}
