import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface MaintenanceReportFilters {
  warehouseId?: string;
  materialVariantId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  status?: string;
}

export async function getMaintenanceReportsData(filters?: MaintenanceReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    repairSummary,
    warehouseRepairCosts,
    variantRepairSummary,
    scrapSummary,
    repairJobsList,
  ] = await Promise.all([
    getRepairSummary(start, end, filters),
    getWarehouseRepairCosts(start, end),
    getVariantRepairSummary(start, end),
    getScrapSummary(start, end),
    getRepairJobsList(start, end, filters),
  ]);

  return {
    period: { start, end },
    repairSummary,
    warehouseRepairCosts,
    variantRepairSummary,
    scrapSummary,
    repairJobsList,
    maintenanceScope: "CENTERING_MATERIALS_ONLY",
  };
}

async function getRepairSummary(start: Date, end: Date, filters?: MaintenanceReportFilters) {
  const [totalJobs, openJobs, awaitingInspection, awaitingParts, completed] = await Promise.all([
    db.materialRepairJob.count({
      where: {
        createdAt: { gte: start, lte: end },
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
    db.materialRepairJob.count({
      where: {
        status: { in: ["REPORTED", "IN_PROGRESS"] },
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
    db.materialRepairJob.count({
      where: {
        status: "AWAITING_INSPECTION",
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
    db.materialRepairJob.count({
      where: {
        status: "AWAITING_PARTS",
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
    db.materialRepairJob.count({
      where: {
        status: "COMPLETED",
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),
  ]);

  const costsAgg = await db.materialRepairJob.aggregate({
    _sum: {
      partsCost: true,
      labourCost: true,
      totalQuantity: true,
      repairedQuantity: true,
      scrappedQuantity: true,
      remainingQuantity: true,
    },
    where: {
      createdAt: { gte: start, lte: end },
      ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    },
  });

  const parts = costsAgg._sum.partsCost || new Prisma.Decimal(0);
  const labour = costsAgg._sum.labourCost || new Prisma.Decimal(0);

  return {
    totalJobs,
    openJobs,
    awaitingInspection,
    awaitingParts,
    completedJobs: completed,
    totalQuantityReceived: costsAgg._sum.totalQuantity || new Prisma.Decimal(0),
    totalRepairedQuantity: costsAgg._sum.repairedQuantity || new Prisma.Decimal(0),
    totalScrappedQuantity: costsAgg._sum.scrappedQuantity || new Prisma.Decimal(0),
    totalRemainingQuantity: costsAgg._sum.remainingQuantity || new Prisma.Decimal(0),
    totalPartsCost: parts,
    totalLabourCost: labour,
    totalRepairCost: parts.plus(labour),
  };
}

async function getWarehouseRepairCosts(start: Date, end: Date) {
  const warehouses = await db.warehouse.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      warehouseCode: true,
      materialRepairJobs: {
        where: {
          createdAt: { gte: start, lte: end },
        },
        select: {
          partsCost: true,
          labourCost: true,
          repairedQuantity: true,
          scrappedQuantity: true,
        },
      },
    },
  });

  return warehouses.map((w) => {
    let parts = new Prisma.Decimal(0);
    let labour = new Prisma.Decimal(0);
    let repaired = new Prisma.Decimal(0);
    let scrapped = new Prisma.Decimal(0);

    for (const j of w.materialRepairJobs) {
      parts = parts.plus(new Prisma.Decimal(j.partsCost || 0));
      labour = labour.plus(new Prisma.Decimal(j.labourCost || 0));
      repaired = repaired.plus(new Prisma.Decimal(j.repairedQuantity || 0));
      scrapped = scrapped.plus(new Prisma.Decimal(j.scrappedQuantity || 0));
    }

    return {
      warehouseId: w.id,
      warehouseName: w.name,
      warehouseCode: w.warehouseCode,
      jobsCount: w.materialRepairJobs.length,
      partsCost: parts,
      labourCost: labour,
      totalCost: parts.plus(labour),
      repairedQuantity: repaired,
      scrappedQuantity: scrapped,
    };
  });
}

async function getVariantRepairSummary(start: Date, end: Date) {
  const jobs = await db.materialRepairJob.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    include: {
      materialVariant: { select: { id: true, name: true, materialCode: true } },
    },
  });

  const map: Record<string, { variantId: string; variantName: string; variantCode: string; jobsCount: number; repairedQuantity: Prisma.Decimal; totalCost: Prisma.Decimal }> = {};

  for (const j of jobs) {
    const id = j.materialVariantId;
    if (!map[id]) {
      map[id] = {
        variantId: id,
        variantName: j.materialVariant.name,
        variantCode: j.materialVariant.materialCode,
        jobsCount: 0,
        repairedQuantity: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
      };
    }
    const cost = new Prisma.Decimal(j.partsCost || 0).plus(new Prisma.Decimal(j.labourCost || 0));
    map[id].jobsCount += 1;
    map[id].repairedQuantity = map[id].repairedQuantity.plus(new Prisma.Decimal(j.repairedQuantity || 0));
    map[id].totalCost = map[id].totalCost.plus(cost);
  }

  return Object.values(map).sort((a, b) => b.totalCost.minus(a.totalCost).toNumber());
}

async function getScrapSummary(start: Date, end: Date) {
  const scrapJobs = await db.materialRepairJob.findMany({
    where: {
      scrappedQuantity: { gt: 0 },
      createdAt: { gte: start, lte: end },
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      warehouse: { select: { name: true } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  let totalScrapped = new Prisma.Decimal(0);

  for (const j of scrapJobs) {
    totalScrapped = totalScrapped.plus(new Prisma.Decimal(j.scrappedQuantity));
  }

  return {
    totalScrappedQuantity: totalScrapped,
    records: scrapJobs.map((j) => ({
      id: j.id,
      jobCode: j.jobCode,
      variantName: j.materialVariant.name,
      warehouseName: j.warehouse.name,
      scrappedQuantity: j.scrappedQuantity,
      damageDescription: j.damageDescription,
      date: j.createdAt,
    })),
  };
}

async function getRepairJobsList(start: Date, end: Date, filters?: MaintenanceReportFilters) {
  const jobs = await db.materialRepairJob.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      materialVariant: { select: { name: true, materialCode: true } },
      warehouse: { select: { name: true } },
    },
    take: 30,
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((j) => ({
    id: j.id,
    jobCode: j.jobCode,
    variantName: j.materialVariant.name,
    warehouseName: j.warehouse.name,
    totalQuantity: j.totalQuantity,
    repairedQuantity: j.repairedQuantity,
    scrappedQuantity: j.scrappedQuantity,
    remainingQuantity: j.remainingQuantity,
    priority: j.priority,
    status: j.status,
    totalCost: new Prisma.Decimal(j.partsCost || 0).plus(new Prisma.Decimal(j.labourCost || 0)),
    startDate: j.startDate,
    completedDate: j.completedDate,
  }));
}
