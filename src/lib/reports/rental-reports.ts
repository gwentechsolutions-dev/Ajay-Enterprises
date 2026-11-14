import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface RentalReportFilters {
  reportType?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  customerId?: string;
  customerSiteId?: string;
  materialVariantId?: string;
  materialCategoryId?: string;
  warehouseId?: string;
  branchId?: string;
  ownershipType?: "OWNED" | "HIRED_IN" | "ALL";
}

export async function getRentalReportsData(filters?: RentalReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    monthlyRevenue,
    customerRevenue,
    siteRevenue,
    materialRevenue,
    agreementPerformance,
    activeBatches,
    rateAnalysis,
    billingModeSummary,
    uninvoicedStatements,
    collectionPerformance,
    materialUtilization,
    directTransferAnalytics,
  ] = await Promise.all([
    getMonthlyRentalRevenue(start, end, filters?.customerId),
    getCustomerRentalRevenue(start, end),
    getSiteRentalRevenue(start, end, filters?.customerId),
    getMaterialRentalRevenue(start, end),
    getRentalAgreementPerformance(filters?.customerId),
    getActiveRentalBatches(filters),
    getRentalRateAnalysis(),
    getBillingModeSummary(start, end),
    getUninvoicedStatements(),
    getRentalCollectionPerformance(start, end),
    getMaterialUtilization(filters),
    getDirectTransferAnalytics(start, end),
  ]);

  return {
    period: { start, end },
    monthlyRevenue,
    customerRevenue,
    siteRevenue,
    materialRevenue,
    agreementPerformance,
    activeBatches,
    rateAnalysis,
    billingModeSummary,
    uninvoicedStatements,
    collectionPerformance,
    materialUtilization,
    directTransferAnalytics,
  };
}

async function getMonthlyRentalRevenue(start: Date, end: Date, customerId?: string) {
  const statements = await db.rentalStatement.findMany({
    where: {
      status: { in: ["APPROVED", "FINALIZED"] },
      periodEndDate: { gte: start, lte: end },
      ...(customerId ? { customerId } : {}),
    },
    select: {
      periodEndDate: true,
      totalRentalAmount: true,
      totalDamageCharges: true,
      totalMissingCharges: true,
      netPayableAmount: true,
    },
    orderBy: { periodEndDate: "asc" },
  });

  const monthMap: Record<string, { month: string; rental: Prisma.Decimal; damages: Prisma.Decimal; net: Prisma.Decimal }> = {};

  for (const stm of statements) {
    const d = new Date(stm.periodEndDate);
    const key = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    if (!monthMap[key]) {
      monthMap[key] = {
        month: key,
        rental: new Prisma.Decimal(0),
        damages: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
      };
    }
    monthMap[key].rental = monthMap[key].rental.plus(new Prisma.Decimal(stm.totalRentalAmount));
    monthMap[key].damages = monthMap[key].damages.plus(new Prisma.Decimal(stm.totalDamageCharges)).plus(new Prisma.Decimal(stm.totalMissingCharges));
    monthMap[key].net = monthMap[key].net.plus(new Prisma.Decimal(stm.netPayableAmount));
  }

  return Object.values(monthMap);
}

async function getCustomerRentalRevenue(start: Date, end: Date) {
  const statements = await db.rentalStatement.findMany({
    where: {
      status: { in: ["APPROVED", "FINALIZED"] },
      periodEndDate: { gte: start, lte: end },
    },
    select: {
      customerId: true,
      totalRentalAmount: true,
      netPayableAmount: true,
      customer: { select: { id: true, name: true, customerCode: true } },
    },
  });

  const custMap: Record<string, { customerId: string; customerName: string; customerCode: string; statementsCount: number; totalRental: Prisma.Decimal; netPayable: Prisma.Decimal }> = {};

  for (const stm of statements) {
    const id = stm.customerId;
    if (!custMap[id]) {
      custMap[id] = {
        customerId: id,
        customerName: stm.customer.name,
        customerCode: stm.customer.customerCode,
        statementsCount: 0,
        totalRental: new Prisma.Decimal(0),
        netPayable: new Prisma.Decimal(0),
      };
    }
    custMap[id].statementsCount += 1;
    custMap[id].totalRental = custMap[id].totalRental.plus(new Prisma.Decimal(stm.totalRentalAmount));
    custMap[id].netPayable = custMap[id].netPayable.plus(new Prisma.Decimal(stm.netPayableAmount));
  }

  return Object.values(custMap).sort((a, b) => b.netPayable.minus(a.netPayable).toNumber());
}

async function getSiteRentalRevenue(start: Date, end: Date, customerId?: string) {
  const items = await db.rentalStatementItem.findMany({
    where: {
      statement: {
        status: { in: ["APPROVED", "FINALIZED"] },
        periodEndDate: { gte: start, lte: end },
        ...(customerId ? { customerId } : {}),
      },
    },
    select: {
      customerSiteId: true,
      rentalAmount: true,
      customerSite: { select: { id: true, siteName: true, siteCode: true, customer: { select: { name: true } } } },
    },
  });

  const siteMap: Record<string, { siteId: string; siteName: string; siteCode: string; customerName: string; billedAmount: Prisma.Decimal }> = {};

  for (const it of items) {
    const id = it.customerSiteId;
    if (!siteMap[id]) {
      siteMap[id] = {
        siteId: id,
        siteName: it.customerSite.siteName,
        siteCode: it.customerSite.siteCode,
        customerName: it.customerSite.customer.name,
        billedAmount: new Prisma.Decimal(0),
      };
    }
    siteMap[id].billedAmount = siteMap[id].billedAmount.plus(new Prisma.Decimal(it.rentalAmount));
  }

  return Object.values(siteMap).sort((a, b) => b.billedAmount.minus(a.billedAmount).toNumber());
}

async function getMaterialRentalRevenue(start: Date, end: Date) {
  const items = await db.rentalStatementItem.findMany({
    where: {
      statement: {
        status: { in: ["APPROVED", "FINALIZED"] },
        periodEndDate: { gte: start, lte: end },
      },
    },
    select: {
      materialVariantId: true,
      rentalAmount: true,
      billableDays: true,
      materialVariant: { select: { id: true, name: true, materialCode: true, materialType: { select: { name: true } } } },
    },
  });

  const matMap: Record<string, { variantId: string; variantName: string; variantCode: string; typeName: string; billedDays: number; billedAmount: Prisma.Decimal }> = {};

  for (const it of items) {
    const id = it.materialVariantId;
    if (!matMap[id]) {
      matMap[id] = {
        variantId: id,
        variantName: it.materialVariant.name,
        variantCode: it.materialVariant.materialCode,
        typeName: it.materialVariant.materialType.name,
        billedDays: 0,
        billedAmount: new Prisma.Decimal(0),
      };
    }
    matMap[id].billedDays += Number(it.billableDays || 0);
    matMap[id].billedAmount = matMap[id].billedAmount.plus(new Prisma.Decimal(it.rentalAmount));
  }

  return Object.values(matMap).sort((a, b) => b.billedAmount.minus(a.billedAmount).toNumber());
}

async function getRentalAgreementPerformance(customerId?: string) {
  const agreements = await db.rentalAgreement.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
    },
    select: {
      id: true,
      agreementNumber: true,
      startDate: true,
      endDate: true,
      status: true,
      billingFrequency: true,
      customer: { select: { name: true } },
      customerSite: { select: { siteName: true } },
      items: {
        select: {
          agreedDailyRate: true,
        },
      },
      statements: {
        where: { status: { in: ["APPROVED", "FINALIZED"] } },
        select: { netPayableAmount: true },
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return agreements.map((agr) => {
    const totalBilled = agr.statements.reduce(
      (sum, s) => sum.plus(new Prisma.Decimal(s.netPayableAmount)),
      new Prisma.Decimal(0)
    );

    return {
      id: agr.id,
      agreementNumber: agr.agreementNumber,
      customerName: agr.customer.name,
      siteName: agr.customerSite?.siteName || "Multi-Site",
      startDate: agr.startDate,
      endDate: agr.endDate,
      status: agr.status,
      totalBilled,
      itemsCount: agr.items.length,
      statementsCount: agr.statements.length,
    };
  });
}

async function getActiveRentalBatches(filters?: RentalReportFilters) {
  const batches = await db.rentalBatch.findMany({
    where: {
      status: "ACTIVE",
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.customerSiteId ? { customerSiteId: filters.customerSiteId } : {}),
      ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      ...(filters?.ownershipType && filters.ownershipType !== "ALL" ? { ownershipType: filters.ownershipType } : {}),
    },
    select: {
      id: true,
      batchNumber: true,
      ownershipType: true,
      deliveryDate: true,
      deliveredQty: true,
      returnedQty: true,
      currentHeldQty: true,
      applicableDailyRate: true,
      customer: { select: { name: true } },
      customerSite: { select: { siteName: true } },
      materialVariant: { select: { name: true, materialCode: true } },
    },
    take: 50,
    orderBy: { deliveryDate: "asc" },
  });

  const now = new Date();
  return batches.map((b) => {
    const delivery = new Date(b.deliveryDate);
    const runningDays = Math.max(1, Math.floor((now.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRate = new Prisma.Decimal(b.applicableDailyRate);
    const heldQty = new Prisma.Decimal(b.currentHeldQty);
    const estimatedDailyRental = heldQty.times(dailyRate);

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      customerName: b.customer.name,
      siteName: b.customerSite.siteName,
      variantName: b.materialVariant.name,
      variantCode: b.materialVariant.materialCode,
      ownershipType: b.ownershipType,
      deliveryDate: b.deliveryDate,
      deliveredQty: b.deliveredQty,
      returnedQty: b.returnedQty,
      currentHeldQty: b.currentHeldQty,
      applicableDailyRate: b.applicableDailyRate,
      runningDays,
      estimatedDailyRental,
    };
  });
}

async function getRentalRateAnalysis() {
  const variants = await db.materialVariant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      materialCode: true,
      defaultRentalRate: true,
      materialType: { select: { name: true } },
      rentalAgreementItems: {
        take: 10,
        select: {
          agreedDailyRate: true,
          rentalAgreement: { select: { status: true, customer: { select: { name: true } } } },
        },
      },
    },
    take: 30,
  });

  return variants.map((v) => {
    const rates = v.rentalAgreementItems.map((a) => Number(a.agreedDailyRate));
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : Number(v.defaultRentalRate);
    const minRate = rates.length > 0 ? Math.min(...rates) : Number(v.defaultRentalRate);
    const maxRate = rates.length > 0 ? Math.max(...rates) : Number(v.defaultRentalRate);

    return {
      variantId: v.id,
      variantName: v.name,
      variantCode: v.materialCode,
      typeName: v.materialType.name,
      baseDailyRate: v.defaultRentalRate,
      averageAgreedRate: Math.round(avgRate * 100) / 100,
      minAgreedRate: minRate,
      maxAgreedRate: maxRate,
      agreementsSampled: rates.length,
    };
  });
}

async function getBillingModeSummary(start: Date, end: Date) {
  const statements = await db.rentalStatement.findMany({
    where: {
      status: { in: ["APPROVED", "FINALIZED"] },
      periodEndDate: { gte: start, lte: end },
    },
    select: {
      billingMode: true,
      netPayableAmount: true,
    },
  });

  let siteWiseCount = 0;
  let siteWiseTotal = new Prisma.Decimal(0);
  let consolidatedCount = 0;
  let consolidatedTotal = new Prisma.Decimal(0);

  for (const s of statements) {
    if (s.billingMode === "CONSOLIDATED") {
      consolidatedCount += 1;
      consolidatedTotal = consolidatedTotal.plus(new Prisma.Decimal(s.netPayableAmount));
    } else {
      siteWiseCount += 1;
      siteWiseTotal = siteWiseTotal.plus(new Prisma.Decimal(s.netPayableAmount));
    }
  }

  return {
    siteWise: { count: siteWiseCount, total: siteWiseTotal },
    consolidated: { count: consolidatedCount, total: consolidatedTotal },
    grandTotal: siteWiseTotal.plus(consolidatedTotal),
  };
}

async function getUninvoicedStatements() {
  const statements = await db.rentalStatement.findMany({
    where: {
      status: "FINALIZED",
      invoices: { none: {} },
    },
    select: {
      id: true,
      statementNumber: true,
      finalizedAt: true,
      netPayableAmount: true,
      customer: { select: { id: true, name: true, primaryMobile: true } },
      customerSite: { select: { siteName: true } },
    },
    orderBy: { finalizedAt: "asc" },
  });

  const now = new Date();
  let totalUninvoiced = new Prisma.Decimal(0);

  const items = statements.map((s) => {
    const finDate = s.finalizedAt ? new Date(s.finalizedAt) : now;
    const daysSinceFinalized = Math.max(0, Math.floor((now.getTime() - finDate.getTime()) / (1000 * 60 * 60 * 24)));
    totalUninvoiced = totalUninvoiced.plus(new Prisma.Decimal(s.netPayableAmount));

    return {
      id: s.id,
      statementNumber: s.statementNumber,
      customerName: s.customer.name,
      siteName: s.customerSite?.siteName || "Consolidated",
      finalizedAt: s.finalizedAt,
      daysSinceFinalized,
      netPayableAmount: s.netPayableAmount,
    };
  });

  return {
    count: items.length,
    totalUninvoiced,
    items,
  };
}

async function getRentalCollectionPerformance(start: Date, end: Date) {
  const [billedAgg, collectedAgg] = await Promise.all([
    db.invoice.aggregate({
      _sum: { grandTotal: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceType: "RENTAL",
        invoiceDate: { gte: start, lte: end },
      },
    }),
    db.paymentAllocation.aggregate({
      _sum: { allocatedAmount: true },
      where: {
        invoice: {
          invoiceType: "RENTAL",
          invoiceDate: { gte: start, lte: end },
        },
      },
    }),
  ]);

  const billed = billedAgg._sum.grandTotal || new Prisma.Decimal(0);
  const collected = collectedAgg._sum.allocatedAmount || new Prisma.Decimal(0);
  const outstanding = billed.minus(collected);
  const efficiency = billed.gt(0) ? collected.dividedBy(billed).times(100).toNumber() : 0;

  return {
    totalBilled: billed,
    totalCollected: collected,
    totalOutstanding: outstanding,
    collectionEfficiencyPct: Math.round(efficiency * 100) / 100,
  };
}

/**
 * B1. Material Utilization with Strict OWNED vs HIRED_IN Segregation
 * Utilization % = Quantity at customer sites / Total eligible owned quantity * 100
 * Denominator excludes scrapped quantity.
 */
async function getMaterialUtilization(filters?: RentalReportFilters) {
  const [ownedStock, hiredStock, repairJobs, scrapStock, siteBatches] = await Promise.all([
    db.stockBalance.aggregate({
      _sum: { totalQty: true, availableQty: true, damagedQty: true },
      where: {
        ownershipType: "OWNED",
        warehouseId: filters?.warehouseId ? filters.warehouseId : { not: null },
        ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      },
    }),

    db.stockBalance.aggregate({
      _sum: { totalQty: true, availableQty: true, damagedQty: true },
      where: {
        ownershipType: "HIRED_IN",
        warehouseId: filters?.warehouseId ? filters.warehouseId : { not: null },
        ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      },
    }),

    db.materialRepairJob.aggregate({
      _sum: { remainingQuantity: true },
      where: {
        status: { in: ["REPORTED", "IN_PROGRESS", "AWAITING_PARTS", "AWAITING_INSPECTION"] },
        ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      },
    }),

    db.materialRepairJob.aggregate({
      _sum: { scrappedQuantity: true },
      where: {
        ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
      },
    }),

    db.rentalBatch.groupBy({
      by: ["ownershipType"],
      _sum: { currentHeldQty: true },
      where: {
        status: "ACTIVE",
        ...(filters?.materialVariantId ? { materialVariantId: filters.materialVariantId } : {}),
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.customerSiteId ? { customerSiteId: filters.customerSiteId } : {}),
      },
    }),
  ]);

  let ownedAtSites = new Prisma.Decimal(0);
  let hiredAtSites = new Prisma.Decimal(0);

  for (const b of siteBatches) {
    if (b.ownershipType === "OWNED") {
      ownedAtSites = b._sum.currentHeldQty || new Prisma.Decimal(0);
    } else if (b.ownershipType === "HIRED_IN") {
      hiredAtSites = b._sum.currentHeldQty || new Prisma.Decimal(0);
    }
  }

  const ownedWarehouseAvailable = ownedStock._sum.availableQty || new Prisma.Decimal(0);
  const ownedUnderRepair = repairJobs._sum.remainingQuantity || new Prisma.Decimal(0);
  const ownedDamaged = ownedStock._sum.damagedQty || new Prisma.Decimal(0);
  const ownedScrapped = scrapStock._sum.scrappedQuantity || new Prisma.Decimal(0);

  const totalEligibleOwned = ownedWarehouseAvailable.plus(ownedAtSites).plus(ownedUnderRepair).plus(ownedDamaged);

  const utilizationRatePct = totalEligibleOwned.gt(0)
    ? ownedAtSites.dividedBy(totalEligibleOwned).times(100).toNumber()
    : 0;

  return {
    owned: {
      totalEligibleOwned,
      availableInWarehouse: ownedWarehouseAvailable,
      atCustomerSites: ownedAtSites,
      underRepair: ownedUnderRepair,
      damaged: ownedDamaged,
      scrapped: ownedScrapped,
      utilizationRatePct: Math.round(utilizationRatePct * 100) / 100,
    },
    hiredIn: {
      availableInWarehouse: hiredStock._sum.availableQty || new Prisma.Decimal(0),
      atCustomerSites: hiredAtSites,
      damaged: hiredStock._sum.damagedQty || new Prisma.Decimal(0),
    },
  };
}

/**
 * B2. Direct Site Transfer Analytics
 */
async function getDirectTransferAnalytics(start: Date, end: Date) {
  const transfers = await db.directSiteTransferNote.findMany({
    where: {
      transferDate: { gte: start, lte: end },
    },
    select: {
      id: true,
      transferNumber: true,
      transferDate: true,
      status: true,
      discrepancyResponsibleParty: true,
      rejectedDisposition: true,
      sourceCustomer: { select: { name: true } },
      destinationCustomer: { select: { name: true } },
      items: {
        select: {
          quantityDispatched: true,
          quantityAccepted: true,
          quantityDamaged: true,
          quantityMissing: true,
          quantityRejected: true,
        },
      },
    },
  });

  let totalTransfers = transfers.length;
  let totalDispatched = new Prisma.Decimal(0);
  let totalAccepted = new Prisma.Decimal(0);
  let totalDamaged = new Prisma.Decimal(0);
  let totalMissing = new Prisma.Decimal(0);
  let totalRejected = new Prisma.Decimal(0);

  for (const t of transfers) {
    for (const item of t.items) {
      totalDispatched = totalDispatched.plus(new Prisma.Decimal(item.quantityDispatched));
      totalAccepted = totalAccepted.plus(new Prisma.Decimal(item.quantityAccepted));
      totalDamaged = totalDamaged.plus(new Prisma.Decimal(item.quantityDamaged));
      totalMissing = totalMissing.plus(new Prisma.Decimal(item.quantityMissing));
      totalRejected = totalRejected.plus(new Prisma.Decimal(item.quantityRejected));
    }
  }

  return {
    totalTransfers,
    totalDispatched,
    totalAccepted,
    totalDamaged,
    totalMissing,
    totalRejected,
    reconciliationRatePct: totalDispatched.gt(0)
      ? Math.round(totalAccepted.dividedBy(totalDispatched).times(100).toNumber() * 100) / 100
      : 100,
    transfersSample: transfers.slice(0, 10).map((t) => ({
      id: t.id,
      transferNumber: t.transferNumber,
      transferDate: t.transferDate,
      sourceCustomer: t.sourceCustomer.name,
      destinationCustomer: t.destinationCustomer.name,
      status: t.status,
      responsibleParty: t.discrepancyResponsibleParty,
      rejectedDisposition: t.rejectedDisposition,
    })),
  };
}
