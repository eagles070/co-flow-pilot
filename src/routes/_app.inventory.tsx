import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/inventory")({
  component: () => (
    <ModulePlaceholder
      title="Inventory"
      description="Products, stock levels and supplier info."
      features={[
        "Product fields: name, image, internal ID, external SKU, supplier",
        "Auto-decrease stock when shipped",
        "Low stock alerts and product status",
      ]}
    />
  ),
});
