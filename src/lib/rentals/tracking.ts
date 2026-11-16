import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";

/**
 * Synchronizes/creates RentalBatch records from a posted Delivery Note.
 * Ensures historical rate preservation and independent delivery date rule retention.
 */
export async function syncRentalBatchesFromDelivery(
  deliveryNoteId: string,
  externalTx?: Prisma.TransactionClient
): Promise<void> {
  const runner = externalTx || db;

  const dn = await runner.deliveryNote.findUnique({
    where: { id: deliveryNoteId },
    include: {
      items: {
        include: {
          materialVariant: true,
        },
      },
      customerSite: true,
    },
  });

  if (!dn) {
    throw new Error(`Delivery Note '${deliveryNoteId}' not found.`);
  }

  // Look for any active agreement for this site to fallback rates if not set on line item
  const activeAgreement = await runner.rentalAgreement.findFirst({
    where: {
      customerId: dn.customerId,
      customerSiteId: dn.customerSiteId,
      status: "ACTIVE",
    },
    include: {
      items: true,
    },
  });

  for (const item of dn.items) {
    // Check if batch already created
    const existing = await runner.rentalBatch.findFirst({
      where: {
        deliveryNoteItemId: item.id,
      },
    });

    if (existing) continue;

    // Rate resolution precedence: Line Item dailyRate > Active Agreement rate > Variant Master defaultDailyRate
    let rate = item.dailyRate ? new Prisma.Decimal(item.dailyRate) : null;

    if (!rate && activeAgreement) {
      const agrItem = activeAgreement.items.find(
        (ai) => ai.materialVariantId === item.materialVariantId
      );
      if (agrItem) {
        rate = new Prisma.Decimal(agrItem.agreedDailyRate);
      }
    }

    if (!rate) {
      rate = new Prisma.Decimal(item.materialVariant.defaultRentalRate || 0);
    }

    const batchNumber = await generateNextDocumentNumber("RB", undefined, externalTx);

    await runner.rentalBatch.create({
      data: {
        batchNumber,
        customerId: dn.customerId,
        customerSiteId: dn.customerSiteId,
        materialVariantId: item.materialVariantId,
        ownershipType: item.ownershipType || "OWNED",
        deliveryNoteId: dn.id,
        deliveryNoteItemId: item.id,
        deliveryDate: dn.deliveryDate,
        includeDeliveryDate: (dn as any).includeDeliveryDate ?? true,
        deliveredQty: item.quantity,
        returnedQty: new Prisma.Decimal(0),
        damagedQty: new Prisma.Decimal(0),
        missingQty: new Prisma.Decimal(0),
        currentHeldQty: item.quantity,
        applicableDailyRate: rate,
        status: "ACTIVE",
      },
    });
  }
}

/**
 * Allocates returned quantities from a posted Material Return Note (MRN)
 * to open rental batches in chronological FIFO order.
 * Preserves independent includeReturnDate flags on each allocation.
 */
export async function allocateReturnToBatches(
  materialReturnNoteId: string,
  externalTx?: Prisma.TransactionClient
): Promise<void> {
  const runner = externalTx || db;

  const mrn = await runner.materialReturnNote.findUnique({
    where: { id: materialReturnNoteId },
    include: {
      items: true,
    },
  });

  if (!mrn) {
    throw new Error(`Material Return Note '${materialReturnNoteId}' not found.`);
  }

  for (const item of mrn.items) {
    // Total reduction = accepted + damaged + missing
    let unallocatedReturned = new Prisma.Decimal(item.returnedQty);
    let unallocatedAccepted = new Prisma.Decimal(item.acceptedQty);
    let unallocatedDamaged = new Prisma.Decimal(item.damagedQty || 0);
    let unallocatedMissing = new Prisma.Decimal(item.missingQty || 0);

    // Find active batches for this material variant and ownership pool at this site (FIFO by deliveryDate)
    const openBatches = await runner.rentalBatch.findMany({
      where: {
        customerId: mrn.customerId,
        customerSiteId: mrn.customerSiteId,
        materialVariantId: item.materialVariantId,
        ownershipType: item.ownershipType || "OWNED",
        currentHeldQty: { gt: 0 },
      },
      orderBy: {
        deliveryDate: "asc",
      },
    });

    for (const batch of openBatches) {
      if (unallocatedReturned.lte(0)) break;

      const held = new Prisma.Decimal(batch.currentHeldQty);
      if (held.lte(0)) continue;

      // Determine how much this batch can absorb
      const allocReturn = unallocatedReturned.gt(held) ? held : unallocatedReturned;
      const allocAccepted = unallocatedAccepted.gt(allocReturn) ? allocReturn : unallocatedAccepted;
      const allocDamaged = unallocatedDamaged.gt(allocReturn.minus(allocAccepted))
        ? allocReturn.minus(allocAccepted)
        : unallocatedDamaged;
      const allocMissing = allocReturn.minus(allocAccepted).minus(allocDamaged);

      // Create return allocation record
      await runner.rentalReturnAllocation.create({
        data: {
          rentalBatchId: batch.id,
          materialReturnNoteId: mrn.id,
          materialReturnNoteItemId: item.id,
          returnDate: mrn.returnDate,
          includeReturnDate: (mrn as any).includeReturnDate ?? false,
          allocatedReturnedQty: allocReturn,
          allocatedAcceptedQty: allocAccepted,
          allocatedDamagedQty: allocDamaged,
          allocatedMissingQty: allocMissing,
        },
      });

      // Update batch balances
      const newReturned = new Prisma.Decimal(batch.returnedQty).plus(allocReturn);
      const newDamaged = new Prisma.Decimal(batch.damagedQty).plus(allocDamaged);
      const newMissing = new Prisma.Decimal(batch.missingQty).plus(allocMissing);
      const newHeld = held.minus(allocReturn);

      await runner.rentalBatch.update({
        where: { id: batch.id },
        data: {
          returnedQty: newReturned,
          damagedQty: newDamaged,
          missingQty: newMissing,
          currentHeldQty: newHeld.lt(0) ? new Prisma.Decimal(0) : newHeld,
          status: newHeld.lte(0) ? "CLOSED" : "ACTIVE",
        },
      });

      unallocatedReturned = unallocatedReturned.minus(allocReturn);
      unallocatedAccepted = unallocatedAccepted.minus(allocAccepted);
      unallocatedDamaged = unallocatedDamaged.minus(allocDamaged);
      unallocatedMissing = unallocatedMissing.minus(allocMissing);
    }
  }
}

/**
 * Reconciles customer site rental held quantities against physical StockBalance in Supabase.
 */
export async function reconcileSiteRentalBalances(customerSiteId: string) {
  const [batches, physicalStock] = await Promise.all([
    db.rentalBatch.findMany({
      where: {
        customerSiteId,
        currentHeldQty: { gt: 0 },
      },
      include: {
        materialVariant: {
          select: { id: true, name: true, materialCode: true, uom: true },
        },
      },
    }),
    db.stockBalance.findMany({
      where: {
        siteId: customerSiteId,
        locationType: "CUSTOMER_SITE",
      },
      include: {
        materialVariant: {
          select: { id: true, name: true, materialCode: true, uom: true },
        },
      },
    }),
  ]);

  // Aggregate batch totals by materialVariantId & ownershipType
  const rentalHeldMap = new Map<string, { qty: Prisma.Decimal; name: string; code: string; uom: string }>();

  for (const b of batches) {
    const key = `${b.materialVariantId}:${b.ownershipType}`;
    const curr = rentalHeldMap.get(key) || {
      qty: new Prisma.Decimal(0),
      name: b.materialVariant.name,
      code: b.materialVariant.materialCode,
      uom: b.materialVariant.uom,
    };
    curr.qty = curr.qty.plus(b.currentHeldQty);
    rentalHeldMap.set(key, curr);
  }

  // Compare with physicalStock
  const physicalMap = new Map<string, Prisma.Decimal>();
  for (const s of physicalStock) {
    const key = `${s.materialVariantId}:${s.ownershipType}`;
    physicalMap.set(key, new Prisma.Decimal(s.availableQty));
  }

  const allKeys = new Set([...rentalHeldMap.keys(), ...physicalMap.keys()]);
  const comparison: Array<{
    materialVariantId: string;
    ownershipType: string;
    name: string;
    code: string;
    rentalHeldQty: string;
    physicalStockQty: string;
    variance: string;
    isBalanced: boolean;
  }> = [];

  for (const key of allKeys) {
    const [variantId, ownership] = key.split(":");
    const r = rentalHeldMap.get(key);
    const rentalQty = r?.qty || new Prisma.Decimal(0);
    const physicalQty = physicalMap.get(key) || new Prisma.Decimal(0);
    const diff = rentalQty.minus(physicalQty);

    comparison.push({
      materialVariantId: variantId,
      ownershipType: ownership,
      name: r?.name || "Unknown",
      code: r?.code || "Unknown",
      rentalHeldQty: rentalQty.toString(),
      physicalStockQty: physicalQty.toString(),
      variance: diff.toString(),
      isBalanced: diff.isZero(),
    });
  }

  return {
    customerSiteId,
    timestamp: new Date().toISOString(),
    isFullyBalanced: comparison.every((c) => c.isBalanced),
    comparison,
  };
}
