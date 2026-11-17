import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: ROLE-BASED PORTAL ROUTING & DASHBOARD ISOLATION
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// AGENTS.md Rule 7: 5 Tailored Portal Views
// ==============================================================================

function getDefaultPortalForRole(role) {
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

function isExecutiveRole(role) {
  if (!role) return false;
  const upper = role.toUpperCase();
  return ["OWNER", "ADMINISTRATOR", "ADMIN", "ACCOUNTANT", "AUDITOR", "READ_ONLY"].includes(upper);
}

function isNavItemAllowedForRole(role, href) {
  if (!role) return false;
  const upper = role.toUpperCase();

  if (["OWNER", "ADMINISTRATOR", "ADMIN"].includes(upper)) {
    return true;
  }

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

  if (upper === "DELIVERY_PERSONNEL" || upper === "DELIVERY_DRIVER") {
    const allowed = [
      "/delivery-portal",
      "/delivery-notes",
      "/return-notes",
      "/fleet/trips",
      "/fleet/fuel",
      "/training",
    ];
    return allowed.some((allowedHref) => href === allowedHref || href?.startsWith(allowedHref + "/"));
  }

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

describe("1. Role-Based Default Portal Resolution (AGENTS.md Rule 7)", () => {
  it("should route DELIVERY_PERSONNEL to the Mobile PWA Delivery Driver App", () => {
    assert.equal(getDefaultPortalForRole("DELIVERY_PERSONNEL"), "/delivery-portal");
    assert.equal(getDefaultPortalForRole("DELIVERY_DRIVER"), "/delivery-portal");
  });

  it("should route WAREHOUSE_STAFF to the Warehouse Yard Portal", () => {
    assert.equal(getDefaultPortalForRole("WAREHOUSE_STAFF"), "/warehouse-portal");
    assert.equal(getDefaultPortalForRole("WAREHOUSE_OPERATOR"), "/warehouse-portal");
    assert.equal(getDefaultPortalForRole("WAREHOUSE_MANAGER"), "/warehouse-portal");
  });

  it("should route LABOUR_SUPERVISOR to Labour & Daily Attendance", () => {
    assert.equal(getDefaultPortalForRole("LABOUR_SUPERVISOR"), "/labour/attendance");
  });

  it("should route Executive, Accounting, and Admin roles to the Executive Dashboard", () => {
    assert.equal(getDefaultPortalForRole("OWNER"), "/dashboard");
    assert.equal(getDefaultPortalForRole("ADMINISTRATOR"), "/dashboard");
    assert.equal(getDefaultPortalForRole("ADMIN"), "/dashboard");
    assert.equal(getDefaultPortalForRole("ACCOUNTANT"), "/dashboard");
    assert.equal(getDefaultPortalForRole("AUDITOR"), "/dashboard");
    assert.equal(getDefaultPortalForRole("READ_ONLY"), "/dashboard");
  });

  it("should safely default unauthenticated or empty roles to /dashboard", () => {
    assert.equal(getDefaultPortalForRole(null), "/dashboard");
    assert.equal(getDefaultPortalForRole(undefined), "/dashboard");
    assert.equal(getDefaultPortalForRole(""), "/dashboard");
  });
});

describe("2. Executive Role Guard Logic", () => {
  it("should recognize Executive roles entitled to the Executive Dashboard", () => {
    assert.equal(isExecutiveRole("OWNER"), true);
    assert.equal(isExecutiveRole("ADMINISTRATOR"), true);
    assert.equal(isExecutiveRole("ADMIN"), true);
    assert.equal(isExecutiveRole("ACCOUNTANT"), true);
    assert.equal(isExecutiveRole("AUDITOR"), true);
    assert.equal(isExecutiveRole("READ_ONLY"), true);
  });

  it("should strictly reject non-executive operational roles from Executive Dashboard", () => {
    assert.equal(isExecutiveRole("DELIVERY_PERSONNEL"), false);
    assert.equal(isExecutiveRole("DELIVERY_DRIVER"), false);
    assert.equal(isExecutiveRole("DELIVERY_MANAGER"), false);
    assert.equal(isExecutiveRole("WAREHOUSE_STAFF"), false);
    assert.equal(isExecutiveRole("WAREHOUSE_OPERATOR"), false);
    assert.equal(isExecutiveRole("WAREHOUSE_MANAGER"), false);
    assert.equal(isExecutiveRole("LABOUR_SUPERVISOR"), false);
    assert.equal(isExecutiveRole(null), false);
    assert.equal(isExecutiveRole(undefined), false);
  });
});

describe("3. Sidebar Navigation Filtering by Role", () => {
  it("should restrict DELIVERY_PERSONNEL to operational delivery tools only", () => {
    const role = "DELIVERY_PERSONNEL";

    // Allowed routes
    assert.equal(isNavItemAllowedForRole(role, "/delivery-portal"), true);
    assert.equal(isNavItemAllowedForRole(role, "/delivery-notes"), true);
    assert.equal(isNavItemAllowedForRole(role, "/return-notes"), true);
    assert.equal(isNavItemAllowedForRole(role, "/fleet/trips"), true);
    assert.equal(isNavItemAllowedForRole(role, "/fleet/fuel"), true);
    assert.equal(isNavItemAllowedForRole(role, "/training"), true);

    // Blocked routes (Executive, Accounting, Financial, System Admin)
    assert.equal(isNavItemAllowedForRole(role, "/dashboard"), false);
    assert.equal(isNavItemAllowedForRole(role, "/inventory"), false);
    assert.equal(isNavItemAllowedForRole(role, "/invoices"), false);
    assert.equal(isNavItemAllowedForRole(role, "/accounting"), false);
    assert.equal(isNavItemAllowedForRole(role, "/accounting/accounts"), false);
    assert.equal(isNavItemAllowedForRole(role, "/accounting/journals"), false);
    assert.equal(isNavItemAllowedForRole(role, "/accounting/reports"), false);
    assert.equal(isNavItemAllowedForRole(role, "/rentals/statements"), false);
    assert.equal(isNavItemAllowedForRole(role, "/users"), false);
    assert.equal(isNavItemAllowedForRole(role, "/roles"), false);
    assert.equal(isNavItemAllowedForRole(role, "/document-settings"), false);
    assert.equal(isNavItemAllowedForRole(role, "/audit-logs"), false);
    assert.equal(isNavItemAllowedForRole(role, "/cutover"), false);
  });

  it("should restrict WAREHOUSE_STAFF to warehouse yard operations", () => {
    const role = "WAREHOUSE_STAFF";

    // Allowed routes
    assert.equal(isNavItemAllowedForRole(role, "/warehouse-portal"), true);
    assert.equal(isNavItemAllowedForRole(role, "/delivery-notes"), true);
    assert.equal(isNavItemAllowedForRole(role, "/return-notes"), true);
    assert.equal(isNavItemAllowedForRole(role, "/stock-transfers"), true);
    assert.equal(isNavItemAllowedForRole(role, "/purchases"), true);
    assert.equal(isNavItemAllowedForRole(role, "/inventory/audits"), true);
    assert.equal(isNavItemAllowedForRole(role, "/training"), true);

    // Blocked routes
    assert.equal(isNavItemAllowedForRole(role, "/dashboard"), false);
    assert.equal(isNavItemAllowedForRole(role, "/delivery-portal"), false);
    assert.equal(isNavItemAllowedForRole(role, "/accounting"), false);
    assert.equal(isNavItemAllowedForRole(role, "/invoices"), false);
    assert.equal(isNavItemAllowedForRole(role, "/users"), false);
  });

  it("should allow OWNER universal visibility across all navigation items", () => {
    const role = "OWNER";
    assert.equal(isNavItemAllowedForRole(role, "/dashboard"), true);
    assert.equal(isNavItemAllowedForRole(role, "/delivery-portal"), true);
    assert.equal(isNavItemAllowedForRole(role, "/warehouse-portal"), true);
    assert.equal(isNavItemAllowedForRole(role, "/accounting"), true);
    assert.equal(isNavItemAllowedForRole(role, "/users"), true);
    assert.equal(isNavItemAllowedForRole(role, "/roles"), true);
    assert.equal(isNavItemAllowedForRole(role, "/cutover"), true);
  });
});
