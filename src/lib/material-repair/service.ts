import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";

// ==============================================================================
// INVENTRA: CENTERING MATERIAL REPAIR & RECONDITIONING SERVICE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

/**
 * Creates a material repair job linked to a warehouse and optionally source MRN/RentalBatch.
 */
export async function createMaterialRepairJob(
  input: {
    warehouseId: string;
    materialVariantId: string;
    ownershipType: "OWNED" | "HIRED_IN";
    mrnId?: string | null;
    rentalBatchId?: string | null;
    totalQuantity: number;
    damageDescription: string;
    damagePhotoUrl?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assignedTechnicianId?: string | null;
    targetDate?: string | null;
    remarks?: string | null;
  },
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const qty = new Prisma.Decimal(input.totalQuantity);
  if (qty.lte(0)) {
    throw new Error("Repair quantity must be greater than zero.");
  }

  return await db.$transaction(async (tx) => {
    const jobCode = await generateNextDocumentNumber("MAT_REP");

    const repairJob = await tx.materialRepairJob.create({
      data: {
        jobCode,
        warehouseId: input.warehouseId,
        materialVariantId: input.materialVariantId,
        ownershipType: input.ownershipType,
        mrnId: input.mrnId || null,
        rentalBatchId: input.rentalBatchId || null,
        totalQuantity: qty,
        repairedQuantity: new Prisma.Decimal(0),
        scrappedQuantity: new Prisma.Decimal(0),
        remainingQuantity: qty,
        damageDescription: input.damageDescription,
        damagePhotoUrl: input.damagePhotoUrl || null,
        priority: input.priority || "MEDIUM",
        assignedTechnicianId: input.assignedTechnicianId || null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        status: "APPROVED_FOR_REPAIR",
        remarks: input.remarks || null,
        logs: {
          create: {
            action: "STARTED_WORK",
            notes: `Repair job created for ${qty.toString()} units. Damage: ${input.damageDescription}`,
          },
        },
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "CREATE",
      module: "material_maintenance",
      entityType: "MaterialRepairJob",
      entityId: repairJob.id,
      afterState: repairJob,
      ipAddress: actor.ipAddress,
    });

    return repairJob;
  });
}

/**
 * Completes a partial or full material repair.
 * Deducts repaired quantity, updates job status, and returns repaired items to available WAREHOUSE stock.
 */
export async function completeMaterialRepair(
  repairJobId: string,
  input: {
    repairedQuantity: number;
    partsCost?: number;
    labourCost?: number;
    externalVendorCost?: number;
    repairVendor?: string | null;
    notes?: string | null;
    postToInventory?: boolean;
    postToAccounts?: boolean;
    paidFromAccountId?: string | null;
  },
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const qtyToComplete = new Prisma.Decimal(input.repairedQuantity);
  if (qtyToComplete.lte(0)) {
    throw new Error("Repaired quantity must be greater than zero.");
  }

  const parts = new Prisma.Decimal(input.partsCost || 0);
  const labour = new Prisma.Decimal(input.labourCost || 0);
  const vendor = new Prisma.Decimal(input.externalVendorCost || 0);
  const totalCost = parts.plus(labour).plus(vendor);

  return await db.$transaction(async (tx) => {
    const job = await tx.materialRepairJob.findUnique({
      where: { id: repairJobId },
      include: { materialVariant: true, warehouse: true },
    });

    if (!job) {
      throw new Error(`Repair Job '${repairJobId}' not found.`);
    }

    if (new Prisma.Decimal(job.remainingQuantity).lt(qtyToComplete)) {
      throw new Error(
        `Cannot complete ${qtyToComplete.toString()} units. Remaining damaged units in job: ${job.remainingQuantity.toString()}`
      );
    }

    const newRepairedTotal = new Prisma.Decimal(job.repairedQuantity).plus(qtyToComplete);
    const newRemaining = new Prisma.Decimal(job.remainingQuantity).minus(qtyToComplete);
    const newTotalCost = new Prisma.Decimal(job.totalCost).plus(totalCost);

    const isFullyCompleted = newRemaining.lte(0);
    const newStatus = isFullyCompleted ? "RETURNED_TO_AVAILABLE_STOCK" : "IN_REPAIR";

    // 1. Post Inventory Movement: Transfer from MAINTENANCE back to WAREHOUSE
    if (input.postToInventory !== false) {
      await postInventoryMovement(
        {
          materialVariantId: job.materialVariantId,
          quantity: qtyToComplete.toNumber(),
          uom: job.materialVariant.uom,
          ownershipType: job.ownershipType as "OWNED" | "HIRED_IN",
          movementType: "MAINTENANCE_RETURN",
          sourceLocationType: "MAINTENANCE",
          destinationLocationType: "WAREHOUSE",
          destinationWarehouseId: job.warehouseId,
          condition: "GOOD",
          referenceDocumentType: "MATERIAL_REPAIR_JOB",
          referenceDocumentId: job.id,
          notes: `Repair completion: ${qtyToComplete.toString()} units restored to warehouse stock. Job: ${job.jobCode}`,
        },
        actor
      );
    }

    // 2. Post Accounting Journal if repair expenses incurred
    let journalId: string | null = null;
    if (input.postToAccounts !== false && totalCost.gt(0)) {
      const repairExpenseAccount = await getSystemAccount("5020", tx);
      const paymentAccount = input.paidFromAccountId
        ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
        : await getSystemAccount("1010", tx); // Default cash in hand

      if (repairExpenseAccount && paymentAccount) {
        const journal = await postJournalEntry(
          {
            journalType: "PAYMENT",
            postingDate: new Date(),
            fiscalYear: getCurrentFiscalYear(),
            narration: `Material Repair & Welding Expenses for Job ${job.jobCode} (${job.materialVariant.name})`,
            referenceDocumentType: "MATERIAL_REPAIR_JOB",
            referenceDocumentId: job.id,
            referenceNumber: job.jobCode,
            lines: [
              {
                accountId: repairExpenseAccount.id,
                description: `Repair parts/welding/labour for ${job.jobCode}`,
                debitAmount: totalCost,
                creditAmount: new Prisma.Decimal(0),
              },
              {
                accountId: paymentAccount.id,
                description: `Payment for repair of ${job.jobCode}`,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: totalCost,
              },
            ],
          },
          actor,
          tx
        );
        journalId = journal.id;
      }
    }

    // 3. Update Job
    const updated = await tx.materialRepairJob.update({
      where: { id: job.id },
      data: {
        repairedQuantity: newRepairedTotal,
        remainingQuantity: newRemaining,
        partsCost: new Prisma.Decimal(job.partsCost).plus(parts),
        labourCost: new Prisma.Decimal(job.labourCost).plus(labour),
        externalVendorCost: new Prisma.Decimal(job.externalVendorCost).plus(vendor),
        totalCost: newTotalCost,
        status: newStatus,
        qualityApprovedById: actor.id,
        qualityApprovedAt: new Date(),
        completedDate: isFullyCompleted ? new Date() : job.completedDate,
        journalEntryId: journalId || job.journalEntryId,
        logs: {
          create: {
            action: "RELEASED_TO_STOCK",
            notes: `Cleared and restored ${qtyToComplete.toString()} units to stock. Notes: ${input.notes || "Quality inspection passed"}`,
            cost: totalCost,
          },
        },
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "UPDATE",
      module: "material_maintenance",
      entityType: "MaterialRepairJob",
      entityId: job.id,
      afterState: updated,
      ipAddress: actor.ipAddress,
    });

    return updated;
  });
}

/**
 * Scraps / writes off unrepairable material.
 */
export async function scrapMaterialRepair(
  repairJobId: string,
  input: {
    scrappedQuantity: number;
    reason: string;
    scrapValueRecovered?: number;
    postToInventory?: boolean;
    postToAccounts?: boolean;
    depositToAccountId?: string | null;
  },
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const qtyToScrap = new Prisma.Decimal(input.scrappedQuantity);
  if (qtyToScrap.lte(0)) {
    throw new Error("Scrapped quantity must be greater than zero.");
  }

  return await db.$transaction(async (tx) => {
    const job = await tx.materialRepairJob.findUnique({
      where: { id: repairJobId },
      include: { materialVariant: true, warehouse: true },
    });

    if (!job) {
      throw new Error(`Repair Job '${repairJobId}' not found.`);
    }

    if (new Prisma.Decimal(job.remainingQuantity).lt(qtyToScrap)) {
      throw new Error(
        `Cannot scrap ${qtyToScrap.toString()} units. Remaining damaged units in job: ${job.remainingQuantity.toString()}`
      );
    }

    const newScrappedTotal = new Prisma.Decimal(job.scrappedQuantity).plus(qtyToScrap);
    const newRemaining = new Prisma.Decimal(job.remainingQuantity).minus(qtyToScrap);

    const isDone = newRemaining.lte(0);
    const newStatus = isDone && newScrappedTotal.gt(0) && new Prisma.Decimal(job.repairedQuantity).lte(0)
      ? "WRITTEN_OFF"
      : isDone
      ? "RETURNED_TO_AVAILABLE_STOCK"
      : "IN_REPAIR";

    // 1. Post Inventory Movement to SCRAP
    if (input.postToInventory !== false) {
      await postInventoryMovement(
        {
          materialVariantId: job.materialVariantId,
          quantity: qtyToScrap.toNumber(),
          uom: job.materialVariant.uom,
          ownershipType: job.ownershipType as "OWNED" | "HIRED_IN",
          movementType: "SCRAP",
          sourceLocationType: "MAINTENANCE",
          destinationLocationType: "SCRAP",
          destinationWarehouseId: job.warehouseId,
          condition: "SCRAP",
          referenceDocumentType: "MATERIAL_REPAIR_JOB",
          referenceDocumentId: job.id,
          notes: `Scrap write-off: ${qtyToScrap.toString()} units written off. Reason: ${input.reason}`,
        },
        actor
      );
    }

    // 2. Update Job
    const updated = await tx.materialRepairJob.update({
      where: { id: job.id },
      data: {
        scrappedQuantity: newScrappedTotal,
        remainingQuantity: newRemaining,
        status: newStatus,
        logs: {
          create: {
            action: "SCRAPPED",
            notes: `Written off ${qtyToScrap.toString()} units as scrap. Reason: ${input.reason}`,
          },
        },
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "UPDATE",
      module: "material_maintenance",
      entityType: "MaterialRepairJob",
      entityId: job.id,
      afterState: updated,
      ipAddress: actor.ipAddress,
    });

    return updated;
  });
}

