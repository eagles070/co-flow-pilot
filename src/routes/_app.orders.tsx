import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/orders")({
  component: () => (
    <ModulePlaceholder
      title="Orders"
      description="Manage all incoming orders from Shopify, Google Sheets and other sources."
      features={[
        "Searchable, filterable table (date, product, city, agent, source)",
        "Bulk assign orders to agents",
        "Inline status updates and timeline access",
        "Source tagging (Shopify store, Sheets import)",
      ]}
    />
  ),
});
