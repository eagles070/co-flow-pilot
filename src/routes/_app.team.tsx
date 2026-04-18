import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/team")({
  component: () => (
    <ModulePlaceholder
      title="Team Performance"
      description="Per-agent metrics: orders handled, confirmation rate, delivery rate, revenue."
    />
  ),
});
