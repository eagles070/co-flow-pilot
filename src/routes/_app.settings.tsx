import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Settings as SettingsIcon } from "lucide-react";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { AutomationTab } from "@/components/settings/AutomationTab";
import { StatusesTab } from "@/components/settings/StatusesTab";
import { CitiesTab } from "@/components/settings/CitiesTab";
import { SimpleListTab } from "@/components/settings/SimpleListTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole, hasAnyRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canAccess = hasAnyRole(["admin", "moderator"]);

  if (!canAccess) {
    return (
      <div>
        <PageHeader title="Settings" description="System configuration and preferences." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You don't have permission to view settings. Admin access required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Central configuration hub for the system." />
      <SectionHeader
        icon={SettingsIcon}
        title="System Configuration"
        description="Manage statuses, cities, automations, notifications and more"
        variant="primary"
      />
      <Tabs defaultValue="general">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="categories">Expense Categories</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <AutomationTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="statuses" className="mt-4">
          <StatusesTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="cities" className="mt-4">
          <CitiesTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="sources" className="mt-4">
          <SimpleListTab
            isAdmin={isAdmin}
            table="order_sources"
            title="Order sources"
            description="Channels where orders come from."
            itemLabel="Source"
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <SimpleListTab
            isAdmin={isAdmin}
            table="expense_categories"
            title="Expense categories"
            description="Categories used to classify expenses in Finance."
            itemLabel="Category"
          />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
