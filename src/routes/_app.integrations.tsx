import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, FileSpreadsheet, Truck } from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});

const integrations = [
  {
    icon: ShoppingBag,
    name: "Shopify",
    description: "Sync orders from your Shopify stores in real time.",
    status: "Coming soon",
  },
  {
    icon: FileSpreadsheet,
    name: "Google Sheets",
    description: "Pull orders from a spreadsheet on a schedule.",
    status: "Coming soon",
  },
  {
    icon: Truck,
    name: "Delivery provider (Ameex)",
    description: "Push shipments and receive status webhooks automatically.",
    status: "Coming soon",
  },
];

function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect external sources and delivery providers."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((i) => {
          const Icon = i.icon;
          return (
            <Card key={i.name}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{i.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{i.description}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{i.status}</Badge>
                  <Button size="sm" variant="outline" disabled>
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
