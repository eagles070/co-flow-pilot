import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/finance/OverviewTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { ProfitTab } from "@/components/finance/ProfitTab";
import { CashFlowTab } from "@/components/finance/CashFlowTab";
import { SimulatorTab } from "@/components/finance/SimulatorTab";

export const Route = createFileRoute("/_app/finance")({
  component: FinancePage,
});

function FinancePage() {
  return (
    <div>
      <PageHeader title="Finance" description="Revenue, expenses, profit, cash flow and simulations." />
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="profit"><ProfitTab /></TabsContent>
        <TabsContent value="cashflow"><CashFlowTab /></TabsContent>
        <TabsContent value="simulator"><SimulatorTab /></TabsContent>
      </Tabs>
    </div>
  );
}
