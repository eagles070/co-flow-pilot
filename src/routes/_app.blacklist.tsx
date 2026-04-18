import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/blacklist")({
  component: () => (
    <ModulePlaceholder
      title="Blacklist"
      description="Risky clients flagged for repeated NRP or cancellations."
    />
  ),
});
