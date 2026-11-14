import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { adjustSiteBalance } from "@/lib/inventory/ledger";

export interface OpeningStockItemInput {
  materialVariantId: string;
  ownershipType: "OWNED" | "HIRED_IN";
  locationType: "WAREHOUSE" | "CUSTOMER_SITE";
  warehouseId?: string | null;
  customerId?: string | null;
  customerSiteId?: string | null;
  quantity: number | string | Prisma.Decimal;
  uom?: string;
  condition?: "GOOD" | "DAMAGED";
  unitCost?: number | string | Prisma.Decimal | null;
  dailyRentalRate?: number | string | Prisma.Decimal | null;
  notes?: string | null;
}

export interface CreateOpeningStockBatchInput {
  title?: string;
  cutoverDate?: Date | string;
  notes?: string;
  supportingDocUrl?: string;
  items: OpeningStockItemInput[];
}

export interface CsvOpeningStockRow {
  materialCodeOrId: string;
  ownershipType: string;
  locationType: string;
  warehouseCodeOrId?: string;
  customerCodeOrId?: string;
  siteCodeOrId?: string;
  quantity: string;
  unitCost?: string;
  dailyRentalRate?: string;
  condition?: string;
  notes?: string;
}

export interface ImportPreviewResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  parsedItems: OpeningStockItemInput[];
  summary: {
    totalOwnedQty: string;
    totalHiredQty: string;
    totalOwnedValuation: string;
  };
}

/**
 * Parses and validates CSV rows for opening stock imports before saving.
 */
export async function previewOpeningStockCsv(
  rows: CsvOpeningStockRow[]
): Promise<ImportPreviewResult> {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const parsedItems: OpeningStockItemInput[] = [];

  let totalOwnedQty = new Prisma.Decimal(0);
  let totalHiredQty = new Prisma.Decimal(0);
  let totalOwnedValuation = new Prisma.Decimal(0);

  // Pre-fetch masters for validation
  const variants = await db.materialVariant.findMany({
    select: { id: true, materialCode: true, name: true, uom: true, defaultRentalRate: true, purchaseCost: true },
  });
  const variantMap = new Map<string, (typeof variants)[0]>();
  for (const v of variants) {
    variantMap.set(v.id, v);
    variantMap.set(v.materialCode.toUpperCase(), v);
  }

  const warehouses = await db.warehouse.findMany({ select: { id: true, warehouseCode: true } });
  const warehouseMap = new Map<string, string>();
  for (const w of warehouses) {
    warehouseMap.set(w.id, w.id);
    warehouseMap.set(w.warehouseCode.toUpperCase(), w.id);
  }

  const customers = await db.customer.findMany({ select: { id: true, customerCode: true } });
  const customerMap = new Map<string, string>();
  for (const c of customers) {
    customerMap.set(c.id, c.id);
    customerMap.set(c.customerCode.toUpperCase(), c.id);
  }

  const sites = await db.customerSite.findMany({ select: { id: true, siteCode: true, customerId: true } });
  const siteMap = new Map<string, (typeof sites)[0]>();
  for (const s of sites) {
    siteMap.set(s.id, s);
    siteMap.set(s.siteCode.toUpperCase(), s);
  }

  const duplicateKeySet = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const rowNum = idx + 1;
    const row = rows[idx];

    // Variant lookup
    const variantKey = (row.materialCodeOrId || "").trim().toUpperCase();
    const variant = variantMap.get(variantKey);
    if (!variant) {
      errors.push({ row: rowNum, field: "materialCodeOrId", message: `Material variant '${row.materialCodeOrId}' not found.` });
      continue;
    }

    // Ownership
    const ownership = (row.ownershipType || "OWNED").trim().toUpperCase();
    if (!["OWNED", "HIRED_IN"].includes(ownership)) {
      errors.push({ row: rowNum, field: "ownershipType", message: `Invalid ownershipType '${row.ownershipType}'. Must be OWNED or HIRED_IN.` });
      continue;
    }

    // Location
    const location = (row.locationType || "WAREHOUSE").trim().toUpperCase();
    if (!["WAREHOUSE", "CUSTOMER_SITE"].includes(location)) {
      errors.push({ row: rowNum, field: "locationType", message: `Invalid locationType '${row.locationType}'. Must be WAREHOUSE or CUSTOMER_SITE.` });
      continue;
    }

    let resolvedWarehouseId: string | null = null;
    let resolvedCustomerId: string | null = null;
    let resolvedSiteId: string | null = null;

    if (location === "WAREHOUSE") {
      const whKey = (row.warehouseCodeOrId || "").trim().toUpperCase();
      resolvedWarehouseId = warehouseMap.get(whKey) || null;
      if (!resolvedWarehouseId) {
        errors.push({ row: rowNum, field: "warehouseCodeOrId", message: `Warehouse '${row.warehouseCodeOrId}' is required for warehouse location and was not found.` });
        continue;
      }
    } else {
      const siteKey = (row.siteCodeOrId || "").trim().toUpperCase();
      const site = siteMap.get(siteKey);
      if (!site) {
        errors.push({ row: rowNum, field: "siteCodeOrId", message: `Customer site '${row.siteCodeOrId}' is required for site custody and was not found.` });
        continue;
      }
      resolvedSiteId = site.id;
      resolvedCustomerId = site.customerId;
    }

    // Quantity
    let qty: Prisma.Decimal;
    try {
      qty = new Prisma.Decimal(row.quantity || 0);
      if (qty.lte(0)) {
        errors.push({ row: rowNum, field: "quantity", message: "Quantity must be strictly greater than zero." });
        continue;
      }
    } catch {
      errors.push({ row: rowNum, field: "quantity", message: "Invalid decimal format for quantity." });
      continue;
    }

    // Unit Cost & Valuation (Rule: HIRED_IN must NEVER have asset valuation)
    let unitCost: Prisma.Decimal | null = null;
    let valuation: Prisma.Decimal = new Prisma.Decimal(0);

    if (ownership === "OWNED") {
      if (row.unitCost && row.unitCost.trim() !== "") {
        try {
          unitCost = new Prisma.Decimal(row.unitCost);
          if (unitCost.lt(0)) {
            errors.push({ row: rowNum, field: "unitCost", message: "Unit acquisition cost cannot be negative." });
            continue;
          }
          valuation = qty.times(unitCost);
        } catch {
          errors.push({ row: rowNum, field: "unitCost", message: "Invalid decimal format for unitCost." });
          continue;
        }
      } else if (variant.purchaseCost) {
        unitCost = new Prisma.Decimal(variant.purchaseCost);
        valuation = qty.times(unitCost);
      }
      totalOwnedQty = totalOwnedQty.plus(qty);
      totalOwnedValuation = totalOwnedValuation.plus(valuation);
    } else {
      // HIRED_IN: strictly null unitCost and 0 valuation
      unitCost = null;
      valuation = new Prisma.Decimal(0);
      totalHiredQty = totalHiredQty.plus(qty);
    }

    // Daily rental rate (optional for customer site initial batch)
    let dailyRate: Prisma.Decimal | null = null;
    if (row.dailyRentalRate && row.dailyRentalRate.trim() !== "") {
      try {
        dailyRate = new Prisma.Decimal(row.dailyRentalRate);
      } catch {
        // ignore or fallback to variant rate
      }
    }

    // Duplicate check within batch
    const dedupeKey = `${variant.id}:${ownership}:${location}:${resolvedWarehouseId || ""}:${resolvedSiteId || ""}`;
    if (duplicateKeySet.has(dedupeKey)) {
      errors.push({ row: rowNum, field: "materialCodeOrId", message: `Duplicate opening stock entry for variant '${variant.materialCode}', ${ownership}, at location.` });
      continue;
    }
    duplicateKeySet.add(dedupeKey);

    parsedItems.push({
      materialVariantId: variant.id,
      ownershipType: ownership as "OWNED" | "HIRED_IN",
      locationType: location as "WAREHOUSE" | "CUSTOMER_SITE",
      warehouseId: resolvedWarehouseId,
      customerId: resolvedCustomerId,
      customerSiteId: resolvedSiteId,
      quantity: qty,
      uom: variant.uom,
      condition: row.condition === "DAMAGED" ? "DAMAGED" : "GOOD",
      unitCost,
      dailyRentalRate: dailyRate,
      notes: row.notes || null,
    });
  }

  return {
    isValid: errors.length === 0,
    totalRows: rows.length,
    validRows: parsedItems.length,
    invalidRows: errors.length,
    errors,
    parsedItems,
    summary: {
      totalOwnedQty: totalOwnedQty.toFixed(3),
      totalHiredQty: totalHiredQty.toFixed(3),
      totalOwnedValuation: totalOwnedValuation.toFixed(2),
    },
  };
}

/**
 * Creates an Opening Stock Cutover Batch in DRAFT state.
 */
export async function createOpeningStockBatch(
  input: CreateOpeningStockBatchInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!input.items || input.items.length === 0) {
    throw new Error("Opening stock batch must contain at least one material line item.");
  }

  const batchNumber = await generateNextDocumentNumber("OSB");
  let totalOwnedQty = new Prisma.Decimal(0);
  let totalHiredQty = new Prisma.Decimal(0);
  let totalOwnedValuation = new Prisma.Decimal(0);

  const dedupeSet = new Set<string>();

  const itemData: Array<{
    materialVariantId: string;
    ownershipType: string;
    locationType: string;
    warehouseId: string | null;
    customerId: string | null;
    customerSiteId: string | null;
    quantity: Prisma.Decimal;
    uom: string;
    condition: string;
    unitCost: Prisma.Decimal | null;
    totalValuation: Prisma.Decimal;
    dailyRentalRate: Prisma.Decimal | null;
    notes: string | null;
  }> = [];

  for (const it of input.items) {
    const qty = new Prisma.Decimal(it.quantity);
    if (qty.lte(0)) {
      throw new Error(`Quantity for material ${it.materialVariantId} must be greater than zero.`);
    }

    const ownership = it.ownershipType || "OWNED";
    const location = it.locationType || "WAREHOUSE";

    if (location === "WAREHOUSE" && !it.warehouseId) {
      throw new Error(`Warehouse ID is required for warehouse-held opening stock.`);
    }
    if (location === "CUSTOMER_SITE" && (!it.customerSiteId || !it.customerId)) {
      throw new Error(`Customer ID and Site ID are required for customer-held opening stock.`);
    }

    const dedupeKey = `${it.materialVariantId}:${ownership}:${location}:${it.warehouseId || ""}:${it.customerSiteId || ""}`;
    if (dedupeSet.has(dedupeKey)) {
      throw new Error(`Duplicate line item found for material variant '${it.materialVariantId}' at specified location and ownership.`);
    }
    dedupeSet.add(dedupeKey);

    let unitCost: Prisma.Decimal | null = null;
    let valuation = new Prisma.Decimal(0);

    if (ownership === "OWNED") {
      if (it.unitCost !== undefined && it.unitCost !== null) {
        unitCost = new Prisma.Decimal(it.unitCost);
        valuation = qty.times(unitCost);
      }
      totalOwnedQty = totalOwnedQty.plus(qty);
      totalOwnedValuation = totalOwnedValuation.plus(valuation);
    } else {
      // HIRED_IN: strictly no valuation
      unitCost = null;
      valuation = new Prisma.Decimal(0);
      totalHiredQty = totalHiredQty.plus(qty);
    }

    itemData.push({
      materialVariantId: it.materialVariantId,
      ownershipType: ownership,
      locationType: location,
      warehouseId: it.warehouseId || null,
      customerId: it.customerId || null,
      customerSiteId: it.customerSiteId || null,
      quantity: qty,
      uom: it.uom || "Nos.",
      condition: it.condition || "GOOD",
      unitCost,
      totalValuation: valuation,
      dailyRentalRate: it.dailyRentalRate ? new Prisma.Decimal(it.dailyRentalRate) : null,
      notes: it.notes || null,
    });
  }

  const batch = await db.openingStockBatch.create({
    data: {
      batchNumber,
      title: input.title || "Initial Cutover Stock Entry",
      cutoverDate: input.cutoverDate ? new Date(input.cutoverDate) : new Date(),
      status: "DRAFT",
      notes: input.notes || null,
      supportingDocUrl: input.supportingDocUrl || null,
      totalItems: itemData.length,
      totalOwnedQty,
      totalHiredQty,
      totalOwnedValuation,
      preparedById: actor.id,
      items: {
        create: itemData,
      },
    },
    include: {
      items: {
        include: {
          materialVariant: true,
          warehouse: true,
          customer: true,
          customerSite: true,
        },
      },
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "inventory",
    entityType: "OpeningStockBatch",
    entityId: batch.id,
    afterState: { batchNumber, totalItems: itemData.length, totalValuation: totalOwnedValuation.toString() },
    notes: `Created draft opening stock batch ${batchNumber} with ${itemData.length} items.`,
  });

  return batch;
}

/**
 * Approves an Opening Stock Batch (Requires OWNER, ADMINISTRATOR, or WAREHOUSE_MANAGER).
 */
export async function approveOpeningStockBatch(
  batchId: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!["OWNER", "ADMINISTRATOR", "ADMIN", "WAREHOUSE_MANAGER"].includes(actor.role)) {
    throw new Error(`Unauthorized: Role '${actor.role}' cannot approve opening stock batches.`);
  }

  const batch = await db.openingStockBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    throw new Error(`Opening stock batch '${batchId}' not found.`);
  }

  if (batch.status === "POSTED") {
    throw new Error(`Cannot approve already POSTED batch '${batch.batchNumber}'.`);
  }

  const updated = await db.openingStockBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
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
    module: "inventory",
    entityType: "OpeningStockBatch",
    entityId: batch.id,
    notes: `Approved opening stock batch ${batch.batchNumber}`,
  });

  return updated;
}

/**
 * Atomically posts an Opening Stock Batch:
 * 1. Generates auditable InventoryMovement records with movementType: "OPENING_STOCK".
 * 2. Updates StockBalance records.
 * 3. For CUSTOMER_SITE custody items, creates active RentalBatch records.
 * 4. Locks the batch as POSTED.
 */
export async function postOpeningStockBatch(
  batchId: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(actor.role)) {
    throw new Error(`Unauthorized: Posting opening stock requires Owner or Administrator role.`);
  }

  return await db.$transaction(async (tx) => {
    const batch = await tx.openingStockBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            materialVariant: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`Opening stock batch '${batchId}' not found.`);
    }

    if (batch.status === "POSTED") {
      throw new Error(`Batch '${batch.batchNumber}' has already been posted to the inventory ledger.`);
    }

    for (const item of batch.items) {
      const mvNumber = await generateNextDocumentNumber("MV");
      const isDamaged = item.condition === "DAMAGED";
      const qty = new Prisma.Decimal(item.quantity);

      // 1. Create Immutable Inventory Movement
      const movement = await tx.inventoryMovement.create({
        data: {
          movementNumber: mvNumber,
          materialVariantId: item.materialVariantId,
          quantity: qty,
          uom: item.uom,
          ownershipType: item.ownershipType,
          movementType: "OPENING_STOCK",
          movementDate: batch.cutoverDate,
          sourceLocationType: "NONE",
          destinationLocationType: item.locationType,
          destinationWarehouseId: item.warehouseId,
          destinationSiteId: item.customerSiteId,
          customerId: item.customerId,
          referenceDocumentType: "OPENING_STOCK",
          referenceDocumentId: batch.batchNumber,
          condition: item.condition,
          unitCost: item.unitCost,
          replacementValue: item.materialVariant.replacementValue,
          responsibleUserId: actor.id,
          approvedById: actor.id,
          approvedAt: new Date(),
          status: "POSTED",
          postedAt: new Date(),
          notes: `Opening stock cutover batch ${batch.batchNumber}. ${item.notes || ""}`,
        },
      });

      // 2. Update StockBalance projections atomically
      if (item.locationType === "WAREHOUSE" && item.warehouseId) {
        const existingBalance = await tx.stockBalance.findFirst({
          where: {
            warehouseId: item.warehouseId,
            siteId: null,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            locationType: "WAREHOUSE",
          },
        });

        if (existingBalance) {
          await tx.stockBalance.update({
            where: { id: existingBalance.id },
            data: {
              availableQty: isDamaged ? existingBalance.availableQty : existingBalance.availableQty.plus(qty),
              damagedQty: isDamaged ? existingBalance.damagedQty.plus(qty) : existingBalance.damagedQty,
              totalQty: existingBalance.totalQty.plus(qty),
              lastMovementAt: batch.cutoverDate,
            },
          });
        } else {
          await tx.stockBalance.create({
            data: {
              warehouseId: item.warehouseId,
              siteId: null,
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              locationType: "WAREHOUSE",
              availableQty: isDamaged ? new Prisma.Decimal(0) : qty,
              damagedQty: isDamaged ? qty : new Prisma.Decimal(0),
              totalQty: qty,
              lastMovementAt: batch.cutoverDate,
            },
          });
        }
      } else if (item.locationType === "CUSTOMER_SITE" && item.customerSiteId) {
        // Customer Site Stock
        await adjustSiteBalance(tx, {
          siteId: item.customerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          availableDelta: qty,
        });

        // 3. Create Active RentalBatch for initial rental custody tracking
        const rbNumber = await generateNextDocumentNumber("RB");
        const dailyRate =
          item.dailyRentalRate ||
          item.materialVariant.defaultRentalRate ||
          new Prisma.Decimal(0);

        const rentalBatch = await tx.rentalBatch.create({
          data: {
            batchNumber: rbNumber,
            customerId: item.customerId!,
            customerSiteId: item.customerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            deliveryDate: batch.cutoverDate,
            includeDeliveryDate: true,
            deliveredQty: qty,
            returnedQty: new Prisma.Decimal(0),
            damagedQty: new Prisma.Decimal(0),
            missingQty: new Prisma.Decimal(0),
            currentHeldQty: qty,
            applicableDailyRate: dailyRate,
            status: "ACTIVE",
          },
        });

        // Link RentalBatch to OpeningStockItem
        await tx.openingStockItem.update({
          where: { id: item.id },
          data: {
            rentalBatchId: rentalBatch.id,
            inventoryMovementId: movement.id,
            status: "POSTED",
          },
        });
      } else {
        await tx.openingStockItem.update({
          where: { id: item.id },
          data: {
            inventoryMovementId: movement.id,
            status: "POSTED",
          },
        });
      }
    }

    // 4. Update Batch status to POSTED
    const postedBatch = await tx.openingStockBatch.update({
      where: { id: batchId },
      data: {
        status: "POSTED",
        postedById: actor.id,
        postedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    // 5. Audit Logging
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "POST",
      module: "inventory",
      entityType: "OpeningStockBatch",
      entityId: batch.id,
      notes: `Posted opening stock batch ${batch.batchNumber} with ${batch.items.length} items. Total Owned Valuation: Rs. ${batch.totalOwnedValuation.toString()}`,
    });

    return postedBatch;
  });
}
