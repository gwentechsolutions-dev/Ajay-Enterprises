import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

export interface RoleTrainingCurriculum {
  role: string;
  roleTitle: string;
  description: string;
  coreResponsibilities: string[];
  workflowModules: Array<{
    moduleCode: string;
    title: string;
    description: string;
    steps: string[];
    isCompleted: boolean;
  }>;
}

export const ROLE_CURRICULA: Record<string, { roleTitle: string; description: string; coreResponsibilities: string[]; modules: Array<{ code: string; title: string; desc: string; steps: string[] }> }> = {
  ADMINISTRATOR: {
    roleTitle: "System Administrator",
    description: "Operational management of branches, users, document series, and security parameters.",
    coreResponsibilities: [
      "Manage staff user accounts and role assignments",
      "Monitor document numbering sequences and branch structures",
      "Oversee master rate catalogues and rate history",
      "Review system audit logs and security events",
    ],
    modules: [
      {
        code: "TRN_ADM_01",
        title: "User Management & Role Permissions",
        desc: "Provisioning staff users and configuring granular scope boundaries.",
        steps: [
          "Navigate to Settings -> Users",
          "Create user with official mobile, email, and designated role",
          "Set data scope: ALL_BUSINESS, ASSIGNED_WAREHOUSE, or ASSIGNED_SITE",
          "Verify user login and initial password change flow",
        ],
      },
      {
        code: "TRN_ADM_02",
        title: "Document Series & Document Immutability",
        desc: "Monitoring financial year prefixes and sequence counters.",
        steps: [
          "Navigate to Settings -> Document Series",
          "Inspect current fiscal year sequences for DN, MRN, INV, JRN",
          "Verify document immutability rule: finalized records cannot be deleted",
        ],
      },
    ],
  },
  ACCOUNTANT: {
    roleTitle: "Senior Accountant",
    description: "Financial management, rental billing, customer ledger, GST compliance, and supplier disbursements.",
    coreResponsibilities: [
      "Process monthly consolidated rental billing from daily batch movement ledger",
      "Issue GST tax invoices and record customer receipts",
      "Manage supplier bills, payments, and 2-way matching",
      "Prepare monthly GSTR-1 and GSTR-3B statutory summaries",
    ],
    modules: [
      {
        code: "TRN_ACC_01",
        title: "Rental Billing Engine & Monthly Statements",
        desc: "Generating accurate monthly customer rental statements based on active custody batches.",
        steps: [
          "Navigate to Billing -> Generate Statements",
          "Select customer, site, and billing period (1st to end of month)",
          "Review daily material batch calculations and date-inclusion flags",
          "Finalize statement and generate tax invoice",
        ],
      },
      {
        code: "TRN_ACC_02",
        title: "Invoicing, GST & Payment Receipts",
        desc: "Issuing GST-compliant invoices and posting payment receipts with double-entry allocation.",
        steps: [
          "Navigate to Accounting -> Invoices",
          "Review CGST/SGST/IGST breakdown and HSN/SAC classifications",
          "Post Payment Receipt against open invoices, customer advances, or security deposits",
          "Verify automatic General Ledger double-entry posting",
        ],
      },
      {
        code: "TRN_ACC_03",
        title: "GSTR-1, GSTR-3B & Financial Statements",
        desc: "Verifying statutory GST reports, Trial Balance, and Profit & Loss statement.",
        steps: [
          "Navigate to Reports -> GST Returns",
          "Export GSTR-1 B2B/B2C schedule and GSTR-3B tax summary",
          "Run Trial Balance and verify 0.00 difference between debits and credits",
        ],
      },
    ],
  },
  WAREHOUSE_MANAGER: {
    roleTitle: "Warehouse Manager",
    description: "Yard oversight, material receipts, dispatch staging, return inspection, and stock verification.",
    coreResponsibilities: [
      "Receive supplier material purchases and generate Goods Receipt Notes (GRN)",
      "Stage dispatches for Delivery Notes and verify count accuracy",
      "Inspect returned materials from MRNs and classify Good vs Damaged vs Scrap",
      "Conduct periodic physical stock verification audits",
    ],
    modules: [
      {
        code: "TRN_WHM_01",
        title: "PO Receiving & Goods Receipt Notes (GRN)",
        desc: "Receiving supplier shipments into warehouse inventory.",
        steps: [
          "Navigate to Purchases -> Purchase Orders",
          "Create GRN against approved PO",
          "Verify received quantities against PO order quantities",
          "Post GRN to atomically increment warehouse StockBalance",
        ],
      },
      {
        code: "TRN_WHM_02",
        title: "Dispatch Picking & Loading Verification",
        desc: "Preparing centering materials for customer site delivery.",
        steps: [
          "Navigate to Warehouse -> Dispatch Staging",
          "Select open Delivery Note and stage material items",
          "Perform count check on props, spans, and plates",
          "Assign trip to company-owned vehicle and driver",
        ],
      },
      {
        code: "TRN_WHM_03",
        title: "Return Sorting, Damage Assessment & Repair Routing",
        desc: "Processing Material Return Notes and routing damaged units for repair.",
        steps: [
          "Inspect returning vehicle cargo against driver MRN draft",
          "Segregate sound materials from bent, twisted, or unserviceable items",
          "Create Damage Assessment and route damaged items to Material Repair Job",
        ],
      },
    ],
  },
  WAREHOUSE_STAFF: {
    roleTitle: "Warehouse Staff / Yard Crew",
    description: "Physical material handling, staging, bundle counting, and repair support.",
    coreResponsibilities: [
      "Physical loading and unloading of trucks",
      "Bundle and count props and plates accurately",
      "Tag and separate damaged items",
      "Keep storage stacks safe and orderly",
    ],
    modules: [
      {
        code: "TRN_WHS_01",
        title: "Material Handling & Count Verification",
        desc: "Standards for physical counting and staging.",
        steps: [
          "Count props in bundles of 50 or 100",
          "Verify pin locks, base plates, and thread nuts are intact",
          "Confirm counts with Warehouse Manager before loading truck",
        ],
      },
    ],
  },
  DELIVERY_MANAGER: {
    roleTitle: "Delivery / Fleet Manager",
    description: "Fleet trip scheduling, company-owned vehicle operations, driver management, and route planning.",
    coreResponsibilities: [
      "Assign delivery and return trips to company-owned vehicles",
      "Monitor driver assignments and trip start/end times",
      "Log vehicle fuel consumption and odometer readings",
      "Schedule routine maintenance and fitness inspections",
    ],
    modules: [
      {
        code: "TRN_DLM_01",
        title: "Fleet Trips & Vehicle Assignments",
        desc: "Dispatching company vehicles (407, Bolero, Dost) on site deliveries.",
        steps: [
          "Navigate to Fleet -> Vehicle Trips",
          "Create trip, select company-owned vehicle and assigned driver",
          "Link Delivery Notes and Material Return Notes to trip",
          "Dispatch vehicle and record starting odometer reading",
        ],
      },
      {
        code: "TRN_DLM_02",
        title: "Fuel Logs & Maintenance Tracking",
        desc: "Recording fuel purchases and tracking maintenance expenses.",
        steps: [
          "Navigate to Fleet -> Fuel Logs",
          "Enter fuel quantity, rate, total amount, and fuel slip photo",
          "Review vehicle mileage and schedule servicing when due",
        ],
      },
    ],
  },
  DELIVERY_PERSONNEL: {
    roleTitle: "Delivery Driver / Field Personnel",
    description: "On-site delivery execution, GPS photo proof capture, and customer receiver sign-off.",
    coreResponsibilities: [
      "Safely transport centering materials to construction site",
      "Capture clear GPS camera photos of materials unloaded at site",
      "Obtain receiver name, phone, designation, and physical signature",
      "Complete Delivery Note on mobile PWA even in low-network conditions",
    ],
    modules: [
      {
        code: "TRN_DLP_01",
        title: "Mobile PWA Site Delivery & Proof Capture",
        desc: "Executing delivery workflows on smartphone PWA.",
        steps: [
          "Open INVENTRA Mobile PWA and view Assigned Deliveries",
          "Arrive at customer site and unload materials safely",
          "Tap 'Capture GPS Photo' to embed location coordinates and timestamp",
          "Hand phone to site engineer/contractor to enter name and draw signature",
          "Submit delivery acknowledgement; syncs automatically once online",
        ],
      },
    ],
  },
  LABOUR_SUPERVISOR: {
    roleTitle: "Labour Supervisor",
    description: "Worker muster, daily attendance recording, advances, and wage settlements.",
    coreResponsibilities: [
      "Mark daily worker attendance (Present, Absent, Half-Day)",
      "Record cash advances given to labour crew",
      "Calculate weekly/monthly wage settlements and overtime",
      "Allocate workers to yard loading, repair, or site jobs",
    ],
    modules: [
      {
        code: "TRN_LAB_01",
        title: "Daily Labour Attendance & Overtime",
        desc: "Maintaining accurate daily muster rolls for loaders, welders, and yard workers.",
        steps: [
          "Navigate to Labour -> Attendance",
          "Select date and mark status: PRESENT, ABSENT, HALF_DAY",
          "Enter overtime hours if applicable",
          "Submit daily muster for supervisor approval",
        ],
      },
      {
        code: "TRN_LAB_02",
        title: "Labour Advances & Wage Settlements",
        desc: "Recording cash advances and settling wages at end of cycle.",
        steps: [
          "Navigate to Labour -> Advances to record petty cash advance",
          "Navigate to Labour -> Wage Settlements at end of month",
          "Review gross earnings, advance deductions, and net payable",
          "Approve wage settlement for accountant disbursement",
        ],
      },
    ],
  },
  AUDITOR: {
    roleTitle: "Statutory & Internal Auditor",
    description: "Independent ledger inspection, balance sheet verification, and compliance verification.",
    coreResponsibilities: [
      "Inspect General Ledger journal entries and supporting documents",
      "Verify double-entry equality across all financial periods",
      "Audit physical stock vs book stock reconciliation",
      "Review AuditEvent security log for unauthorized actions or reversals",
    ],
    modules: [
      {
        code: "TRN_AUD_01",
        title: "Audit Trail & General Ledger Inspection",
        desc: "Verifying financial immutability and statutory records.",
        steps: [
          "Navigate to Reports -> Trial Balance and Balance Sheet",
          "Verify SUM(Debits) == SUM(Credits) across all periods",
          "Navigate to Audit Logs to inspect actor, timestamp, IP, and event payloads",
          "Confirm that no posted documents or journals were edited in-place",
        ],
      },
    ],
  },
};

/**
 * Retrieves the operational training curriculum for a specific role or all roles.
 */
export async function getRoleTrainingCurriculum(role?: string): Promise<RoleTrainingCurriculum[]> {
  const targetRoles = role ? [role.toUpperCase()] : Object.keys(ROLE_CURRICULA);
  const results: RoleTrainingCurriculum[] = [];

  // Fetch completed modules from database
  const dbModules = await db.staffTrainingModule.findMany();
  const completedMap = new Map<string, boolean>();
  for (const m of dbModules) {
    completedMap.set(m.moduleCode, m.isCompleted);
  }

  for (const r of targetRoles) {
    const config = ROLE_CURRICULA[r];
    if (!config) continue;

    results.push({
      role: r,
      roleTitle: config.roleTitle,
      description: config.description,
      coreResponsibilities: config.coreResponsibilities,
      workflowModules: config.modules.map((m) => ({
        moduleCode: m.code,
        title: m.title,
        description: m.desc,
        steps: m.steps,
        isCompleted: completedMap.get(m.code) ?? false,
      })),
    });
  }

  return results;
}

/**
 * Marks a training module as completed by an authorized staff member or supervisor.
 */
export async function markTrainingModuleCompleted(
  moduleCode: string,
  role: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const curriculum = ROLE_CURRICULA[role.toUpperCase()];
  const modConfig = curriculum?.modules.find((m) => m.code === moduleCode);

  if (!modConfig) {
    throw new Error(`Training module '${moduleCode}' not found for role '${role}'.`);
  }

  const record = await db.staffTrainingModule.upsert({
    where: { moduleCode },
    create: {
      role: role.toUpperCase(),
      moduleCode,
      title: modConfig.title,
      description: modConfig.desc,
      workflowChecklist: JSON.stringify(modConfig.steps),
      isCompleted: true,
      completedAt: new Date(),
      verifiedById: actor.id,
    },
    update: {
      isCompleted: true,
      completedAt: new Date(),
      verifiedById: actor.id,
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "APPROVE",
    module: "training",
    entityType: "StaffTrainingModule",
    entityId: record.id,
    notes: `Marked training module ${moduleCode} (${modConfig.title}) completed for role ${role}`,
  });

  return record;
}
