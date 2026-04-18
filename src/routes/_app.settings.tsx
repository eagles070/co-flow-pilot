import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/settings")({
  component: () => (
    <ModulePlaceholder
      title="Settings"
      description="System name, automation rules, sources, statuses, expense types and cities."
    />
  ),
});
