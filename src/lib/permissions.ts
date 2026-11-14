import { db } from "./db";
import { SessionUser } from "./auth";

export const ROLES = [
  { id: "OWNER", label: "Owner / Super Admin", description: "Full business control, executive overview, financial and audit authority" },
  { id: "ADMINISTRATOR", label: "Administrator", description: "Operational and administrative system management" },
  { id: "ADMIN", label: "Administrator (Legacy Alias)", description: "Operational and administrative system management" },
  { id: "ACCOUNTANT", label: "Accountant", description: "Invoicing, monthly billing, ledgers, vouchers, tax & GST compliance" },
  { id: "WAREHOUSE_MANAGER", label: "Warehouse Manager", description: "Stock oversight, receipts, dispatch staging, and inventory counts" },
  { id: "WAREHOUSE_STAFF", label: "Warehouse Staff", description: "Physical picking, loading confirmation, and return inspection" },
  { id: "DELIVERY_MANAGER", label: "Delivery Manager", description: "Fleet dispatch scheduling, vehicle assignments, and route tracking" },
  { id: "DELIVERY_PERSONNEL", label: "Delivery Personnel", description: "Mobile delivery execution, GPS site photo capture, and receiver sign-off" },
  { id: "LABOUR_SUPERVISOR", label: "Labour Supervisor", description: "Worker attendance, site allocation, and overtime management" },
  { id: "AUDITOR", label: "Auditor / Read-Only", description: "Read-only reporting, ledger inspection, and audit exports" },
  { id: "READ_ONLY", label: "Read-Only (Legacy Alias)", description: "Read-only reporting, ledger inspection, and audit exports" },
] as const;

export type RoleType = (typeof ROLES)[number]["id"];

export const MODULES = [
  { id: "dashboard", label: "Overview & Dashboard" },
  { id: "company", label: "Company Profile & Bank" },
  { id: "branches", label: "Branches" },
  { id: "warehouses", label: "Warehouses & Yards" },
  { id: "users", label: "User Management" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "document_settings", label: "Document Series & Numbering" },
  { id: "audit_logs", label: "Audit Logs & History" },
  { id: "customers", label: "Customers & Sites" },
  { id: "suppliers", label: "Suppliers Master" },
  { id: "inventory", label: "Inventory Master" },
  { id: "movement", label: "Material Movements (DN/MRN/STN)" },
  { id: "purchases", label: "Purchasing & Receipts (PO/GRN/PR)" },
  { id: "delivery_notes", label: "Delivery Notes (DN)" },
  { id: "material_returns", label: "Material Return Notes (MRN)" },
  { id: "stock_transfers", label: "Stock Transfers (STN)" },
  { id: "hiring_notes", label: "Hired-In Operations (HDN/HRN)" },
  { id: "warehouse_portal", label: "Warehouse Operations Portal" },
  { id: "delivery_portal", label: "Delivery Operations Portal" },
  { id: "stock_audit", label: "Stock Verification & Audit" },
  { id: "rentals", label: "Rental Agreements & Material Tracking" },
  { id: "billing", label: "Rental Billing Engine" },
  { id: "accounting", label: "General Ledger & Accounting" },
  { id: "fleet", label: "Company Fleet" },
  { id: "labour", label: "Labour & Attendance" },
  { id: "material_maintenance", label: "Centering Material Maintenance & Repair" },
  { id: "direct_transfers", label: "Direct Site-to-Site Material Transfers" },
  { id: "reports", label: "Business Analytics & Reports" },
  { id: "cutover", label: "Production Cutover & Opening Balances" },
  { id: "pilot", label: "Pilot Operations" },
  { id: "training", label: "Staff Training & Onboarding" },
] as const;

export type ModuleType = (typeof MODULES)[number]["id"];

export const ACTIONS = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "approve", label: "Approve" },
  { id: "post", label: "Post" },
  { id: "cancel", label: "Cancel" },
  { id: "export", label: "Export" },
  { id: "delete", label: "Delete" },
] as const;

export type ActionType = (typeof ACTIONS)[number]["id"];

// Default baseline permissions
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  OWNER: {
    dashboard: ["view", "export"],
    company: ["view", "create", "edit", "export"],
    branches: ["view", "create", "edit", "export", "delete"],
    warehouses: ["view", "create", "edit", "export", "delete"],
    users: ["view", "create", "edit", "approve", "delete", "export"],
    roles: ["view", "edit"],
    document_settings: ["view", "create", "edit"],
    audit_logs: ["view", "export"],
    customers: ["view", "create", "edit", "approve", "export"],
    suppliers: ["view", "create", "edit", "approve", "export"],
    inventory: ["view", "create", "edit", "approve", "export"],
    movement: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    stock_audit: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    rentals: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    billing: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    accounting: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    fleet: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    labour: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    material_maintenance: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    direct_transfers: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    reports: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    cutover: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    pilot: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    training: ["view", "create", "edit", "approve", "post", "cancel", "export"],
  },
  ADMINISTRATOR: {
    dashboard: ["view", "export"],
    company: ["view", "edit"],
    branches: ["view", "create", "edit", "export"],
    warehouses: ["view", "create", "edit", "export"],
    users: ["view", "create", "edit", "export"],
    roles: ["view"],
    document_settings: ["view", "create", "edit"],
    audit_logs: ["view", "export"],
    customers: ["view", "create", "edit", "export"],
    suppliers: ["view", "create", "edit", "export"],
    inventory: ["view", "create", "edit", "export"],
    movement: ["view", "create", "edit", "cancel", "export"],
    purchases: ["view", "create", "edit", "approve", "cancel", "export"],
    delivery_notes: ["view", "create", "edit", "approve", "cancel", "export"],
    material_returns: ["view", "create", "edit", "approve", "cancel", "export"],
    stock_transfers: ["view", "create", "edit", "approve", "cancel", "export"],
    hiring_notes: ["view", "create", "edit", "approve", "cancel", "export"],
    warehouse_portal: ["view", "export"],
    delivery_portal: ["view", "export"],
    stock_audit: ["view", "create", "edit", "export"],
    rentals: ["view", "create", "edit", "approve", "export"],
    billing: ["view", "create", "export"],
    accounting: ["view", "export"],
    fleet: ["view", "create", "edit", "approve", "export"],
    labour: ["view", "create", "edit", "approve", "export"],
    material_maintenance: ["view", "create", "edit", "approve", "export"],
    reports: ["view", "export"],
    cutover: ["view", "create", "edit", "export"],
    pilot: ["view", "create", "edit", "approve", "export"],
    training: ["view", "create", "edit", "approve", "export"],
  },
  ADMIN: {
    dashboard: ["view", "export"],
    company: ["view", "edit"],
    branches: ["view", "create", "edit", "export"],
    warehouses: ["view", "create", "edit", "export"],
    users: ["view", "create", "edit", "export"],
    roles: ["view"],
    document_settings: ["view", "create", "edit"],
    audit_logs: ["view", "export"],
    customers: ["view", "create", "edit", "export"],
    suppliers: ["view", "create", "edit", "export"],
    inventory: ["view", "create", "edit", "export"],
    movement: ["view", "create", "edit", "cancel", "export"],
    purchases: ["view", "create", "edit", "approve", "cancel", "export"],
    delivery_notes: ["view", "create", "edit", "approve", "cancel", "export"],
    material_returns: ["view", "create", "edit", "approve", "cancel", "export"],
    stock_transfers: ["view", "create", "edit", "approve", "cancel", "export"],
    hiring_notes: ["view", "create", "edit", "approve", "cancel", "export"],
    warehouse_portal: ["view", "export"],
    delivery_portal: ["view", "export"],
    stock_audit: ["view", "create", "edit", "export"],
    rentals: ["view", "create", "edit", "approve", "export"],
    billing: ["view", "create", "export"],
    accounting: ["view", "export"],
    fleet: ["view", "create", "edit", "approve", "export"],
    labour: ["view", "create", "edit", "approve", "export"],
    material_maintenance: ["view", "create", "edit", "approve", "export"],
    reports: ["view", "export"],
    cutover: ["view", "create", "edit", "export"],
    pilot: ["view", "create", "edit", "approve", "export"],
    training: ["view", "create", "edit", "approve", "export"],
  },
  ACCOUNTANT: {
    dashboard: ["view"],
    company: ["view"],
    branches: ["view"],
    warehouses: ["view"],
    users: [],
    roles: [],
    document_settings: ["view"],
    audit_logs: ["view"],
    customers: ["view", "create", "edit", "export"],
    suppliers: ["view", "create", "edit", "export"],
    inventory: ["view", "export"],
    movement: ["view", "export"],
    purchases: ["view", "create", "edit", "export"],
    delivery_notes: ["view", "export"],
    material_returns: ["view", "export"],
    stock_transfers: ["view", "export"],
    hiring_notes: ["view", "create", "edit", "export"],
    warehouse_portal: ["view"],
    delivery_portal: [],
    stock_audit: ["view", "export"],
    rentals: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    billing: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    accounting: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    fleet: ["view"],
    labour: ["view", "export"],
    reports: ["view", "export"],
    cutover: ["view", "create", "edit", "export"],
    pilot: ["view", "export"],
    training: ["view"],
  },
  WAREHOUSE_MANAGER: {
    dashboard: ["view"],
    company: [],
    branches: ["view"],
    warehouses: ["view", "edit"],
    users: [],
    roles: [],
    document_settings: ["view"],
    audit_logs: [],
    customers: ["view"],
    suppliers: ["view"],
    inventory: ["view", "create", "edit", "approve", "export"],
    movement: ["view", "create", "edit", "approve", "post", "export"],
    purchases: ["view", "create", "edit", "approve", "post", "export"],
    delivery_notes: ["view", "create", "edit", "approve", "post", "export"],
    material_returns: ["view", "create", "edit", "approve", "post", "export"],
    stock_transfers: ["view", "create", "edit", "approve", "post", "export"],
    hiring_notes: ["view", "create", "edit", "approve", "post", "export"],
    warehouse_portal: ["view", "create", "edit", "approve", "post", "export"],
    delivery_portal: ["view"],
    stock_audit: ["view", "create", "edit", "approve", "post", "export"],
    billing: [],
    accounting: [],
    fleet: ["view"],
    labour: ["view", "create", "edit"],
    material_maintenance: ["view", "create", "edit", "approve", "post", "export"],
    reports: ["view", "export"],
    cutover: ["view", "create", "edit"],
    pilot: ["view"],
    training: ["view", "edit"],
  },
  WAREHOUSE_STAFF: {
    dashboard: ["view"],
    company: [],
    branches: [],
    warehouses: ["view"],
    users: [],
    roles: [],
    document_settings: [],
    audit_logs: [],
    customers: ["view"],
    suppliers: ["view"],
    inventory: ["view"],
    movement: ["view", "create", "edit"],
    purchases: ["view", "create", "edit"],
    delivery_notes: ["view", "create", "edit"],
    material_returns: ["view", "create", "edit"],
    stock_transfers: ["view", "create", "edit"],
    hiring_notes: ["view", "create", "edit"],
    warehouse_portal: ["view", "create", "edit"],
    delivery_portal: [],
    stock_audit: ["view", "create", "edit"],
    billing: [],
    accounting: [],
    fleet: [],
    labour: [],
    material_maintenance: ["view", "create", "edit"],
    reports: ["view"],
    training: ["view"],
  },
  DELIVERY_MANAGER: {
    dashboard: ["view"],
    company: [],
    branches: ["view"],
    warehouses: ["view"],
    users: [],
    roles: [],
    document_settings: [],
    audit_logs: [],
    customers: ["view"],
    suppliers: ["view"],
    inventory: ["view"],
    movement: ["view", "create", "edit", "approve"],
    purchases: ["view"],
    delivery_notes: ["view", "create", "edit", "approve", "post", "export"],
    material_returns: ["view", "create", "edit", "approve", "post", "export"],
    stock_transfers: ["view", "create", "edit"],
    hiring_notes: ["view"],
    warehouse_portal: [],
    delivery_portal: ["view", "create", "edit", "approve", "export"],
    stock_audit: [],
    billing: [],
    accounting: [],
    fleet: ["view", "create", "edit", "approve", "export"],
    labour: [],
    material_maintenance: ["view"],
    reports: ["view", "export"],
    pilot: ["view"],
    training: ["view"],
  },
  DELIVERY_PERSONNEL: {
    dashboard: ["view"],
    company: [],
    branches: [],
    warehouses: [],
    users: [],
    roles: [],
    document_settings: [],
    audit_logs: [],
    customers: ["view"],
    suppliers: [],
    inventory: [],
    movement: ["view", "edit"],
    purchases: [],
    delivery_notes: ["view", "edit"],
    material_returns: ["view", "edit"],
    stock_transfers: [],
    hiring_notes: [],
    warehouse_portal: [],
    delivery_portal: ["view", "edit", "post"],
    stock_audit: [],
    billing: [],
    accounting: [],
    fleet: ["view", "create"],
    labour: [],
    material_maintenance: [],
    reports: ["view"],
    training: ["view"],
  },
  LABOUR_SUPERVISOR: {
    dashboard: ["view"],
    company: [],
    branches: [],
    warehouses: [],
    users: [],
    roles: [],
    document_settings: [],
    audit_logs: [],
    customers: ["view"],
    suppliers: [],
    inventory: [],
    movement: [],
    stock_audit: [],
    billing: [],
    accounting: [],
    fleet: [],
    labour: ["view", "create", "edit", "approve", "export"],
    material_maintenance: ["view"],
    reports: ["view"],
    training: ["view"],
  },
  AUDITOR: {
    dashboard: ["view"],
    company: ["view"],
    branches: ["view"],
    warehouses: ["view"],
    users: [],
    roles: [],
    document_settings: ["view"],
    audit_logs: ["view", "export"],
    customers: ["view", "export"],
    suppliers: ["view", "export"],
    inventory: ["view", "export"],
    movement: ["view", "export"],
    purchases: ["view", "export"],
    delivery_notes: ["view", "export"],
    material_returns: ["view", "export"],
    stock_transfers: ["view", "export"],
    hiring_notes: ["view", "export"],
    warehouse_portal: ["view", "export"],
    delivery_portal: ["view", "export"],
    stock_audit: ["view", "export"],
    rentals: ["view", "export"],
    billing: ["view", "export"],
    accounting: ["view", "export"],
    fleet: ["view", "export"],
    labour: ["view", "export"],
    material_maintenance: ["view", "export"],
    reports: ["view", "export"],
    cutover: ["view", "export"],
    pilot: ["view", "export"],
    training: ["view", "export"],
  },
  READ_ONLY: {
    dashboard: ["view"],
    company: ["view"],
    branches: ["view"],
    warehouses: ["view"],
    users: [],
    roles: [],
    document_settings: ["view"],
    audit_logs: ["view"],
    customers: ["view"],
    suppliers: ["view"],
    inventory: ["view"],
    movement: ["view"],
    purchases: ["view"],
    delivery_notes: ["view"],
    material_returns: ["view"],
    stock_transfers: ["view"],
    hiring_notes: ["view"],
    warehouse_portal: ["view"],
    delivery_portal: ["view"],
    stock_audit: ["view"],
    rentals: ["view"],
    billing: ["view"],
    accounting: ["view"],
    fleet: ["view"],
    labour: ["view"],
    material_maintenance: ["view"],
    reports: ["view"],
    cutover: ["view", "export"],
    pilot: ["view", "export"],
    training: ["view", "export"],
  },
};

export async function initializeDefaultPermissions(): Promise<void> {
  const count = await db.rolePermission.count();
  if (count > 0) return;

  const records: Array<{ role: string; module: string; action: string; isAllowed: boolean }> = [];

  for (const roleObj of ROLES) {
    const roleId = roleObj.id;
    const roleMap = DEFAULT_ROLE_PERMISSIONS[roleId] || {};

    for (const mod of MODULES) {
      const allowedActions = roleMap[mod.id] || [];

      for (const act of ACTIONS) {
        records.push({
          role: roleId,
          module: mod.id,
          action: act.id,
          isAllowed: allowedActions.includes(act.id),
        });
      }
    }
  }

  // Batch insert
  for (const r of records) {
    await db.rolePermission.upsert({
      where: {
        role_module_action: {
          role: r.role,
          module: r.module,
          action: r.action,
        },
      },
      update: { isAllowed: r.isAllowed },
      create: r,
    });
  }
}

export async function checkPermission(
  role: string,
  module: ModuleType | string,
  action: ActionType | string
): Promise<boolean> {
  if (role === "OWNER") return true; // Owner has universal bypass

  const perm = await db.rolePermission.findUnique({
    where: {
      role_module_action: {
        role,
        module,
        action,
      },
    },
  });

  if (perm) return !!perm.isAllowed;

  // Check alias if role is configured under alternative identifier
  const aliasMap: Record<string, string> = {
    ADMINISTRATOR: "ADMIN",
    ADMIN: "ADMINISTRATOR",
    AUDITOR: "READ_ONLY",
    READ_ONLY: "AUDITOR",
  };

  const alias = aliasMap[role];
  if (alias) {
    const aliasPerm = await db.rolePermission.findUnique({
      where: {
        role_module_action: {
          role: alias,
          module,
          action,
        },
      },
    });
    if (aliasPerm) return !!aliasPerm.isAllowed;
  }

  // Fallback to static defaults if not yet initialized in DB
  const defaultRoleMap = DEFAULT_ROLE_PERMISSIONS[role] || (alias ? DEFAULT_ROLE_PERMISSIONS[alias] : undefined);
  if (defaultRoleMap && defaultRoleMap[module]) {
    return defaultRoleMap[module].includes(action);
  }

  return false;
}

export async function requirePermission(
  user: SessionUser | null,
  module: ModuleType | string,
  action: ActionType | string
): Promise<void> {
  if (!user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  const allowed = await checkPermission(user.role, module, action);
  if (!allowed) {
    throw new Error(`FORBIDDEN: Role ${user.role} is not permitted to perform '${action}' on '${module}'`);
  }
}

