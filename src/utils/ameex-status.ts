/**
 * Map Ameex parcel status codes (STATUT / STATUT_S) to CRM order_status enum.
 * Mirrors the logic from the PHP webhook receiver (code 3) to stay in sync with
 * the legacy implementation that has been battle-tested in production.
 *
 * Returns null when the status is unknown — the caller should keep the order
 * untouched and just log the payload.
 */
export type CrmOrderStatus =
  | "shipped"
  | "in_transit"
  | "delivered"
  | "returned"
  | "refused"
  | "postponed"
  | "cancelled";

export function mapAmeexStatusToCrm(
  statut: string | null | undefined,
  statutS: string | null | undefined,
): { crmStatus: CrmOrderStatus } | null {
  const s = (statut || "").toUpperCase().trim();
  const sub = (statutS || "").toUpperCase().trim();

  if (!s) return null;

  // Final / terminal states
  if (s === "DELIVERED" || s === "LIVRE" || s === "LIVREE") return { crmStatus: "delivered" };
  if (s === "RETURNED" || s === "RETOURNE" || s === "RETOUR") return { crmStatus: "returned" };
  if (s === "REFUSED" || s === "REFUSE") return { crmStatus: "refused" };
  if (s === "ANNULE" || s === "CANCELLED" || s === "CANCELED") return { crmStatus: "cancelled" };

  // In-transit family
  if (s === "DISTRIBUTION" || s === "EN_DISTRIBUTION" || s === "RAMASSAGE" || s === "RECU") {
    return { crmStatus: "in_transit" };
  }

  if (s === "IN_PROGRESS" || s === "EN_COURS") {
    if (sub === "POSTPONED" || sub === "REPORTE") return { crmStatus: "postponed" };
    return { crmStatus: "in_transit" };
  }

  // Just dispatched / picked
  if (s === "READY" || s === "PRET" || s === "NEW" || s === "NEW_PARCEL") {
    return { crmStatus: "shipped" };
  }

  return null;
}
