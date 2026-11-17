/**
 * Role-Based Portal Routing & Tailored Landing Views
 * Operating Business: AJAY ENTERPRISES
 * Adheres strictly to AGENTS.md Rule 7: 5 Tailored Portal Views
 *
 * 1. Owner / Super Admin: Executive Dashboard (/dashboard)
 * 2. Office / Accountant: Accounting & Billing (/dashboard or /invoices)
 * 3. Warehouse Staff: Warehouse Yard Portal (/warehouse-portal)
 * 4. Delivery Personnel (Mobile PWA): Delivery Driver App (/delivery-portal)
 * 5. Labour Supervisor (Mobile PWA): Labour & Daily Attendance (/labour/attendance)
 */

export function getDefaultPortalForRole(role?: string | null): string {
  if (!role) return "/dashboard";

  switch (role.toUpperCase()) {
    case "DELIVERY_PERSONNEL":
    case "DELIVERY_DRIVER":
      return "/delivery-portal";

    case "WAREHOUSE_STAFF":
    case "WAREHOUSE_OPERATOR":
      return "/warehouse-portal";

    case "LABOUR_SUPERVISOR":
      return "/labour/attendance";

    case "DELIVERY_MANAGER":
      return "/delivery-portal";

    case "WAREHOUSE_MANAGER":
      return "/warehouse-portal";

    case "ACCOUNTANT":
    case "OWNER":
    case "ADMINISTRATOR":
    case "ADMIN":
    case "AUDITOR":
    case "READ_ONLY":
    default:
      return "/dashboard";
  }
}

/**
 * Checks whether a given role is permitted to view the Executive Management Dashboard.
 * Non-executive operational roles (Delivery, Warehouse Staff, Labour) are strictly redirected.
 */
export function isExecutiveRole(role?: string | null): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return ["OWNER", "ADMINISTRATOR", "ADMIN", "ACCOUNTANT", "AUDITOR", "READ_ONLY"].includes(upper);
}

/**
 * Filters sidebar navigation items based on the user's role.
 * Ensures non-executive and field roles only see the tools and pages authorized for their workflow.
 */
export function isNavItemAllowedForRole(role?: string | null, href?: string): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();

  // 1. Executive / Super Admin / Administrator: Universal access
  if (["OWNER", "ADMINISTRATOR", "ADMIN"].includes(upper)) {
    return true;
  }

  // 2. Auditor / Read-Only: Full inspection access except sensitive administrative edits & field portals
  if (["AUDITOR", "READ_ONLY"].includes(upper)) {
    const blockedForAuditor = [
      "/users",
      "/roles",
      "/document-settings",
      "/cutover",
      "/demo-data",
      "/warehouse-portal",
      "/delivery-portal",
    ];
    return !blockedForAuditor.includes(href || "");
  }

  // 3. Accountant: Billing, Invoicing, General Ledger, GST, Customers, Masters, Reports
  if (upper === "ACCOUNTANT") {
    const blockedForAccountant = [
      "/users",
      "/roles",
      "/document-settings",
      "/cutover",
      "/demo-data",
      "/warehouse-portal",
      "/delivery-portal",
    ];
    return !blockedForAccountant.includes(href || "");
  }

  // 4. Delivery Personnel (Mobile Driver PWA)
  if (upper === "DELIVERY_PERSONNEL" || upper === "DELIVERY_DRIVER") {
    const allowed = [
      "/delivery-portal",
      "/delivery-notes",
      "/return-notes",
      "/fleet/trips",
      "/fleet/fuel",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

  // 5. Delivery Manager: Fleet dispatch scheduling, vehicle assignments, trip tracking
  if (upper === "DELIVERY_MANAGER") {
    const allowed = [
      "/delivery-portal",
      "/delivery-notes",
      "/return-notes",
      "/stock-transfers",
      "/movements",
      "/customers",
      "/fleet",
      "/fleet/vehicles",
      "/fleet/drivers",
      "/fleet/trips",
      "/fleet/fuel",
      "/fleet/maintenance",
      "/reports/fleet",
      "/training",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

  // 6. Warehouse Staff: Picking, loading, return inspection, repair jobs, counts
  if (upper === "WAREHOUSE_STAFF" || upper === "WAREHOUSE_OPERATOR") {
    const allowed = [
      "/warehouse-portal",
      "/delivery-notes",
      "/return-notes",
      "/stock-transfers",
      "/purchases",
      "/hiring-notes",
      "/movements",
      "/inventory/audits",
      "/materials",
      "/warehouses",
      "/material-maintenance",
      "/training",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

  // 7. Warehouse Manager: Complete Yard & Inventory Operations
  if (upper === "WAREHOUSE_MANAGER") {
    const allowed = [
      "/warehouse-portal",
      "/inventory",
      "/delivery-notes",
      "/return-notes",
      "/operations/direct-transfers",
      "/stock-transfers",
      "/purchases",
      "/hiring-notes",
      "/movements",
      "/inventory/audits",
      "/customers",
      "/suppliers",
      "/materials",
      "/warehouses",
      "/material-maintenance",
      "/reports/inventory",
      "/reports/maintenance",
      "/training",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

  // 8. Labour Supervisor: Daily site attendance, overtime, workforce roster
  if (upper === "LABOUR_SUPERVISOR") {
    const allowed = [
      "/labour",
      "/labour/workers",
      "/labour/attendance",
      "/labour/advances",
      "/material-maintenance",
      "/training",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

  return false;
}
