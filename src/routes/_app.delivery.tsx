import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/delivery")({
  component: () => (
    <ModulePlaceholder
      title="Delivery"
      description="Track shipments and sync statuses with your delivery provider."
      features={[
        "Tabs: Follow-up (issues) and All orders",
        "Sync with delivery API (Ameex, etc.)",
        "Webhook-driven status updates",
        "Per-order refresh and bulk actions",
      ]}
    />
  ),
});
