import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/sourcing")({
  component: () => (
    <ModulePlaceholder
      title="Sourcing"
      description="Track purchases from suppliers — costs, transport and stock arrivals."
    />
  ),
});
