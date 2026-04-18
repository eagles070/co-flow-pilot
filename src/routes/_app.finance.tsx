import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/finance")({
  component: () => (
    <ModulePlaceholder
      title="Finance"
      description="Expenses, profit, cash flow and a profit simulator."
      features={["Overview", "Expenses", "Profit", "Cash Flow", "Simulator"]}
    />
  ),
});
