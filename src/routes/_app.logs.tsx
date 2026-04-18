import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/logs")({
  component: () => (
    <ModulePlaceholder
      title="System Logs"
      description="Admin-only audit trail of all user actions."
    />
  ),
});
