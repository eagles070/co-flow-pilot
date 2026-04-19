import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SimulatorTab() {
  const [sellPrice, setSellPrice] = useState(300);
  const [productCost, setProductCost] = useState(80);
  const [deliveryCost, setDeliveryCost] = useState(40);
  const [returnCost, setReturnCost] = useState(20);
  const [confirmRate, setConfirmRate] = useState(60);
  const [deliveryRate, setDeliveryRate] = useState(75);
  const [orders, setOrders] = useState(100);

  const confirmed = orders * (confirmRate / 100);
  const delivered = confirmed * (deliveryRate / 100);
  const returned = confirmed - delivered;

  const revenue = delivered * sellPrice;
  const productCostTotal = confirmed * productCost; // committed once confirmed
  const deliveryCostTotal = delivered * deliveryCost;
  const returnCostTotal = returned * returnCost;
  const totalCost = productCostTotal + deliveryCostTotal + returnCostTotal;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Break-even: orders needed where profit per order >= 0
  const grossPerDelivered = sellPrice - productCost - deliveryCost;
  const lossPerReturned = productCost + returnCost;
  const profitPerOrder =
    (confirmRate / 100) * ((deliveryRate / 100) * grossPerDelivered - (1 - deliveryRate / 100) * lossPerReturned);
  const breakEvenOrders = profitPerOrder > 0 ? 0 : profitPerOrder === 0 ? Infinity : Infinity;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Inputs</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Selling price" value={sellPrice} onChange={setSellPrice} />
          <Field label="Product cost" value={productCost} onChange={setProductCost} />
          <Field label="Delivery cost (est.)" value={deliveryCost} onChange={setDeliveryCost} />
          <Field label="Return cost" value={returnCost} onChange={setReturnCost} />
          <Field label="Confirmation rate %" value={confirmRate} onChange={setConfirmRate} />
          <Field label="Delivery rate %" value={deliveryRate} onChange={setDeliveryRate} />
          <Field label="Orders" value={orders} onChange={setOrders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Outputs</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Confirmed orders" value={confirmed.toFixed(0)} />
          <Row label="Delivered orders" value={delivered.toFixed(0)} />
          <Row label="Returned orders" value={returned.toFixed(0)} />
          <hr className="border-border" />
          <Row label="Expected revenue" value={revenue.toFixed(2)} />
          <Row label="Expected cost" value={totalCost.toFixed(2)} />
          <Row label="Estimated profit" value={profit.toFixed(2)} highlight={profit >= 0 ? "good" : "bad"} />
          <Row label="Margin" value={`${margin.toFixed(1)}%`} highlight={margin >= 15 ? "good" : margin >= 0 ? "warn" : "bad"} />
          <Row label="Profit per order" value={profitPerOrder.toFixed(2)} highlight={profitPerOrder >= 0 ? "good" : "bad"} />
          <Row
            label="Break-even"
            value={profitPerOrder > 0 ? "Profitable per order ✓" : profitPerOrder === 0 ? "Exactly break-even" : "Loss per order — adjust inputs"}
            highlight={profitPerOrder >= 0 ? "good" : "bad"}
          />
          <p className="pt-2 text-xs text-muted-foreground">
            Delivery cost is an internal estimation only — not linked to real carrier pricing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" | "warn" }) {
  const color = highlight === "good" ? "text-green-600" : highlight === "bad" ? "text-destructive" : highlight === "warn" ? "text-yellow-600" : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}
