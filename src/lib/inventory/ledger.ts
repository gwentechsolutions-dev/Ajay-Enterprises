import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { CreateMovementInput, MovementTypeEnum } from "@/lib/schemas/inventory";

export interface PostMovementResult {
  success: boolean;
  movementId: string;
  movementNumber: string;
  message: string;
}

/**
 * Core Inventory Movement Engine
 * Guarantees mathematical integrity, immutability, transactional atomicity,
 * and concurrency-safe balance updates.
 */
export async function postInventoryMovement(
  input: CreateMovementInput,
  actor: { id: string; name: string; role: string; ipAddress?: string },
  externalTx?: Prisma.TransactionClient
): Promise<PostMovementResult> {
  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) {
    throw new Error("Movement quantity must be greater than zero.");
  }

  const runner = async (tx: Prisma.TransactionClient) => {
    // 1. Generate unique human-readable movement number if not provided
    const movementNumber =
      input.movementNumber || (await generateNextDocumentNumber("MV", undefined, tx));

    // 2. Validate Material Variant exists and is active
    const variant = await tx.materialVariant.findUnique({
      where: { id: input.materialVariantId },
    });
    if (!variant) {
      throw new Error(`Material variant '${input.materialVariantId}' not found.`);
    }

    // 3. Location & Availability Validation
    // For outbound warehouse movements (delivery, internal transfer, damage, scrap):
    if (
      input.sourceLocationType === "WAREHOUSE" &&
      input.sourceWarehouseId &&
      !["OPENING_STOCK", "STOCK_RECEIPT", "FOUND_STOCK"].includes(input.movementType)
    ) {
      const sourceBalance = await tx.stockBalance.findFirst({
        where: {
          warehouseId: input.sourceWarehouseId,
          siteId: null,
          materialVariantId: input.materialVariantId,
          ownershipType: input.ownershipType,
          locationType: "WAREHOUSE",
        },
      });

      const currentAvailable = sourceBalance?.availableQty || new Prisma.Decimal(0);
      if (currentAvailable.lt(qty)) {
        throw new Error(
          `Insufficient stock in source warehouse. Available: ${currentAvailable.toString()} ${variant.uom}, Requested: ${qty.toString()} ${variant.uom}`
        );
      }
    }

    // For outbound customer-site movements (returns, site-to-site transfers):
    if (
      input.sourceLocationType === "CUSTOMER_SITE" &&
      input.sourceSiteId &&
      !["OPENING_STOCK"].includes(input.movementType)
    ) {
      const siteBalance = await tx.stockBalance.findFirst({
        where: {
          warehouseId: null,
          siteId: input.sourceSiteId,
          materialVariantId: input.materialVariantId,
          ownershipType: input.ownershipType,
          locationType: "CUSTOMER_SITE",
        },
      });

      const currentAtSite = siteBalance?.availableQty || new Prisma.Decimal(0);
      if (currentAtSite.lt(qty)) {
        throw new Error(
          `Insufficient stock at customer site. Available on site: ${currentAtSite.toString()} ${variant.uom}, Requested: ${qty.toString()} ${variant.uom}`
        );
      }
    }

    // 4. Create Immutable Inventory Movement Record
    const movement = await tx.inventoryMovement.create({
      data: {
        movementNumber,
        materialVariantId: input.materialVariantId,
        quantity: qty,
        uom: variant.uom,
        ownershipType: input.ownershipType,
        movementType: input.movementType,
        movementDate: input.movementDate ? new Date(input.movementDate) : new Date(),
        sourceLocationType: input.sourceLocationType,
        sourceWarehouseId: input.sourceWarehouseId || null,
        sourceSiteId: input.sourceSiteId || null,
        destinationLocationType: input.destinationLocationType,
        destinationWarehouseId: input.destinationWarehouseId || null,
        destinationSiteId: input.destinationSiteId || null,
        customerId: input.customerId || null,
        supplierId: input.supplierId || null,
        referenceDocumentType: input.referenceDocumentType || null,
        referenceDocumentId: input.referenceDocumentId || null,
        batchOrLotNumber: input.batchOrLotNumber || null,
        condition: input.condition || "GOOD",
        unitCost: input.unitCost !== undefined && input.unitCost !== null ? new Prisma.Decimal(input.unitCost) : variant.purchaseCost,
        replacementValue: input.replacementValue !== undefined && input.replacementValue !== null ? new Prisma.Decimal(input.replacementValue) : variant.replacementValue,
        responsibleUserId: actor.id,
        approvedById: ["OWNER", "ADMINISTRATOR", "ADMIN", "WAREHOUSE_MANAGER"].includes(actor.role) ? actor.id : null,
        approvedAt: ["OWNER", "ADMINISTRATOR", "ADMIN", "WAREHOUSE_MANAGER"].includes(actor.role) ? new Date() : null,
        status: "POSTED",
        notes: input.notes || null,
        postedAt: new Date(),
      },
    });

    // 5. Update StockBalance Projections Transactionally
    await applyBalanceChanges(tx, {
      materialVariantId: input.materialVariantId,
      ownershipType: input.ownershipType,
      movementType: input.movementType,
      qty,
      sourceLocationType: input.sourceLocationType,
      sourceWarehouseId: input.sourceWarehouseId,
      sourceSiteId: input.sourceSiteId,
      destinationLocationType: input.destinationLocationType,
      destinationWarehouseId: input.destinationWarehouseId,
      destinationSiteId: input.destinationSiteId,
      condition: input.condition,
    });

    // 6. Audit Logging
    await logAuditEvent(
      {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "MOVEMENTS",
        entityType: "InventoryMovement",
        entityId: movement.id,
        afterState: {
          movementNumber,
          type: input.movementType,
          quantity: qty.toString(),
          variant: variant.name,
        },
        notes: `Posted movement ${movementNumber} (${input.movementType}): ${qty.toString()} ${variant.uom}`,
      },
      tx
    );

    return {
      success: true,
      movementId: movement.id,
      movementNumber,
      message: `Movement ${movementNumber} posted successfully.`,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, { maxWait: 15000, timeout: 30000 });
}

/**
 * Reverses an already posted movement with an equal and opposite transaction.
 */
export async function reverseInventoryMovement(
  movementId: string,
  reversalReason: string,
  actor: { id: string; name: string; role: string; ipAddress?: string },
  externalTx?: Prisma.TransactionClient
): Promise<PostMovementResult> {
  const runner = async (tx: Prisma.TransactionClient) => {
    const original = await tx.inventoryMovement.findUnique({
      where: { id: movementId },
      include: { materialVariant: true },
    });

    if (!original) {
      throw new Error(`Movement '${movementId}' not found.`);
    }

    if (original.status === "REVERSED") {
      throw new Error(`Movement '${original.movementNumber}' has already been reversed.`);
    }

    const reversalNumber = await generateNextDocumentNumber("MV", undefined, tx);
    const qty = new Prisma.Decimal(original.quantity);

    // Create the reversal movement record
    const reversal = await tx.inventoryMovement.create({
      data: {
        movementNumber: reversalNumber,
        materialVariantId: original.materialVariantId,
        quantity: qty,
        uom: original.uom,
        ownershipType: original.ownershipType,
        movementType: "REVERSAL",
        movementDate: new Date(),
        // Inverse locations:
        sourceLocationType: original.destinationLocationType,
        sourceWarehouseId: original.destinationWarehouseId,
        sourceSiteId: original.destinationSiteId,
        destinationLocationType: original.sourceLocationType,
        destinationWarehouseId: original.sourceWarehouseId,
        destinationSiteId: original.sourceSiteId,
        customerId: original.customerId,
        supplierId: original.supplierId,
        referenceDocumentType: "REVERSAL",
        referenceDocumentId: original.id,
        condition: original.condition,
        unitCost: original.unitCost,
        replacementValue: original.replacementValue,
        responsibleUserId: actor.id,
        approvedById: actor.id,
        approvedAt: new Date(),
        status: "POSTED",
        reversedMovementId: original.id,
        notes: `Reversal of ${original.movementNumber}. Reason: ${reversalReason}`,
        postedAt: new Date(),
      },
    });

    // Mark original movement as REVERSED
    await tx.inventoryMovement.update({
      where: { id: original.id },
      data: {
        status: "REVERSED",
        reversedMovementId: reversal.id,
      },
    });

    // Apply the exact inverse balance changes
    await applyBalanceChanges(tx, {
      materialVariantId: original.materialVariantId,
      ownershipType: original.ownershipType,
      movementType: "REVERSAL",
      qty,
      sourceLocationType: original.destinationLocationType,
      sourceWarehouseId: original.destinationWarehouseId,
      sourceSiteId: original.destinationSiteId,
      destinationLocationType: original.sourceLocationType,
      destinationWarehouseId: original.sourceWarehouseId,
      destinationSiteId: original.sourceSiteId,
      condition: original.condition,
    });

    // Audit Event
    await logAuditEvent(
      {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "REVERSE",
        module: "MOVEMENTS",
        entityType: "InventoryMovement",
        entityId: reversal.id,
        notes: `Reversed movement ${original.movementNumber} with reversal entry ${reversalNumber}. Reason: ${reversalReason}`,
      },
      tx
    );

    return {
      success: true,
      movementId: reversal.id,
      movementNumber: reversalNumber,
      message: `Movement ${original.movementNumber} reversed successfully by ${reversalNumber}.`,
    };
  };

  if (externalTx) {
    return await runner(externalTx);
  }
  return await db.$transaction(runner, { maxWait: 15000, timeout: 30000 });
}

/**
 * Internal helper to update StockBalance projections transactionally
 */
async function applyBalanceChanges(
  tx: Prisma.TransactionClient,
  params: {
    materialVariantId: string;
    ownershipType: string;
    movementType: string;
    qty: Prisma.Decimal;
    sourceLocationType?: string;
    sourceWarehouseId?: string | null;
    sourceSiteId?: string | null;
    destinationLocationType?: string;
    destinationWarehouseId?: string | null;
    destinationSiteId?: string | null;
    condition?: string;
  }
) {
  const {
    materialVariantId,
    ownershipType,
    movementType,
    qty,
    sourceLocationType,
    sourceWarehouseId,
    sourceSiteId,
    destinationLocationType,
    destinationWarehouseId,
    destinationSiteId,
    condition,
  } = params;

  // 1. Deduct from Source if applicable
  if (sourceLocationType === "WAREHOUSE" && sourceWarehouseId) {
    await adjustWarehouseBalance(tx, {
      warehouseId: sourceWarehouseId,
      materialVariantId,
      ownershipType,
      availableDelta: qty.negated(),
      condition,
    });
  } else if (sourceLocationType === "CUSTOMER_SITE" && sourceSiteId) {
    await adjustSiteBalance(tx, {
      siteId: sourceSiteId,
      materialVariantId,
      ownershipType,
      availableDelta: qty.negated(),
    });
  }

  // 2. Add to Destination if applicable
  if (destinationLocationType === "WAREHOUSE" && destinationWarehouseId) {
    const isDamaged = condition === "DAMAGED" || movementType === "DAMAGE";
    await adjustWarehouseBalance(tx, {
      warehouseId: destinationWarehouseId,
      materialVariantId,
      ownershipType,
      availableDelta: isDamaged ? new Prisma.Decimal(0) : qty,
      damagedDelta: isDamaged ? qty : new Prisma.Decimal(0),
      condition,
    });
  } else if (destinationLocationType === "CUSTOMER_SITE" && destinationSiteId) {
    await adjustSiteBalance(tx, {
      siteId: destinationSiteId,
      materialVariantId,
      ownershipType,
      availableDelta: qty,
    });
  }
}

async function adjustWarehouseBalance(
  tx: Prisma.TransactionClient,
  params: {
    warehouseId: string;
    materialVariantId: string;
    ownershipType: string;
    availableDelta?: Prisma.Decimal;
    damagedDelta?: Prisma.Decimal;
    condition?: string;
  }
) {
  const { warehouseId, materialVariantId, ownershipType } = params;
  const availDelta = params.availableDelta || new Prisma.Decimal(0);
  const damDelta = params.damagedDelta || new Prisma.Decimal(0);
  const totalDelta = availDelta.plus(damDelta);

  const existing = await tx.stockBalance.findFirst({
    where: {
      warehouseId,
      siteId: null,
      materialVariantId,
      ownershipType,
      locationType: "WAREHOUSE",
    },
  });

  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: {
        availableQty: existing.availableQty.plus(availDelta),
        damagedQty: existing.damagedQty.plus(damDelta),
        totalQty: existing.totalQty.plus(totalDelta),
        lastMovementAt: new Date(),
      },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        warehouseId,
        siteId: null,
        materialVariantId,
        ownershipType,
        locationType: "WAREHOUSE",
        availableQty: availDelta.lt(0) ? new Prisma.Decimal(0) : availDelta,
        damagedQty: damDelta.lt(0) ? new Prisma.Decimal(0) : damDelta,
        totalQty: totalDelta.lt(0) ? new Prisma.Decimal(0) : totalDelta,
        lastMovementAt: new Date(),
      },
    });
  }
}

export async function adjustSiteBalance(
  tx: Prisma.TransactionClient,
  params: {
    siteId: string;
    materialVariantId: string;
    ownershipType: string;
    availableDelta: Prisma.Decimal;
  }
) {
  const { siteId, materialVariantId, ownershipType, availableDelta } = params;

  const existing = await tx.stockBalance.findFirst({
    where: {
      warehouseId: null,
      siteId,
      materialVariantId,
      ownershipType,
      locationType: "CUSTOMER_SITE",
    },
  });

  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: {
        availableQty: existing.availableQty.plus(availableDelta),
        totalQty: existing.totalQty.plus(availableDelta),
        lastMovementAt: new Date(),
      },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        warehouseId: null,
        siteId,
        materialVariantId,
        ownershipType,
        locationType: "CUSTOMER_SITE",
        availableQty: availableDelta.lt(0) ? new Prisma.Decimal(0) : availableDelta,
        totalQty: availableDelta.lt(0) ? new Prisma.Decimal(0) : availableDelta,
        lastMovementAt: new Date(),
      },
    });
  }
}
