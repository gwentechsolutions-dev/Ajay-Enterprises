import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface InventoryReportFilters {
  warehouseId?: string;
  materialVariantId?: string;
  materialCategoryId?: string;
  ownershipType?: "OWNED" | "HIRED_IN" | "ALL";
  startDate?: string | Date;
  endDate?: string | Date;
}

export async function getInventoryReportsData(filters?: InventoryReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    stockSummary,
    warehouseWiseStock,
    siteWiseStock,
    recentMovements,
    damageRegister,
    missingRegister,
    scrapRegister,
    repairCostAnalysis,
    stockAuditDifferences,
    ownershipAnalysis,
    damageIntelligence,
    inventoryValuation,
  ] = await Promise.all([
    getStockSummary(filters),
    getWarehouseWiseStock(filters),
    getSiteWiseStockCustody(filters),
    getMaterialMovementRegister(start, end, filters),
    getDamagedMaterialRegister(start, end, filters),
    getMissingMaterialRegister(start, end),
    getScrapRegister(start, end),
    getMaterialRepairCostAnalysis(start, end),
    getStockAuditDifferences(),
    getOwnershipAnalysis(filters),
    getMaterialLossAndDamageIntelligence(start, end),
    getInventoryValuationReport(filters),
  ]);

  return {
    stockSummary,
    warehouseWiseStock,
    siteWiseStock,
    recentMovements,
    damageRegister,
    missingRegister,
    scrapRegister,
    repairCostAnalysis,
    stockAuditDifferences,
    ownershipAnalysis,
    damageIntelligence,
    inventoryValuation,
  };
}

async function getStockSummary(filters?: InventoryReportFilters) {
  const balances = await db.stockBalance.findMany({
    where: {
      warehouseId: { not: null },
      ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      ...(filters?.ownershipType && filters.ownershipType !== "ALL" ? { ownershipType: filters.ownershipType } : {}),
    },
    include: {
      materialVariant: {
        include: {
          materialType: {
            include: { category: true },
          },
        },
      },
      warehouse: { select: { name: true, warehouseCode: true } },
    },
  });

  const summaryMap: Record<string, {
    variantId: string;
    variantName: string;
    variantCode: string;
    categoryName: string;
    typeName: string;
    uom: string;
    ownedTotal: Prisma.Decimal;
    ownedAvailable: Prisma.Decimal;
    ownedDamaged: Prisma.Decimal;
    hiredTotal: Prisma.Decimal;
    hiredAvailable: Prisma.Decimal;
    hiredDamaged: Prisma.Decimal;
  }> = {};

  for (const b of balances) {
    const vId = b.materialVariantId;
    if (!summaryMap[vId]) {
      summaryMap[vId] = {
        variantId: vId,
        variantName: b.materialVariant.name,
        variantCode: b.materialVariant.materialCode,
        categoryName: b.materialVariant.materialType.category.name,
        typeName: b.materialVariant.materialType.name,
        uom: b.materialVariant.uom,
        ownedTotal: new Prisma.Decimal(0),
        ownedAvailable: new Prisma.Decimal(0),
        ownedDamaged: new Prisma.Decimal(0),
        hiredTotal: new Prisma.Decimal(0),
        hiredAvailable: new Prisma.Decimal(0),
        hiredDamaged: new Prisma.Decimal(0),
      };
    }

    const isOwned = b.ownershipType === "OWNED";
    const total = new Prisma.Decimal(b.totalQty);
    const avail = new Prisma.Decimal(b.availableQty);
    const dmg = new Prisma.Decimal(b.damagedQty);

    if (isOwned) {
      summaryMap[vId].ownedTotal = summaryMap[vId].ownedTotal.plus(total);
      summaryMap[vId].ownedAvailable = summaryMap[vId].ownedAvailable.plus(avail);
      summaryMap[vId].ownedDamaged = summaryMap[vId].ownedDamaged.plus(dmg);
    } else {
      summaryMap[vId].hiredTotal = summaryMap[vId].hiredTotal.plus(total);
      summaryMap[vId].hiredAvailable = summaryMap[vId].hiredAvailable.plus(avail);
      summaryMap[vId].hiredDamaged = summaryMap[vId].hiredDamaged.plus(dmg);
    }
  }

  return Object.values(summaryMap);
}

async function getWarehouseWiseStock(filters?: InventoryReportFilters) {
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      ...(filters?.warehouseId ? { id: filters.warehouseId } : {}),
    },
    include: {
      stockBalances: {
        where: {
          ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
        },
        select: {
          ownershipType: true,
          totalQty: true,
          availableQty: true,
          damagedQty: true,
        },
      },
    },
  });

  return warehouses.map((w) => {
    let ownedAvail = new Prisma.Decimal(0);
    let ownedDmg = new Prisma.Decimal(0);
    let hiredAvail = new Prisma.Decimal(0);
    let hiredDmg = new Prisma.Decimal(0);

    for (const sb of w.stockBalances) {
      if (sb.ownershipType === "OWNED") {
        ownedAvail = ownedAvail.plus(new Prisma.Decimal(sb.availableQty));
        ownedDmg = ownedDmg.plus(new Prisma.Decimal(sb.damagedQty));
      } else {
        hiredAvail = hiredAvail.plus(new Prisma.Decimal(sb.availableQty));
        hiredDmg = hiredDmg.plus(new Prisma.Decimal(sb.damagedQty));
      }
    }

    return {
      warehouseId: w.id,
      name: w.name,
      code: w.warehouseCode,
      city: w.city,
      ownedAvailable: ownedAvail,
      ownedDamaged: ownedDmg,
      hiredAvailable: hiredAvail,
      hiredDamaged: hiredDmg,
      totalAvailable: ownedAvail.plus(hiredAvail),
    };
  });
}

async function getSiteWiseStockCustody(filters?: InventoryReportFilters) {
  const batches = await db.rentalBatch.findMany({
    where: {
      status: "ACTIVE",
      currentHeldQty: { gt: 0 },
      ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
    },
    include: {
      customer: { select: { name: true } },
      customerSite: { select: { siteName: true, siteCode: true } },
      materialVariant: { select: { name: true, materialCode: true } },
    },
  });

  const siteMap: Record<string, {
    siteId: string;
    siteName: string;
    siteCode: string;
    customerName: string;
    ownedHeld: Prisma.Decimal;
    hiredHeld: Prisma.Decimal;
    totalHeld: Prisma.Decimal;
    variantsCount: number;
  }> = {};

  for (const b of batches) {
    const sId = b.customerSiteId;
    if (!siteMap[sId]) {
      siteMap[sId] = {
        siteId: sId,
        siteName: b.customerSite.siteName,
        siteCode: b.customerSite.siteCode,
        customerName: b.customer.name,
        ownedHeld: new Prisma.Decimal(0),
        hiredHeld: new Prisma.Decimal(0),
        totalHeld: new Prisma.Decimal(0),
        variantsCount: 0,
      };
    }

    const qty = new Prisma.Decimal(b.currentHeldQty);
    if (b.ownershipType === "OWNED") {
      siteMap[sId].ownedHeld = siteMap[sId].ownedHeld.plus(qty);
    } else {
      siteMap[sId].hiredHeld = siteMap[sId].hiredHeld.plus(qty);
    }
    siteMap[sId].totalHeld = siteMap[sId].totalHeld.plus(qty);
    siteMap[sId].variantsCount += 1;
  }

  return Object.values(siteMap).sort((a, b) => b.totalHeld.minus(a.totalHeld).toNumber());
}

async function getMaterialMovementRegister(start: Date, end: Date, filters?: InventoryReportFilters) {
  const movements = await db.inventoryMovement.findMany({
    where: {
      movementDate: { gte: start, lte: end },
      ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      ...(filters?.ownershipType && filters.ownershipType !== "ALL" ? { ownershipType: filters.ownershipType } : {}),
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      sourceWarehouse: { select: { name: true } },
      destinationWarehouse: { select: { name: true } },
      customer: { select: { name: true } },
      sourceSite: { select: { siteName: true } },
      destinationSite: { select: { siteName: true } },
    },
    take: 50,
    orderBy: { movementDate: "desc" },
  });

  return movements.map((m) => ({
    id: m.id,
    movementType: m.movementType,
    movementDate: m.movementDate,
    ownershipType: m.ownershipType,
    quantity: m.quantity,
    variantName: m.materialVariant.name,
    variantCode: m.materialVariant.materialCode,
    source: m.sourceWarehouse?.name || m.sourceSite?.siteName || m.customer?.name || "Yard",
    destination: m.destinationWarehouse?.name || m.destinationSite?.siteName || "Yard",
    referenceDocumentType: m.referenceDocumentType,
    referenceDocumentId: m.referenceDocumentId,
  }));
}

async function getDamagedMaterialRegister(start: Date, end: Date, filters?: InventoryReportFilters) {
  const assessments = await db.damageLossAssessment.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      assessmentType: { in: ["DAMAGED_REPAIRABLE", "DAMAGED_SCRAP"] },
      ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      customer: { select: { name: true } },
      customerSite: { select: { siteName: true } },
    },
    take: 30,
    orderBy: { createdAt: "desc" },
  });

  return assessments.map((a) => ({
    id: a.id,
    assessmentNumber: a.assessmentNumber,
    createdAt: a.createdAt,
    damageType: a.assessmentType,
    quantity: a.quantity,
    assessedCost: a.approvedChargeAmount,
    billedAmount: a.approvedChargeAmount,
    status: a.status,
    variantName: a.materialVariant.name,
    customerName: a.customer?.name || "Direct / Yard",
    siteName: a.customerSite?.siteName || "N/A",
  }));
}

async function getMissingMaterialRegister(start: Date, end: Date) {
  const missing = await db.damageLossAssessment.findMany({
    where: {
      assessmentType: "MISSING",
      createdAt: { gte: start, lte: end },
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      customer: { select: { name: true } },
      customerSite: { select: { siteName: true } },
    },
    take: 30,
    orderBy: { createdAt: "desc" },
  });

  let totalQty = new Prisma.Decimal(0);
  let totalAssessedCost = new Prisma.Decimal(0);

  for (const m of missing) {
    totalQty = totalQty.plus(new Prisma.Decimal(m.quantity));
    totalAssessedCost = totalAssessedCost.plus(new Prisma.Decimal(m.approvedChargeAmount || 0));
  }

  return {
    totalMissingQuantity: totalQty,
    totalAssessedCost,
    records: missing.map((m) => ({
      id: m.id,
      assessmentNumber: m.assessmentNumber,
      createdAt: m.createdAt,
      quantity: m.quantity,
      assessedCost: m.approvedChargeAmount,
      status: m.status,
      variantName: m.materialVariant.name,
      customerName: m.customer?.name || "N/A",
      siteName: m.customerSite?.siteName || "N/A",
    })),
  };
}

async function getScrapRegister(start: Date, end: Date) {
  const scrapJobs = await db.materialRepairJob.findMany({
    where: {
      scrappedQuantity: { gt: 0 },
      updatedAt: { gte: start, lte: end },
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      warehouse: { select: { name: true } },
    },
    take: 30,
    orderBy: { updatedAt: "desc" },
  });

  let totalScrappedQty = new Prisma.Decimal(0);

  for (const s of scrapJobs) {
    totalScrappedQty = totalScrappedQty.plus(new Prisma.Decimal(s.scrappedQuantity));
  }

  return {
    totalScrappedQuantity: totalScrappedQty,
    records: scrapJobs.map((s) => ({
      id: s.id,
      jobCode: s.jobCode,
      scrappedQuantity: s.scrappedQuantity,
      warehouseName: s.warehouse.name,
      variantName: s.materialVariant.name,
      status: s.status,
      updatedAt: s.updatedAt,
    })),
  };
}

async function getMaterialRepairCostAnalysis(start: Date, end: Date) {
  const jobs = await db.materialRepairJob.findMany({
    where: {
      updatedAt: { gte: start, lte: end },
    },
    include: {
      materialVariant: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  let totalPartsCost = new Prisma.Decimal(0);
  let totalLabourCost = new Prisma.Decimal(0);

  for (const j of jobs) {
    totalPartsCost = totalPartsCost.plus(new Prisma.Decimal(j.partsCost || 0));
    totalLabourCost = totalLabourCost.plus(new Prisma.Decimal(j.labourCost || 0));
  }

  return {
    totalRepairJobs: jobs.length,
    totalPartsCost,
    totalLabourCost,
    totalRepairCost: totalPartsCost.plus(totalLabourCost),
  };
}

async function getStockAuditDifferences() {
  const auditItems = await db.stockAuditItem.findMany({
    where: {
      differenceQty: { not: 0 },
    },
    include: {
      stockAudit: { select: { auditNumber: true, status: true, auditDate: true, warehouse: { select: { name: true } } } },
      materialVariant: { select: { name: true, materialCode: true } },
    },
    take: 30,
    orderBy: { createdAt: "desc" },
  });

  return auditItems.map((ai) => ({
    id: ai.id,
    auditNumber: ai.stockAudit.auditNumber,
    auditDate: ai.stockAudit.auditDate,
    warehouseName: ai.stockAudit.warehouse.name,
    variantName: ai.materialVariant.name,
    systemQuantity: ai.expectedQty,
    countedQuantity: ai.physicalQty,
    discrepancyQuantity: ai.differenceQty,
    status: ai.stockAudit.status,
  }));
}

async function getOwnershipAnalysis(filters?: InventoryReportFilters) {
  const [ownedAgg, hiredAgg] = await Promise.all([
    db.stockBalance.aggregate({
      _sum: { totalQty: true, availableQty: true, damagedQty: true },
      where: {
        ownershipType: "OWNED",
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
    db.stockBalance.aggregate({
      _sum: { totalQty: true, availableQty: true, damagedQty: true },
      where: {
        ownershipType: "HIRED_IN",
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
  ]);

  return {
    owned: {
      total: ownedAgg._sum.totalQty || new Prisma.Decimal(0),
      available: ownedAgg._sum.availableQty || new Prisma.Decimal(0),
      damaged: ownedAgg._sum.damagedQty || new Prisma.Decimal(0),
    },
    hiredIn: {
      total: hiredAgg._sum.totalQty || new Prisma.Decimal(0),
      available: hiredAgg._sum.availableQty || new Prisma.Decimal(0),
      damaged: hiredAgg._sum.damagedQty || new Prisma.Decimal(0),
    },
  };
}

/**
 * D1. Material Loss and Damage Intelligence
 */
async function getMaterialLossAndDamageIntelligence(start: Date, end: Date) {
  const [frequentDamages, customerDamages] = await Promise.all([
    db.damageLossAssessment.groupBy({
      by: ["materialVariantId"],
      _count: { id: true },
      _sum: { quantity: true, approvedChargeAmount: true },
      where: {
        createdAt: { gte: start, lte: end },
      },
    }),
    db.damageLossAssessment.groupBy({
      by: ["customerId"],
      _count: { id: true },
      _sum: { quantity: true, approvedChargeAmount: true },
      where: {
        createdAt: { gte: start, lte: end },
      },
    }),
  ]);

  const variantIds = frequentDamages.map((f) => f.materialVariantId);
  const variants = await db.materialVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, name: true, materialCode: true },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const customerIds = customerDamages.map((c) => c.customerId);
  const customers = await db.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, customerCode: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const topDamagedMaterials = frequentDamages.map((f) => {
    const v = variantMap.get(f.materialVariantId);
    return {
      variantId: f.materialVariantId,
      variantName: v?.name || "Unknown Variant",
      variantCode: v?.materialCode || "N/A",
      incidentsCount: f._count.id,
      totalQuantity: f._sum.quantity || new Prisma.Decimal(0),
      totalAssessedCost: f._sum.approvedChargeAmount || new Prisma.Decimal(0),
    };
  }).sort((a, b) => Number(b.totalQuantity) - Number(a.totalQuantity)).slice(0, 10);

  const customerDamageHistory = customerDamages.map((c) => {
    const cust = customerMap.get(c.customerId);
    return {
      customerId: c.customerId,
      customerName: cust?.name || "Direct Customer",
      customerCode: cust?.customerCode || "N/A",
      incidentsCount: c._count.id,
      damagedQuantity: c._sum.quantity || new Prisma.Decimal(0),
      assessedCost: c._sum.approvedChargeAmount || new Prisma.Decimal(0),
      billedAmount: c._sum.approvedChargeAmount || new Prisma.Decimal(0),
    };
  }).sort((a, b) => Number(b.damagedQuantity) - Number(a.damagedQuantity)).slice(0, 10);

  return {
    topDamagedMaterials,
    customerDamageHistory,
  };
}

export interface InventoryValuationReport {
  asOfDate: Date;
  totalOwnedQty: Prisma.Decimal;
  totalOwnedValuation: Prisma.Decimal;
  totalOwnedVariants: number;
  valuedOwnedVariantsCount: number;
  unvaluedOwnedVariantsCount: number;
  hiredInTotalQty: Prisma.Decimal;
  status: "FULLY_VALUED" | "PARTIALLY_VALUED" | "VALUATION_UNAVAILABLE";
  displayValuation: string;
  variantValuations: Array<{
    variantId: string;
    variantName: string;
    variantCode: string;
    categoryName: string;
    typeName: string;
    ownership: string;
    workingQty: Prisma.Decimal;
    unitPurchaseCost: Prisma.Decimal | null;
    totalValuation: Prisma.Decimal | null;
    valuationStatus: "VALUED" | "MISSING_COST_DATA" | "NOT_APPLICABLE_HIRED";
  }>;
}

export async function getInventoryValuationReport(
  filters?: InventoryReportFilters
): Promise<InventoryValuationReport> {
  const now = new Date();
  const variants = await db.materialVariant.findMany({
    where: {
      isActive: true,
      ...(filters?.materialVariantId ? { id: filters.materialVariantId } : {}),
      ...(filters?.ownershipType && filters.ownershipType !== "ALL" ? { ownershipClassification: filters.ownershipType } : {}),
    },
    include: {
      materialType: {
        include: { category: true },
      },
      stockBalances: {
        where: {
          ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        },
        select: {
          ownershipType: true,
          locationType: true,
          totalQty: true,
          availableQty: true,
          damagedQty: true,
          maintenanceQty: true,
        },
      },
    },
    orderBy: { materialCode: "asc" },
  });

  let totalOwnedQty = new Prisma.Decimal(0);
  let totalOwnedValuation = new Prisma.Decimal(0);
  let totalOwnedVariants = 0;
  let valuedOwnedVariantsCount = 0;
  let unvaluedOwnedVariantsCount = 0;
  let hiredInTotalQty = new Prisma.Decimal(0);

  const variantValuations = variants.map((v) => {
    const isOwned = v.ownershipClassification === "OWNED";

    // Working physical quantity across warehouse, customer sites, and maintenance (excluding SCRAP)
    let workingQty = new Prisma.Decimal(0);
    for (const sb of v.stockBalances) {
      if (sb.locationType !== "SCRAP") {
        workingQty = workingQty.plus(new Prisma.Decimal(sb.totalQty));
      }
    }

    if (!isOwned) {
      hiredInTotalQty = hiredInTotalQty.plus(workingQty);
      return {
        variantId: v.id,
        variantName: v.name,
        variantCode: v.materialCode,
        categoryName: v.materialType.category.name,
        typeName: v.materialType.name,
        ownership: "HIRED_IN",
        workingQty,
        unitPurchaseCost: null,
        totalValuation: null,
        valuationStatus: "NOT_APPLICABLE_HIRED" as const,
      };
    }

    // Owned material
    totalOwnedVariants++;
    totalOwnedQty = totalOwnedQty.plus(workingQty);

    if (v.purchaseCost && new Prisma.Decimal(v.purchaseCost).gt(0)) {
      const unitCost = new Prisma.Decimal(v.purchaseCost);
      const val = workingQty.mul(unitCost);
      totalOwnedValuation = totalOwnedValuation.plus(val);
      valuedOwnedVariantsCount++;

      return {
        variantId: v.id,
        variantName: v.name,
        variantCode: v.materialCode,
        categoryName: v.materialType.category.name,
        typeName: v.materialType.name,
        ownership: "OWNED",
        workingQty,
        unitPurchaseCost: unitCost,
        totalValuation: val,
        valuationStatus: "VALUED" as const,
      };
    } else {
      unvaluedOwnedVariantsCount++;
      return {
        variantId: v.id,
        variantName: v.name,
        variantCode: v.materialCode,
        categoryName: v.materialType.category.name,
        typeName: v.materialType.name,
        ownership: "OWNED",
        workingQty,
        unitPurchaseCost: null,
        totalValuation: null,
        valuationStatus: "MISSING_COST_DATA" as const,
      };
    }
  });

  let status: "FULLY_VALUED" | "PARTIALLY_VALUED" | "VALUATION_UNAVAILABLE" = "VALUATION_UNAVAILABLE";
  let displayValuation = "Valuation unavailable";

  if (totalOwnedVariants > 0) {
    const formattedAmount = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(totalOwnedValuation));

    if (valuedOwnedVariantsCount === totalOwnedVariants) {
      status = "FULLY_VALUED";
      displayValuation = formattedAmount;
    } else if (valuedOwnedVariantsCount > 0) {
      status = "PARTIALLY_VALUED";
      displayValuation = `${formattedAmount} (Partial: ${valuedOwnedVariantsCount}/${totalOwnedVariants} variants valued)`;
    } else {
      status = "VALUATION_UNAVAILABLE";
      displayValuation = "Valuation unavailable (Missing purchase cost data)";
    }
  }

  return {
    asOfDate: now,
    totalOwnedQty,
    totalOwnedValuation,
    totalOwnedVariants,
    valuedOwnedVariantsCount,
    unvaluedOwnedVariantsCount,
    hiredInTotalQty,
    status,
    displayValuation,
    variantValuations,
  };
}
