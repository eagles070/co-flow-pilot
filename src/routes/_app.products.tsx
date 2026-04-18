import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/products")({
  component: () => (
    <ModulePlaceholder
      title="Product Analytics"
      description="Per-product performance: orders, revenue, profit, return rate."
    />
  ),
});
