import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { CreateSiteClosureInput } from "@/lib/schemas/rental";

export interface SiteClosureCheckResult {
  customerSiteId: string;
  siteName: string;
  siteCode: string;
  customerId: string;
  customerName: string;
  hasOutstandingStock: boolean;
  totalOutstandingQty: Prisma.Decimal;
  unreturnedMaterials: Array<{
    materialVariantId: string;
    materialName: string;
    materialCode: string;
    uom: string;
    heldQty: string;
  }>;
  depositBalance: Prisma.Decimal;
  damageChargesTotal: Prisma.Decimal;
  missingChargesTotal: Prisma.Decimal;
  pendingStatementsCount: number;
  canCloseWithoutException: boolean;
}

/**
 * Performs a comprehensive pre-closure audit of a customer site.
 * Identifies unreturned materials, damage/missing claims, deposits, and unfinalized statements.
 */
export async function checkSiteClosureEligibility(
  customerSiteId: string
): Promise<SiteClosureCheckResult> {
  const site = await db.customerSite.findUnique({
    where: { id: customerSiteId },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  if (!site) {
    throw new Error(`Customer Site '${customerSiteId}' not found.`);
  }

  // 1. Query active batches with held quantity
  const activeBatches = await db.rentalBatch.findMany({
    where: {
      customerSiteId,
      currentHeldQty: { gt: 0 },
    },
    include: {
      materialVariant: {
        select: { id: true, name: true, materialCode: true, uom: true },
      },
    },
  });

  const materialMap = new Map<string, { id: string; name: string; code: string; uom: string; qty: Prisma.Decimal }>();
  let totalOutstanding = new Prisma.Decimal(0);

  for (const b of activeBatches) {
    totalOutstanding = totalOutstanding.plus(b.currentHeldQty);
    const existing = materialMap.get(b.materialVariantId) || {
      id: b.materialVariantId,
      name: b.materialVariant.name,
      code: b.materialVariant.materialCode,
      uom: b.materialVariant.uom,
      qty: new Prisma.Decimal(0),
    };
    existing.qty = existing.qty.plus(b.currentHeldQty);
    materialMap.set(b.materialVariantId, existing);
  }

  // 2. Deposit Balance
  const deposits = await db.rentalDepositTransaction.findMany({
    where: { customerSiteId },
  });

  let depositBalance = new Prisma.Decimal(0);
  for (const dep of deposits) {
    if (dep.transactionType === "DEPOSIT_RECEIVED") {
      depositBalance = depositBalance.plus(dep.amount);
    } else if (dep.transactionType === "DEPOSIT_REFUND") {
      depositBalance = depositBalance.minus(dep.amount);
    }
  }

  // 3. Damage & Missing Claims
  const assessments = await db.damageLossAssessment.findMany({
    where: { customerSiteId, status: "APPROVED" },
  });

  let damageCharges = new Prisma.Decimal(0);
  let missingCharges = new Prisma.Decimal(0);
  for (const a of assessments) {
    if (a.assessmentType === "MISSING") {
      missingCharges = missingCharges.plus(a.approvedChargeAmount);
    } else {
      damageCharges = damageCharges.plus(a.approvedChargeAmount);
    }
  }

  // 4. Pending unfinalized statements
  const pendingStatements = await db.rentalStatement.count({
    where: {
      customerSiteId,
      status: { in: ["DRAFT", "CALCULATED", "REVIEWED"] },
    },
  });

  const unreturnedList = Array.from(materialMap.values()).map((m) => ({
    materialVariantId: m.id,
    materialName: m.name,
    materialCode: m.code,
    uom: m.uom,
    heldQty: m.qty.toString(),
  }));

  const hasOutstanding = totalOutstanding.gt(0);

  return {
    customerSiteId,
    siteName: site.siteName,
    siteCode: site.siteCode,
    customerId: site.customerId,
    customerName: site.customer.name,
    hasOutstandingStock: hasOutstanding,
    totalOutstandingQty: totalOutstanding,
    unreturnedMaterials: unreturnedList,
    depositBalance,
    damageChargesTotal: damageCharges,
    missingChargesTotal: missingCharges,
    pendingStatementsCount: pendingStatements,
    canCloseWithoutException: !hasOutstanding,
  };
}

/**
 * Executes site closure and generates the final settlement document.
 * Requires explicit owner exception if material remains outstanding.
 */
export async function executeSiteClosureSettlement(
  input: CreateSiteClosureInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const audit = await checkSiteClosureEligibility(input.customerSiteId);

  if (audit.hasOutstandingStock && !input.ownerApprovedException) {
    throw new Error(
      `Cannot close site with ${audit.totalOutstandingQty.toString()} units of material outstanding. An authorized Owner exception approval is required.`
    );
  }

  if (input.ownerApprovedException && actor.role !== "OWNER") {
    throw new Error("Only an active OWNER can approve an exception to close a site with outstanding equipment.");
  }

  const settlementNumber = await generateNextDocumentNumber("SET");

  return await db.$transaction(async (tx) => {
    // 1. Create settlement record
    const settlement = await tx.siteClosureSettlement.create({
      data: {
        settlementNumber,
        customerId: audit.customerId,
        customerSiteId: audit.customerSiteId,
        closureDate: input.closureDate ? new Date(input.closureDate) : new Date(),
        status: "COMPLETED",
        outstandingHeldQty: audit.totalOutstandingQty,
        unreturnedMaterialDetails: audit.unreturnedMaterials as any,
        damageChargesTotal: audit.damageChargesTotal,
        missingChargesTotal: audit.missingChargesTotal,
        depositBalance: audit.depositBalance,
        netPayableOrRefundable: audit.damageChargesTotal.plus(audit.missingChargesTotal).minus(audit.depositBalance),
        hasOutstandingStock: audit.hasOutstandingStock,
        ownerApprovedException: !!input.ownerApprovedException,
        exceptionApprovedById: input.ownerApprovedException ? actor.id : null,
        exceptionReason: input.exceptionReason || null,
        customerAcknowledgement: input.customerAcknowledgement ? (input.customerAcknowledgement as any) : null,
        remarks: input.remarks || null,
        createdById: actor.id,
        finalizedById: actor.id,
        finalizedAt: new Date(),
      },
    });

    // 2. Mark CustomerSite as CLOSED
    await tx.customerSite.update({
      where: { id: audit.customerSiteId },
      data: {
        status: "CLOSED",
        actualClosingDate: new Date(),
      },
    });

    // 3. Mark any active agreements for this site as COMPLETED
    await tx.rentalAgreement.updateMany({
      where: {
        customerSiteId: audit.customerSiteId,
        status: "ACTIVE",
      },
      data: {
        status: "COMPLETED",
      },
    });

    // 4. Audit Log
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "POST",
      module: "RENTALS",
      entityType: "SiteClosureSettlement",
      entityId: settlement.id,
      notes: `Executed Site Closure Settlement ${settlementNumber} for site ${audit.siteCode} (${audit.siteName}). Outstanding qty: ${audit.totalOutstandingQty.toString()}`,
    });

    return settlement;
  });
}

