import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export const Route = createFileRoute("/_app/call-center")({
  component: () => (
    <ModulePlaceholder
      title="Call Center"
      description="Focus mode for agents — confirm orders one at a time."
      features={[
        "Queue: New + Recall (NRP)",
        "Single-order focus view with client + product info",
        "Actions: Confirm, No Answer, Cancel, Wrong number, Remind later",
        "Manual mode by default, optional auto-next",
      ]}
    />
  ),
});
