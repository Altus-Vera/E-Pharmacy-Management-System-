/** Role groups from the System Requirements "User Classes" table (mirrors the API's R class). */
export type Role = "pharmacist" | "stockmanager" | "pharmacymanager" | "systemadministrator";

export const normalizeRole = (t?: string | null): Role | null =>
  t ? (t.replace(/_/g, "").toLowerCase() as Role) : null;

const POS: Role[] = ["pharmacist", "pharmacymanager", "systemadministrator"];
const STOCK: Role[] = ["stockmanager", "pharmacymanager", "systemadministrator"];
const MANAGER: Role[] = ["pharmacymanager", "systemadministrator"];
const ALL: Role[] = ["pharmacist", "stockmanager", "pharmacymanager", "systemadministrator"];

/** Which roles may open each ERP page. */
export const PAGE_ROLES: Record<string, Role[]> = {
  "/": ALL,
  "/customers": POS,
  "/doctors": POS,
  "/prescriptions": POS,
  "/prescription-scans": MANAGER,
  "/rx-queue": POS,
  "/sales-returns": POS,
  "/shifts": MANAGER,
  "/inventory": STOCK,
  "/stock-view": STOCK,
  "/stock-locations": STOCK,
  "/uom": STOCK,
  "/dose-codes": ALL,
  "/suppliers": STOCK,
  "/purchase-requisitions": STOCK,
  "/purchase-orders": STOCK,
  "/grn": STOCK,
  "/purchase-invoices": STOCK,
  "/supplier-returns": STOCK,
  "/stock-transfers": STOCK,
  "/reports": STOCK,
  "/outlets": MANAGER,
  "/users": MANAGER,
  "/audit-log": MANAGER,
  "/system": ["systemadministrator"],
};

export function canAccess(path: string, userType?: string | null): boolean {
  const role = normalizeRole(userType);
  if (!role) return false;
  const allowed = PAGE_ROLES[path];
  return !allowed || allowed.includes(role);
}

export const isManager = (userType?: string | null) => MANAGER.includes(normalizeRole(userType) as Role);
