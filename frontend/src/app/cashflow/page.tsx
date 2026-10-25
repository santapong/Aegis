import type { Metadata } from "next";
import CashWorkspace from "@/components/cashflow/workspace";
export const metadata: Metadata = {
  title: "Cash planning",
  robots: { index: false, follow: false },
};
export default function CashflowPage() {
  return <CashWorkspace />;
}
