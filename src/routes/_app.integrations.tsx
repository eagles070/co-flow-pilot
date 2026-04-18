import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/integrations")({
  component: () => (
    <ModulePlaceholder
      title="Integrations"
      description="Connect Shopify stores, Google Sheets and your delivery provider."
    />
  ),
});
