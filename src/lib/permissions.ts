import { db } from "./db";
import { SessionUser } from "./auth";

export const ROLES = [
  { id: "OWNER", label: "Owner / Super Admin", description: "Full business control, executive overview, financial and audit authority" },
  { id: "ADMIN", label: "Administrator", description: "Operational and administrative system management" },
  { id: "ACCOUNTANT", label: "Accountant", description: "Invoicing, monthly billing, ledgers, vouchers, tax & GST compliance" },
  { id: "WAREHOUSE_MANAGER", label: "Warehouse Manager", description: "Stock oversight, receipts, dispatch staging, and inventory counts" },
  { id: "WAREHOUSE_STAFF", label: "Warehouse Staff", description: "Physical picking, loading confirmation, and return inspection" },
  { id: "DELIVERY_MANAGER", label: "Delivery Manager", description: "Fleet dispatch scheduling, vehicle assignments, and route tracking" },
  { id: "DELIVERY_PERSONNEL", label: "Delivery Personnel", description: "Mobile delivery execution, GPS site photo capture, and receiver sign-off" },
  { id: "LABOUR_SUPERVISOR", label: "Labour Supervisor", description: "Worker attendance, site allocation, and overtime management" },
  { id: "READ_ONLY", label: "Read-Only / Auditor", description: "Read-only reporting, ledger inspection, and audit exports" },
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
  { id: "inventory", label: "Inventory Master" },
  { id: "movement", label: "Material Movements (DN/MRN/STN)" },
  { id: "billing", label: "Rental Billing Engine" },
  { id: "accounting", label: "General Ledger & Accounting" },
  { id: "fleet", label: "Company Fleet" },
  { id: "labour", label: "Labour & Attendance" },
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
    inventory: ["view", "create", "edit", "approve", "export"],
    movement: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    billing: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    accounting: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    fleet: ["view", "create", "edit", "export"],
    labour: ["view", "create", "edit", "approve", "export"],
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
    inventory: ["view", "create", "edit", "export"],
    movement: ["view", "create", "edit", "cancel", "export"],
    billing: ["view", "create", "export"],
    accounting: ["view", "export"],
    fleet: ["view", "create", "edit", "export"],
    labour: ["view", "create", "edit", "export"],
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
    inventory: ["view", "export"],
    movement: ["view", "export"],
    billing: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    accounting: ["view", "create", "edit", "approve", "post", "cancel", "export"],
    fleet: ["view"],
    labour: ["view", "export"],
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
    inventory: ["view", "create", "edit", "approve", "export"],
    movement: ["view", "create", "edit", "approve", "post", "export"],
    billing: [],
    accounting: [],
    fleet: ["view"],
    labour: ["view", "create", "edit"],
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
    inventory: ["view"],
    movement: ["view", "create", "edit"],
    billing: [],
    accounting: [],
    fleet: [],
    labour: [],
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
    inventory: ["view"],
    movement: ["view", "create", "edit", "approve"],
    billing: [],
    accounting: [],
    fleet: ["view", "create", "edit"],
    labour: [],
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
    inventory: [],
    movement: ["view", "edit"],
    billing: [],
    accounting: [],
    fleet: ["view"],
    labour: [],
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
    inventory: [],
    movement: [],
    billing: [],
    accounting: [],
    fleet: [],
    labour: ["view", "create", "edit", "approve"],
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
    customers: ["view", "export"],
    inventory: ["view", "export"],
    movement: ["view", "export"],
    billing: ["view", "export"],
    accounting: ["view", "export"],
    fleet: ["view"],
    labour: ["view"],
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

  return !!perm?.isAllowed;
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

