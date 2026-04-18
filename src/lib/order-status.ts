export type OrderStatus =
  | "new"
  | "assigned"
  | "confirmed"
  | "no_reply"
  | "cancelled"
  | "duplicate"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "returned"
  | "refused"
  | "postponed";

export type OrderSource = "shopify" | "google_sheet" | "manual" | "landing_page";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "confirmed", label: "Confirmed" },
  { value: "no_reply", label: "No reply" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "duplicate", label: "Duplicate" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "refused", label: "Refused" },
];

export const ORDER_SOURCES: { value: OrderSource; label: string }[] = [
  { value: "shopify", label: "Shopify" },
  { value: "google_sheet", label: "Google Sheet" },
  { value: "manual", label: "Manual" },
  { value: "landing_page", label: "Landing page" },
];

export function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.value === s)?.label ?? s;
}

export function statusVariant(
  s: OrderStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "delivered":
    case "confirmed":
      return "default";
    case "cancelled":
    case "returned":
    case "refused":
    case "duplicate":
      return "destructive";
    case "shipped":
    case "in_transit":
    case "assigned":
      return "secondary";
    default:
      return "outline";
  }
}
