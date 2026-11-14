import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";

export interface CreatePilotProgramInput {
  name: string;
  description?: string;
  startDate?: Date | string;
  targetEndDate: Date | string;
  selectedWarehouses: string[];
  selectedCustomers: string[];
  selectedSites: string[];
}

export interface PilotMetricsSummary {
  pilotNumber: string;
  name: string;
  status: string;
  startDate: string;
  targetEndDate: string;
  actualEndDate: string | null;
  operationsTracked: {
    deliveryNotesCount: number;
    returnNotesCount: number;
    directSiteTransfersCount: number;
    rentalStatementsCount: number;
    invoicesCount: number;
    paymentReceiptsCount: number;
    supplierBillsCount: number;
    repairJobsCount: number;
    tripsCount: number;
  };
  totalBilledAmount: string;
  totalCollectedAmount: string;
  exceptionsCount: number;
  exceptions: Array<{
    id: string;
    timestamp: string;
    category: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
    loggedBy: string;
    resolutionNotes?: string;
    isResolved: boolean;
  }>;
}

/**
 * Creates a Pilot Program definition in DRAFT state.
 */
export async function createPilotProgram(
  input: CreatePilotProgramInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(actor.role)) {
    throw new Error(`Unauthorized: Only Owner or Administrator can define pilot programs.`);
  }

  const pilotNumber = await generateNextDocumentNumber("PILOT");

  const pilot = await db.pilotProgram.create({
    data: {
      pilotNumber,
      name: input.name,
      description: input.description || null,
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      targetEndDate: new Date(input.targetEndDate),
      status: "DRAFT",
      selectedWarehouses: JSON.stringify(input.selectedWarehouses || []),
      selectedCustomers: JSON.stringify(input.selectedCustomers || []),
      selectedSites: JSON.stringify(input.selectedSites || []),
      metrics: JSON.stringify({}),
      exceptionsLog: JSON.stringify([]),
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "pilot",
    entityType: "PilotProgram",
    entityId: pilot.id,
    notes: `Created pilot program ${pilotNumber}: ${input.name}`,
  });

  return pilot;
}

/**
 * Activates a Pilot Program (Requires OWNER approval).
 */
export async function activatePilotProgram(
  pilotId: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (actor.role !== "OWNER") {
    throw new Error(`CRITICAL: Activating a live pilot operation requires Owner authorization.`);
  }

  const pilot = await db.pilotProgram.findUnique({ where: { id: pilotId } });
  if (!pilot) throw new Error(`Pilot program '${pilotId}' not found.`);

  const updated = await db.pilotProgram.update({
    where: { id: pilotId },
    data: {
      status: "ACTIVE",
      approvedById: actor.id,
      approvedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "APPROVE",
    module: "pilot",
    entityType: "PilotProgram",
    entityId: pilot.id,
    notes: `Owner activated pilot program ${pilot.pilotNumber}`,
  });

  return updated;
}

/**
 * Logs an operational exception during pilot execution.
 */
export async function logPilotException(
  pilotId: string,
  exception: {
    category: "DISPATCH" | "RETURN" | "DIRECT_TRANSFER" | "BILLING" | "FLEET" | "LABOUR" | "DAMAGE";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
    resolutionNotes?: string;
  },
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const pilot = await db.pilotProgram.findUnique({ where: { id: pilotId } });
  if (!pilot) throw new Error(`Pilot program '${pilotId}' not found.`);

  let exceptions: any[] = [];
  try {
    exceptions = pilot.exceptionsLog ? JSON.parse(pilot.exceptionsLog) : [];
  } catch {
    exceptions = [];
  }

  const newException = {
    id: `EXC-${Date.now()}`,
    timestamp: new Date().toISOString(),
    category: exception.category,
    severity: exception.severity,
    description: exception.description,
    loggedBy: actor.name,
    resolutionNotes: exception.resolutionNotes || null,
    isResolved: Boolean(exception.resolutionNotes),
  };

  exceptions.push(newException);

  const updated = await db.pilotProgram.update({
    where: { id: pilotId },
    data: {
      exceptionsLog: JSON.stringify(exceptions),
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "pilot",
    entityType: "PilotProgram",
    entityId: pilot.id,
    notes: `Logged pilot exception (${exception.category} / ${exception.severity}): ${exception.description}`,
  });

  return newException;
}

/**
 * Aggregates real operational metrics within the pilot scope and date range.
 */
export async function getPilotMetricsSummary(pilotId: string): Promise<PilotMetricsSummary> {
  const pilot = await db.pilotProgram.findUnique({ where: { id: pilotId } });
  if (!pilot) throw new Error(`Pilot program '${pilotId}' not found.`);

  let customerIds: string[] = [];
  let siteIds: string[] = [];
  let warehouseIds: string[] = [];

  try {
    customerIds = pilot.selectedCustomers ? JSON.parse(pilot.selectedCustomers) : [];
    siteIds = pilot.selectedSites ? JSON.parse(pilot.selectedSites) : [];
    warehouseIds = pilot.selectedWarehouses ? JSON.parse(pilot.selectedWarehouses) : [];
  } catch {
    // fallback empty
  }

  const startDate = pilot.startDate;
  const endDate = pilot.actualEndDate || new Date();

  // 1. Delivery Notes
  const dnWhere: Prisma.DeliveryNoteWhereInput = {
    deliveryDate: { gte: startDate, lte: endDate },
  };
  if (customerIds.length > 0) dnWhere.customerId = { in: customerIds };
  if (siteIds.length > 0) dnWhere.customerSiteId = { in: siteIds };
  const dnCount = await db.deliveryNote.count({ where: dnWhere });

  // 2. Material Return Notes
  const mrnWhere: Prisma.MaterialReturnNoteWhereInput = {
    returnDate: { gte: startDate, lte: endDate },
  };
  if (customerIds.length > 0) mrnWhere.customerId = { in: customerIds };
  if (siteIds.length > 0) mrnWhere.customerSiteId = { in: siteIds };
  const mrnCount = await db.materialReturnNote.count({ where: mrnWhere });

  // 3. Direct Site Transfers
  const dstWhere: Prisma.DirectSiteTransferNoteWhereInput = {
    transferDate: { gte: startDate, lte: endDate },
  };
  if (customerIds.length > 0) {
    dstWhere.OR = [
      { sourceCustomerId: { in: customerIds } },
      { destinationCustomerId: { in: customerIds } },
    ];
  }
  const dstCount = await db.directSiteTransferNote.count({ where: dstWhere });

  // 4. Invoices & Billing
  const invWhere: Prisma.InvoiceWhereInput = {
    invoiceDate: { gte: startDate, lte: endDate },
  };
  if (customerIds.length > 0) invWhere.customerId = { in: customerIds };
  const invoices = await db.invoice.findMany({
    where: invWhere,
    select: { grandTotal: true, paidAmount: true },
  });

  let totalBilled = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  for (const inv of invoices) {
    totalBilled = totalBilled.plus(inv.grandTotal);
    totalPaid = totalPaid.plus(inv.paidAmount);
  }

  // 5. Payment Receipts
  const recWhere: Prisma.PaymentReceiptWhereInput = {
    paymentDate: { gte: startDate, lte: endDate },
  };
  if (customerIds.length > 0) recWhere.customerId = { in: customerIds };
  const recCount = await db.paymentReceipt.count({ where: recWhere });

  // 6. Maintenance & Fleet Trips
  const tripCount = await db.vehicleTrip.count({
    where: { departureTime: { gte: startDate, lte: endDate } },
  });
  const repairCount = await db.materialRepairJob.count({
    where: { createdAt: { gte: startDate, lte: endDate } },
  });

  let exceptions: any[] = [];
  try {
    exceptions = pilot.exceptionsLog ? JSON.parse(pilot.exceptionsLog) : [];
  } catch {
    exceptions = [];
  }

  return {
    pilotNumber: pilot.pilotNumber,
    name: pilot.name,
    status: pilot.status,
    startDate: pilot.startDate.toISOString(),
    targetEndDate: pilot.targetEndDate.toISOString(),
    actualEndDate: pilot.actualEndDate ? pilot.actualEndDate.toISOString() : null,
    operationsTracked: {
      deliveryNotesCount: dnCount,
      returnNotesCount: mrnCount,
      directSiteTransfersCount: dstCount,
      rentalStatementsCount: 0,
      invoicesCount: invoices.length,
      paymentReceiptsCount: recCount,
      supplierBillsCount: 0,
      repairJobsCount: repairCount,
      tripsCount: tripCount,
    },
    totalBilledAmount: totalBilled.toFixed(2),
    totalCollectedAmount: totalPaid.toFixed(2),
    exceptionsCount: exceptions.length,
    exceptions,
  };
}

/**
 * Concludes a Pilot Program with an Owner review sign-off.
 */
export async function completePilotProgram(
  pilotId: string,
  completionReview: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (actor.role !== "OWNER") {
    throw new Error(`CRITICAL: Concluding and signing off on pilot operations requires Owner authorization.`);
  }

  const pilot = await db.pilotProgram.findUnique({ where: { id: pilotId } });
  if (!pilot) throw new Error(`Pilot program '${pilotId}' not found.`);

  const updated = await db.pilotProgram.update({
    where: { id: pilotId },
    data: {
      status: "COMPLETED",
      actualEndDate: new Date(),
      completionReview,
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "APPROVE",
    module: "pilot",
    entityType: "PilotProgram",
    entityId: pilot.id,
    notes: `Owner completed pilot program ${pilot.pilotNumber}. Review: ${completionReview}`,
  });

  return updated;
}
