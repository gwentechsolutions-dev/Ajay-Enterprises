import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { adjustSiteBalance } from "@/lib/inventory/ledger";
import {
  CreateDirectTransferInput,
  DispatchDirectTransferInput,
  ReceiveDirectTransferInput,
} from "@/lib/schemas/direct-transfer";

export class DirectTransferError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode: number = 400) {
    super(message);
    this.name = "DirectTransferError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves available active rental batches at a customer site
 */
export async function getAvailableSourceBatches(customerSiteId: string) {
  const batches = await db.rentalBatch.findMany({
    where: {
      customerSiteId,
      currentHeldQty: { gt: 0 },
      status: "ACTIVE",
    },
    include: {
      materialVariant: true,
    },
    orderBy: {
      deliveryDate: "asc",
    },
  });

  // Group summary by materialVariantId and ownershipType
  const summaryMap = new Map<
    string,
    {
      materialVariantId: string;
      materialName: string;
      materialCode: string;
      uom: string;
      ownershipType: string;
      totalAvailableQty: Prisma.Decimal;
      batches: typeof batches;
    }
  >();

  for (const batch of batches) {
    const key = `${batch.materialVariantId}_${batch.ownershipType}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.totalAvailableQty = existing.totalAvailableQty.plus(batch.currentHeldQty);
      existing.batches.push(batch);
    } else {
      summaryMap.set(key, {
        materialVariantId: batch.materialVariantId,
        materialName: batch.materialVariant.name,
        materialCode: batch.materialVariant.materialCode,
        uom: batch.materialVariant.uom,
        ownershipType: batch.ownershipType,
        totalAvailableQty: new Prisma.Decimal(batch.currentHeldQty),
        batches: [batch],
      });
    }
  }

  return {
    batches,
    summaries: Array.from(summaryMap.values()),
  };
}

/**
 * Lists direct site transfer notes with optional filters
 */
export async function getDirectTransferList(filters?: {
  sourceCustomerId?: string;
  destinationCustomerId?: string;
  sourceCustomerSiteId?: string;
  destinationCustomerSiteId?: string;
  status?: string;
}) {
  const where: Prisma.DirectSiteTransferNoteWhereInput = {};

  if (filters?.sourceCustomerId) where.sourceCustomerId = filters.sourceCustomerId;
  if (filters?.destinationCustomerId) where.destinationCustomerId = filters.destinationCustomerId;
  if (filters?.sourceCustomerSiteId) where.sourceCustomerSiteId = filters.sourceCustomerSiteId;
  if (filters?.destinationCustomerSiteId) where.destinationCustomerSiteId = filters.destinationCustomerSiteId;
  if (filters?.status) where.status = filters.status;

  return await db.directSiteTransferNote.findMany({
    where,
    include: {
      sourceCustomer: true,
      sourceCustomerSite: true,
      destinationCustomer: true,
      destinationCustomerSite: true,
      vehicle: true,
      driver: true,
      items: {
        include: {
          materialVariant: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Gets details of a specific direct site transfer note
 */
export async function getDirectTransferById(id: string) {
  const transfer = await db.directSiteTransferNote.findUnique({
    where: { id },
    include: {
      sourceCustomer: true,
      sourceCustomerSite: true,
      destinationCustomer: true,
      destinationCustomerSite: true,
      sourceRentalAgreement: {
        include: { items: true },
      },
      destinationRentalAgreement: {
        include: { items: true },
      },
      vehicle: true,
      driver: true,
      vehicleTrip: true,
      items: {
        include: {
          materialVariant: true,
          sourceRentalBatch: true,
          destinationBatches: true,
          returnAllocations: true,
        },
      },
      rentalBatches: true,
      returnAllocations: true,
    },
  });

  if (!transfer) {
    throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
  }

  return transfer;
}

/**
 * Creates a new Direct Site Transfer Note
 */
export async function createDirectTransfer(
  input: CreateDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (input.sourceCustomerSiteId === input.destinationCustomerSiteId) {
    throw new DirectTransferError(
      "Source site and destination site must be different for a site-to-site transfer.",
      "INVALID_SITES",
      400
    );
  }

  // 1. Validate source customer and site
  const [sourceCustomer, sourceSite, destCustomer, destSite] = await Promise.all([
    db.customer.findUnique({ where: { id: input.sourceCustomerId } }),
    db.customerSite.findUnique({ where: { id: input.sourceCustomerSiteId } }),
    db.customer.findUnique({ where: { id: input.destinationCustomerId } }),
    db.customerSite.findUnique({ where: { id: input.destinationCustomerSiteId } }),
  ]);

  if (!sourceCustomer || !sourceSite) {
    throw new DirectTransferError("Source customer or site not found.", "SOURCE_NOT_FOUND", 404);
  }
  if (!destCustomer || !destSite) {
    throw new DirectTransferError("Destination customer or site not found.", "DEST_NOT_FOUND", 404);
  }

  // 2. Validate that source site currently holds enough material in active batches
  for (const item of input.items) {
    const qtyDispatched = new Prisma.Decimal(item.quantityDispatched);
    if (qtyDispatched.lte(0)) {
      throw new DirectTransferError("Dispatched quantity must be greater than zero.", "INVALID_QTY", 400);
    }

    if (item.sourceRentalBatchId) {
      const batch = await db.rentalBatch.findUnique({
        where: { id: item.sourceRentalBatchId },
      });
      if (!batch || batch.customerSiteId !== input.sourceCustomerSiteId) {
        throw new DirectTransferError(
          `Specified rental batch '${item.sourceRentalBatchId}' does not belong to the source site.`,
          "INVALID_BATCH",
          400
        );
      }
      if (new Prisma.Decimal(batch.currentHeldQty).lt(qtyDispatched)) {
        throw new DirectTransferError(
          `Insufficient quantity in source batch ${batch.batchNumber}. Held: ${batch.currentHeldQty}, Requested: ${qtyDispatched}`,
          "INSUFFICIENT_STOCK",
          400
        );
      }
    } else {
      const activeBatches = await db.rentalBatch.findMany({
        where: {
          customerSiteId: input.sourceCustomerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          currentHeldQty: { gt: 0 },
          status: "ACTIVE",
        },
      });

      const totalHeld = activeBatches.reduce(
        (acc, b) => acc.plus(new Prisma.Decimal(b.currentHeldQty)),
        new Prisma.Decimal(0)
      );

      if (totalHeld.lt(qtyDispatched)) {
        const variant = await db.materialVariant.findUnique({ where: { id: item.materialVariantId } });
        throw new DirectTransferError(
          `Insufficient held stock at source site for variant ${variant?.name || item.materialVariantId}. Available held: ${totalHeld.toString()}, Requested: ${qtyDispatched.toString()}`,
          "INSUFFICIENT_STOCK",
          400
        );
      }
    }
  }

  // 3. Generate sequential transfer note number
  const transferNumber =
    input.transferNumber || (await generateNextDocumentNumber("DSTN"));

  // 4. Create document
  const transfer = await db.$transaction(async (tx) => {
    const created = await tx.directSiteTransferNote.create({
      data: {
        transferNumber,
        transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
        sourceCustomerId: input.sourceCustomerId,
        sourceCustomerSiteId: input.sourceCustomerSiteId,
        destinationCustomerId: input.destinationCustomerId,
        destinationCustomerSiteId: input.destinationCustomerSiteId,
        sourceRentalAgreementId: input.sourceRentalAgreementId || null,
        destinationRentalAgreementId: input.destinationRentalAgreementId || null,
        vehicleId: input.vehicleId || null,
        driverId: input.driverId || null,
        vehicleTripId: input.vehicleTripId || null,
        status: "DRAFT",
        includeCutoffDate: input.includeCutoffDate ?? false,
        transportCharges: new Prisma.Decimal(input.transportCharges || 0),
        notes: input.notes || null,
        createdById: actor.id,
        items: {
          create: input.items.map((item) => ({
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            sourceRentalBatchId: item.sourceRentalBatchId || null,
            quantityDispatched: new Prisma.Decimal(item.quantityDispatched),
            quantityAccepted: new Prisma.Decimal(0),
            quantityDamaged: new Prisma.Decimal(0),
            quantityMissing: new Prisma.Decimal(0),
            quantityRejected: new Prisma.Decimal(0),
            agreedDailyRate: item.agreedDailyRate !== undefined && item.agreedDailyRate !== null ? new Prisma.Decimal(item.agreedDailyRate) : null,
            remarks: item.remarks || null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return created;
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "DIRECT_TRANSFERS",
    entityType: "DirectSiteTransferNote",
    entityId: transfer.id,
    afterState: {
      transferNumber,
      sourceCustomerId: input.sourceCustomerId,
      destinationCustomerId: input.destinationCustomerId,
      itemCount: input.items.length,
    },
    notes: `Created Direct Site Transfer Note ${transferNumber}`,
  });

  return transfer;
}

/**
 * Dispatches a Direct Site Transfer Note with source representative acknowledgment & GPS proof
 */
export async function dispatchDirectTransfer(
  id: string,
  input: DispatchDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const transfer = await db.directSiteTransferNote.findUnique({
    where: { id },
  });

  if (!transfer) {
    throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
  }

  if (transfer.status === "COMPLETED" || transfer.status === "CANCELLED") {
    throw new DirectTransferError(
      `Cannot dispatch transfer in '${transfer.status}' status.`,
      "INVALID_STATUS",
      400
    );
  }

  const updated = await db.directSiteTransferNote.update({
    where: { id },
    data: {
      sourceRepName: input.sourceRepName,
      sourceRepPhone: input.sourceRepPhone || null,
      sourceRepDesignation: input.sourceRepDesignation || null,
      sourceRepSignatureUrl: input.sourceRepSignatureUrl || null,
      sourceGpsLat: input.sourceGpsLat !== undefined && input.sourceGpsLat !== null ? new Prisma.Decimal(input.sourceGpsLat) : null,
      sourceGpsLng: input.sourceGpsLng !== undefined && input.sourceGpsLng !== null ? new Prisma.Decimal(input.sourceGpsLng) : null,
      sourcePhotoUrl: input.sourcePhotoUrl || null,
      dispatchedAt: new Date(),
      dispatchedById: actor.id,
      status: "DISPATCHED",
      notes: input.notes || transfer.notes,
    },
    include: {
      items: true,
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "DISPATCH",
    module: "DIRECT_TRANSFERS",
    entityType: "DirectSiteTransferNote",
    entityId: updated.id,
    notes: `Dispatched Direct Site Transfer ${updated.transferNumber}. Source Rep: ${input.sourceRepName}`,
  });

  return updated;
}

/**
 * Receives and reconciles a Direct Site Transfer Note at destination site.
 * - Deducts from source site active RentalBatches using return allocations (FIFO)
 * - Creates new destination RentalBatches with destination rates & independent date inclusion
 * - Updates site stock balances directly with NO warehouse movement
 * - Guarantees zero double-billing and duplicate completion protection
 */
export async function receiveDirectTransfer(
  id: string,
  input: ReceiveDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  return await db.$transaction(async (tx) => {
    // 1. Concurrency-safe retrieval with lock
    const transfer = await tx.directSiteTransferNote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            materialVariant: true,
          },
        },
        sourceCustomerSite: true,
        destinationCustomerSite: true,
      },
    });

    if (!transfer) {
      throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
    }

    if (transfer.status === "COMPLETED") {
      throw new DirectTransferError("Transfer has already been completed.", "ALREADY_COMPLETED", 400);
    }

    if (transfer.status === "CANCELLED") {
      throw new DirectTransferError("Cannot receive a cancelled transfer.", "INVALID_STATUS", 400);
    }

    // 2. Validate destination agreement coverage
    const destAgreement = await tx.rentalAgreement.findFirst({
      where: {
        customerId: transfer.destinationCustomerId,
        customerSiteId: transfer.destinationCustomerSiteId,
        status: "ACTIVE",
      },
      include: {
        items: true,
      },
    });

    // 3. Map reconciliation inputs
    const recMap = new Map(input.items.map((i) => [i.itemId, i]));

    let hasDiscrepancy = false;

    for (const item of transfer.items) {
      const rec = recMap.get(item.id);
      if (!rec) {
        throw new DirectTransferError(
          `Missing reconciliation details for transfer item ${item.id}`,
          "MISSING_RECONCILIATION",
          400
        );
      }

      const qDispatched = new Prisma.Decimal(item.quantityDispatched);
      const qAccepted = new Prisma.Decimal(rec.quantityAccepted || 0);
      const qDamaged = new Prisma.Decimal(rec.quantityDamaged || 0);
      const qMissing = new Prisma.Decimal(rec.quantityMissing || 0);
      const qRejected = new Prisma.Decimal(rec.quantityRejected || 0);

      // Invariant: dispatched == accepted + damaged + missing + rejected
      const sum = qAccepted.plus(qDamaged).plus(qMissing).plus(qRejected);
      if (!sum.equals(qDispatched)) {
        throw new DirectTransferError(
          `Item reconciliation mismatch for ${item.materialVariant.name}: Dispatched (${qDispatched.toString()}) must equal Accepted (${qAccepted.toString()}) + Damaged (${qDamaged.toString()}) + Missing (${qMissing.toString()}) + Rejected (${qRejected.toString()}). Got sum: ${sum.toString()}`,
          "RECONCILIATION_MISMATCH",
          400
        );
      }

      if (qDamaged.gt(0) || qMissing.gt(0) || qRejected.gt(0)) {
        hasDiscrepancy = true;
      }

      // Check destination agreement for accepted units
      let destDailyRate: Prisma.Decimal | null = item.agreedDailyRate
        ? new Prisma.Decimal(item.agreedDailyRate)
        : null;

      if (qAccepted.gt(0)) {
        if (!destDailyRate && destAgreement) {
          const agrItem = destAgreement.items.find(
            (ai) => ai.materialVariantId === item.materialVariantId
          );
          if (agrItem) {
            destDailyRate = new Prisma.Decimal(agrItem.agreedDailyRate);
          }
        }

        if (!destDailyRate) {
          // If no destination agreement covers it and no explicit item rate is provided, reject with 422
          throw new DirectTransferError(
            `Destination customer does not have an active rental agreement covering material variant '${item.materialVariant.name}'. An active agreement or explicit rate is required.`,
            "DESTINATION_AGREEMENT_REQUIRED",
            422
          );
        }
      }

      // 4. Source RentalBatch deduction & Return Allocation (FIFO)
      // Dispatched/accepted + damaged + missing leaves the source site custody
      let unallocatedToDeduct = qDispatched; // Total units removed from Customer A's site
      let unallocatedAccepted = qAccepted;
      let unallocatedDamaged = qDamaged;
      let unallocatedMissing = qMissing;

      // Find open batches at source site
      const openBatches = await tx.rentalBatch.findMany({
        where: {
          customerSiteId: transfer.sourceCustomerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          currentHeldQty: { gt: 0 },
        },
        orderBy: {
          deliveryDate: "asc",
        },
      });

      // If specific source batch was selected, sort it first
      if (item.sourceRentalBatchId) {
        openBatches.sort((a, b) =>
          a.id === item.sourceRentalBatchId ? -1 : b.id === item.sourceRentalBatchId ? 1 : 0
        );
      }

      for (const batch of openBatches) {
        if (unallocatedToDeduct.lte(0)) break;

        const held = new Prisma.Decimal(batch.currentHeldQty);
        if (held.lte(0)) continue;

        const allocReturn = unallocatedToDeduct.gt(held) ? held : unallocatedToDeduct;
        const allocAccepted = unallocatedAccepted.gt(allocReturn) ? allocReturn : unallocatedAccepted;
        const allocDamaged = unallocatedDamaged.gt(allocReturn.minus(allocAccepted))
          ? allocReturn.minus(allocAccepted)
          : unallocatedDamaged;
        const allocMissing = allocReturn.minus(allocAccepted).minus(allocDamaged);

        // Record return allocation on source batch
        await tx.rentalReturnAllocation.create({
          data: {
            rentalBatchId: batch.id,
            directSiteTransferId: transfer.id,
            directSiteTransferItemId: item.id,
            returnDate: transfer.transferDate,
            includeReturnDate: transfer.includeCutoffDate, // Source cutoff policy
            allocatedReturnedQty: allocReturn,
            allocatedAcceptedQty: allocAccepted,
            allocatedDamagedQty: allocDamaged,
            allocatedMissingQty: allocMissing,
          },
        });

        // Update source batch balances
        const newReturned = new Prisma.Decimal(batch.returnedQty).plus(allocReturn);
        const newDamaged = new Prisma.Decimal(batch.damagedQty).plus(allocDamaged);
        const newMissing = new Prisma.Decimal(batch.missingQty).plus(allocMissing);
        const newHeld = held.minus(allocReturn);

        await tx.rentalBatch.update({
          where: { id: batch.id },
          data: {
            returnedQty: newReturned,
            damagedQty: newDamaged,
            missingQty: newMissing,
            currentHeldQty: newHeld.lt(0) ? new Prisma.Decimal(0) : newHeld,
            status: newHeld.lte(0) ? "CLOSED" : "ACTIVE",
          },
        });

        unallocatedToDeduct = unallocatedToDeduct.minus(allocReturn);
        unallocatedAccepted = unallocatedAccepted.minus(allocAccepted);
        unallocatedDamaged = unallocatedDamaged.minus(allocDamaged);
        unallocatedMissing = unallocatedMissing.minus(allocMissing);
      }

      // 5. Destination RentalBatch Creation (strictly for accepted quantity)
      if (qAccepted.gt(0)) {
        const destBatchNumber = await generateNextDocumentNumber("RB");

        // Independent delivery date rule:
        // If Customer A paid on transfer day (includeCutoffDate = true), Customer B starts billing next day (includeDeliveryDate = false)
        // If Customer A did not pay on transfer day, Customer B starts billing on transfer day (includeDeliveryDate = true)
        const includeDeliveryDate = !transfer.includeCutoffDate;

        await tx.rentalBatch.create({
          data: {
            batchNumber: destBatchNumber,
            customerId: transfer.destinationCustomerId,
            customerSiteId: transfer.destinationCustomerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            directSiteTransferId: transfer.id,
            directSiteTransferItemId: item.id,
            deliveryDate: transfer.transferDate,
            includeDeliveryDate,
            deliveredQty: qAccepted,
            returnedQty: new Prisma.Decimal(0),
            damagedQty: new Prisma.Decimal(0),
            missingQty: new Prisma.Decimal(0),
            currentHeldQty: qAccepted,
            applicableDailyRate: destDailyRate!,
            status: "ACTIVE",
          },
        });
      }

      // 6. Direct Site-to-Site Inventory StockBalance adjustments
      // Deduct full dispatched quantity from source site
      await adjustSiteBalance(tx, {
        siteId: transfer.sourceCustomerSiteId,
        materialVariantId: item.materialVariantId,
        ownershipType: item.ownershipType,
        availableDelta: qDispatched.negated(),
      });

      // Add accepted quantity to destination site
      if (qAccepted.gt(0)) {
        await adjustSiteBalance(tx, {
          siteId: transfer.destinationCustomerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          availableDelta: qAccepted,
        });
      }

      // 7. Create immutable Inventory Movement record for accepted units (SITE_TO_SITE_TRANSFER)
      if (qAccepted.gt(0)) {
        const movementNumber = await generateNextDocumentNumber("MV");
        await tx.inventoryMovement.create({
          data: {
            movementNumber,
            materialVariantId: item.materialVariantId,
            quantity: qAccepted,
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType,
            movementType: "SITE_TO_SITE_TRANSFER",
            movementDate: transfer.transferDate,
            sourceLocationType: "CUSTOMER_SITE",
            sourceSiteId: transfer.sourceCustomerSiteId,
            destinationLocationType: "CUSTOMER_SITE",
            destinationSiteId: transfer.destinationCustomerSiteId,
            customerId: transfer.destinationCustomerId,
            referenceDocumentType: "DIRECT_SITE_TRANSFER",
            referenceDocumentId: transfer.id,
            responsibleUserId: actor.id,
            status: "POSTED",
            postedAt: new Date(),
            notes: `Direct Site Transfer ${transfer.transferNumber} from ${transfer.sourceCustomerSite.siteName} to ${transfer.destinationCustomerSite.siteName}`,
          },
        });
      }

      // 8. Traceable custody workflows for Damaged, Missing, and Rejected quantities
      // Find a warehouse for repair/loss routing
      const targetWarehouse = input.warehouseId
        ? await tx.warehouse.findUnique({ where: { id: input.warehouseId } })
        : await tx.warehouse.findFirst();

      if (qDamaged.gt(0)) {
        // A. Enter Damaged/Repair Assessment workflow
        const dlaNumber = await generateNextDocumentNumber("DLA");
        await tx.damageLossAssessment.create({
          data: {
            assessmentNumber: dlaNumber,
            customerId: transfer.sourceCustomerId,
            customerSiteId: transfer.destinationCustomerSiteId,
            materialVariantId: item.materialVariantId,
            directSiteTransferId: transfer.id,
            assessmentType: "DAMAGED_REPAIRABLE",
            quantity: qDamaged,
            condition: "DAMAGED",
            status: "PENDING_APPROVAL",
            assessedById: actor.id,
            remarks: rec.remarks || `Damaged upon receipt of Direct Transfer ${transfer.transferNumber}. Responsible: ${input.discrepancyResponsibleParty || "UNDER_INVESTIGATION"}`,
          },
        });

        // B. Queue Material Repair Job if warehouse exists
        if (targetWarehouse) {
          const repCode = await generateNextDocumentNumber("MAT_REP");
          await tx.materialRepairJob.create({
            data: {
              jobCode: repCode,
              warehouseId: targetWarehouse.id,
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              directSiteTransferId: transfer.id,
              totalQuantity: qDamaged,
              remainingQuantity: qDamaged,
              damageDescription: `Damaged during direct transfer ${transfer.transferNumber} from ${transfer.sourceCustomerSite.siteName}. Awaiting repair.`,
              status: "REPORTED",
              priority: "MEDIUM",
              remarks: `Direct Transfer discrepancy: ${qDamaged.toString()} units damaged`,
            },
          });
        }

        // C. Record damaged inventory movement so units are accounted for in ledger
        const damMvNumber = await generateNextDocumentNumber("MV");
        await tx.inventoryMovement.create({
          data: {
            movementNumber: damMvNumber,
            materialVariantId: item.materialVariantId,
            quantity: qDamaged,
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType,
            movementType: "DAMAGE",
            movementDate: transfer.transferDate,
            sourceLocationType: "CUSTOMER_SITE",
            sourceSiteId: transfer.sourceCustomerSiteId,
            destinationLocationType: targetWarehouse ? "WAREHOUSE" : "CUSTOMER_SITE",
            destinationWarehouseId: targetWarehouse?.id || null,
            destinationSiteId: targetWarehouse ? null : transfer.destinationCustomerSiteId,
            customerId: transfer.sourceCustomerId,
            referenceDocumentType: "DIRECT_SITE_TRANSFER",
            referenceDocumentId: transfer.id,
            condition: "DAMAGED",
            responsibleUserId: actor.id,
            status: "POSTED",
            postedAt: new Date(),
            notes: `Damaged in Direct Transfer ${transfer.transferNumber}. Routed to repair workflow.`,
          },
        });
      }

      if (qMissing.gt(0)) {
        // Enter Loss Investigation and Assessment workflow
        const dlaMissingNumber = await generateNextDocumentNumber("DLA");
        await tx.damageLossAssessment.create({
          data: {
            assessmentNumber: dlaMissingNumber,
            customerId: transfer.sourceCustomerId,
            customerSiteId: transfer.destinationCustomerSiteId,
            materialVariantId: item.materialVariantId,
            directSiteTransferId: transfer.id,
            assessmentType: "MISSING",
            quantity: qMissing,
            condition: "MISSING",
            status: "PENDING_APPROVAL",
            assessedById: actor.id,
            remarks: rec.remarks || `Missing equipment during Direct Transfer ${transfer.transferNumber}. Responsible: ${input.discrepancyResponsibleParty || "UNDER_INVESTIGATION"}`,
          },
        });

        // Record loss tracking movement
        const misMvNumber = await generateNextDocumentNumber("MV");
        await tx.inventoryMovement.create({
          data: {
            movementNumber: misMvNumber,
            materialVariantId: item.materialVariantId,
            quantity: qMissing,
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType,
            movementType: "DAMAGE",
            movementDate: transfer.transferDate,
            sourceLocationType: "CUSTOMER_SITE",
            sourceSiteId: transfer.sourceCustomerSiteId,
            destinationLocationType: "CUSTOMER_SITE",
            destinationSiteId: null,
            customerId: transfer.sourceCustomerId,
            referenceDocumentType: "DIRECT_SITE_TRANSFER",
            referenceDocumentId: transfer.id,
            condition: "DAMAGED",
            responsibleUserId: actor.id,
            status: "POSTED",
            postedAt: new Date(),
            notes: `Missing units in Direct Transfer ${transfer.transferNumber}. Under loss investigation.`,
          },
        });
      }

      if (qRejected.gt(0)) {
        // Record rejected custody disposition
        const rejMvNumber = await generateNextDocumentNumber("MV");
        await tx.inventoryMovement.create({
          data: {
            movementNumber: rejMvNumber,
            materialVariantId: item.materialVariantId,
            quantity: qRejected,
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType,
            movementType: "INTERNAL_TRANSFER",
            movementDate: transfer.transferDate,
            sourceLocationType: "CUSTOMER_SITE",
            sourceSiteId: transfer.sourceCustomerSiteId,
            destinationLocationType: targetWarehouse ? "WAREHOUSE" : "CUSTOMER_SITE",
            destinationWarehouseId: targetWarehouse?.id || null,
            destinationSiteId: null,
            customerId: transfer.sourceCustomerId,
            referenceDocumentType: "DIRECT_SITE_TRANSFER",
            referenceDocumentId: transfer.id,
            condition: "REJECTED",
            responsibleUserId: actor.id,
            status: "POSTED",
            postedAt: new Date(),
            notes: `Rejected in Direct Transfer ${transfer.transferNumber}. Disposition: ${input.rejectedDisposition || "RETURN_TO_WAREHOUSE"}`,
          },
        });
      }

      // 9. Update transfer line item with reconciled quantities
      await tx.directSiteTransferItem.update({
        where: { id: item.id },
        data: {
          quantityAccepted: qAccepted,
          quantityDamaged: qDamaged,
          quantityMissing: qMissing,
          quantityRejected: qRejected,
          agreedDailyRate: destDailyRate,
          remarks: rec.remarks || item.remarks,
        },
      });
    }

    // 10. Update transfer note status, destination evidence, and discrepancy governance
    const finalStatus = hasDiscrepancy ? "PARTIALLY_RECEIVED" : "COMPLETED";

    const completedTransfer = await tx.directSiteTransferNote.update({
      where: { id },
      data: {
        destRepName: input.destRepName,
        destRepPhone: input.destRepPhone || null,
        destRepDesignation: input.destRepDesignation || null,
        destRepSignatureUrl: input.destRepSignatureUrl || null,
        destGpsLat: input.destGpsLat !== undefined && input.destGpsLat !== null ? new Prisma.Decimal(input.destGpsLat) : null,
        destGpsLng: input.destGpsLng !== undefined && input.destGpsLng !== null ? new Prisma.Decimal(input.destGpsLng) : null,
        destPhotoUrl: input.destPhotoUrl || null,
        discrepancyNotes: input.discrepancyNotes || null,
        discrepancyResponsibleParty: input.discrepancyResponsibleParty || (hasDiscrepancy ? "UNDER_INVESTIGATION" : null),
        rejectedDisposition: input.rejectedDisposition || (hasDiscrepancy ? "RETURN_TO_WAREHOUSE" : null),
        receivedAt: new Date(),
        receivedById: actor.id,
        status: finalStatus,
      },
      include: {
        items: {
          include: {
            materialVariant: true,
          },
        },
        sourceCustomer: true,
        sourceCustomerSite: true,
        destinationCustomer: true,
        destinationCustomerSite: true,
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "RECEIVE",
      module: "DIRECT_TRANSFERS",
      entityType: "DirectSiteTransferNote",
      entityId: completedTransfer.id,
      afterState: {
        transferNumber: completedTransfer.transferNumber,
        status: finalStatus,
        hasDiscrepancy,
      },
      notes: `Received & completed Direct Site Transfer ${completedTransfer.transferNumber} with status ${finalStatus}`,
    });

    return completedTransfer;
  });
}

/**
 * Cancels a Direct Site Transfer Note if in draft or pending status
 */
export async function cancelDirectTransfer(
  id: string,
  reason: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const transfer = await db.directSiteTransferNote.findUnique({
    where: { id },
  });

  if (!transfer) {
    throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
  }

  if (["DISPATCHED", "COMPLETED", "PARTIALLY_RECEIVED"].includes(transfer.status)) {
    throw new DirectTransferError(
      `Cannot cancel transfer in '${transfer.status}' status.`,
      "INVALID_STATUS",
      400
    );
  }

  const updated = await db.directSiteTransferNote.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: transfer.notes ? `${transfer.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`,
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CANCEL",
    module: "DIRECT_TRANSFERS",
    entityType: "DirectSiteTransferNote",
    entityId: updated.id,
    notes: `Cancelled Direct Site Transfer ${updated.transferNumber}. Reason: ${reason}`,
  });

  return updated;
}
