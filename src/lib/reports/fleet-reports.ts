import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface FleetReportFilters {
  vehicleId?: string;
  driverId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

export async function getFleetReportsData(filters?: FleetReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    fleetSummary,
    vehicleStats,
    fuelAnalytics,
    maintenanceSummary,
    driverTripSummary,
    upcomingExpiries,
  ] = await Promise.all([
    getFleetSummary(),
    getVehicleStats(start, end, filters?.vehicleId),
    getFuelAnalytics(start, end, filters?.vehicleId),
    getMaintenanceSummary(start, end, filters?.vehicleId),
    getDriverTripSummary(start, end, filters?.driverId),
    getUpcomingExpiries(),
  ]);

  return {
    period: { start, end },
    fleetSummary,
    vehicleStats,
    fuelAnalytics,
    maintenanceSummary,
    driverTripSummary,
    upcomingExpiries,
  };
}

async function getFleetSummary() {
  const [total, active] = await Promise.all([
    db.vehicle.count(),
    db.vehicle.count({ where: { status: "ACTIVE" } }),
  ]);

  return {
    totalVehicles: total,
    activeVehicles: active,
    underMaintenanceVehicles: total - active,
    ownershipModel: "COMPANY_OWNED_ONLY",
  };
}

async function getVehicleStats(start: Date, end: Date, vehicleId?: string) {
  const vehicles = await db.vehicle.findMany({
    where: {
      ...(vehicleId ? { id: vehicleId } : {}),
    },
    include: {
      trips: {
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ["COMPLETED", "CLOSED"] },
        },
        select: {
          startOdometer: true,
          endOdometer: true,
        },
      },
      fuelLogs: {
        where: {
          fuelDate: { gte: start, lte: end },
        },
        select: {
          quantityLitres: true,
          totalCost: true,
        },
      },
      maintenanceRecords: {
        where: {
          serviceDate: { gte: start, lte: end },
        },
        select: {
          totalCost: true,
        },
      },
    },
  });

  return vehicles.map((v) => {
    let totalKm = 0;
    for (const t of v.trips) {
      if (t.endOdometer && t.startOdometer) {
        totalKm += Math.max(0, Number(t.endOdometer) - Number(t.startOdometer));
      }
    }

    let fuelLiters = new Prisma.Decimal(0);
    let fuelCost = new Prisma.Decimal(0);
    for (const f of v.fuelLogs) {
      fuelLiters = fuelLiters.plus(new Prisma.Decimal(f.quantityLitres));
      fuelCost = fuelCost.plus(new Prisma.Decimal(f.totalCost));
    }

    let maintCost = new Prisma.Decimal(0);
    for (const m of v.maintenanceRecords) {
      maintCost = maintCost.plus(new Prisma.Decimal(m.totalCost));
    }

    const mileageKmPerLiter = fuelLiters.gt(0) && totalKm > 0
      ? Math.round((totalKm / fuelLiters.toNumber()) * 100) / 100
      : 0;

    const costPerKm = totalKm > 0
      ? Math.round((fuelCost.toNumber() / totalKm) * 100) / 100
      : 0;

    return {
      vehicleId: v.id,
      registrationNumber: v.vehicleNumber,
      makeModel: `${v.make || ""} ${v.model || ""}`.trim(),
      status: v.status,
      currentOdometerKm: v.currentOdometer,
      totalKmTravelled: totalKm,
      tripsCount: v.trips.length,
      totalFuelLiters: fuelLiters,
      totalFuelCost: fuelCost,
      totalMaintenanceCost: maintCost,
      totalOperatingCost: fuelCost.plus(maintCost),
      mileageKmPerLiter,
      costPerKm,
    };
  });
}

async function getFuelAnalytics(start: Date, end: Date, vehicleId?: string) {
  const fuelAgg = await db.vehicleFuelLog.aggregate({
    _sum: { quantityLitres: true, totalCost: true },
    where: {
      fuelDate: { gte: start, lte: end },
      ...(vehicleId ? { vehicleId } : {}),
    },
  });

  const totalLiters = fuelAgg._sum.quantityLitres || new Prisma.Decimal(0);
  const totalCost = fuelAgg._sum.totalCost || new Prisma.Decimal(0);
  const avgCostPerLiter = totalLiters.gt(0)
    ? Math.round(totalCost.dividedBy(totalLiters).toNumber() * 100) / 100
    : 0;

  return {
    totalFuelLiters: totalLiters,
    totalFuelExpense: totalCost,
    averageCostPerLiter: avgCostPerLiter,
  };
}

async function getMaintenanceSummary(start: Date, end: Date, vehicleId?: string) {
  const records = await db.vehicleMaintenanceRecord.findMany({
    where: {
      serviceDate: { gte: start, lte: end },
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { vehicleNumber: true } },
    },
    take: 20,
    orderBy: { serviceDate: "desc" },
  });

  let totalCost = new Prisma.Decimal(0);
  for (const r of records) {
    totalCost = totalCost.plus(new Prisma.Decimal(r.totalCost));
  }

  return {
    maintenanceRecordsCount: records.length,
    totalMaintenanceExpense: totalCost,
    recentServices: records.map((r) => ({
      id: r.id,
      recordNumber: r.recordNumber,
      vehicleRegistration: r.vehicle.vehicleNumber,
      serviceType: r.serviceCategory,
      serviceDate: r.serviceDate,
      totalCost: r.totalCost,
      vendorName: r.serviceProvider || "In-House Garage",
    })),
  };
}

async function getDriverTripSummary(start: Date, end: Date, driverId?: string) {
  const drivers = await db.driver.findMany({
    where: {
      ...(driverId ? { id: driverId } : {}),
    },
    include: {
      trips: {
        where: {
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          status: true,
          startOdometer: true,
          endOdometer: true,
        },
      },
    },
  });

  return drivers.map((d) => {
    let totalKm = 0;
    for (const t of d.trips) {
      if (t.endOdometer && t.startOdometer) {
        totalKm += Math.max(0, Number(t.endOdometer) - Number(t.startOdometer));
      }
    }

    return {
      driverId: d.id,
      fullName: d.name,
      licenseNumber: d.licenseNumber,
      status: d.status,
      tripsCompleted: d.trips.filter((t) => t.status === "COMPLETED" || t.status === "CLOSED").length,
      totalTrips: d.trips.length,
      totalKmDriven: totalKm,
    };
  }).sort((a, b) => b.totalKmDriven - a.totalKmDriven);
}

async function getUpcomingExpiries() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [vehicles, drivers] = await Promise.all([
    db.vehicle.findMany({
      where: {
        OR: [
          { insuranceExpiryDate: { lte: in30Days } },
          { fitnessExpiryDate: { lte: in30Days } },
          { pollutionExpiryDate: { lte: in30Days } },
          { permitExpiryDate: { lte: in30Days } },
        ],
      },
      select: {
        id: true,
        vehicleNumber: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        pollutionExpiryDate: true,
        permitExpiryDate: true,
      },
    }),
    db.driver.findMany({
      where: {
        status: "ACTIVE",
        licenseExpiryDate: { lte: in30Days },
      },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        licenseExpiryDate: true,
      },
    }),
  ]);

  const expiries: Array<{
    entityType: "VEHICLE" | "DRIVER";
    name: string;
    documentType: string;
    expiryDate: Date;
    isExpired: boolean;
  }> = [];

  for (const v of vehicles) {
    if (v.insuranceExpiryDate && v.insuranceExpiryDate <= in30Days) {
      expiries.push({ entityType: "VEHICLE", name: v.vehicleNumber, documentType: "Insurance", expiryDate: v.insuranceExpiryDate, isExpired: v.insuranceExpiryDate < now });
    }
    if (v.fitnessExpiryDate && v.fitnessExpiryDate <= in30Days) {
      expiries.push({ entityType: "VEHICLE", name: v.vehicleNumber, documentType: "Fitness Certificate", expiryDate: v.fitnessExpiryDate, isExpired: v.fitnessExpiryDate < now });
    }
    if (v.pollutionExpiryDate && v.pollutionExpiryDate <= in30Days) {
      expiries.push({ entityType: "VEHICLE", name: v.vehicleNumber, documentType: "PUC Certificate", expiryDate: v.pollutionExpiryDate, isExpired: v.pollutionExpiryDate < now });
    }
    if (v.permitExpiryDate && v.permitExpiryDate <= in30Days) {
      expiries.push({ entityType: "VEHICLE", name: v.vehicleNumber, documentType: "Permit", expiryDate: v.permitExpiryDate, isExpired: v.permitExpiryDate < now });
    }
  }

  for (const d of drivers) {
    expiries.push({ entityType: "DRIVER", name: d.name, documentType: "Driving License", expiryDate: d.licenseExpiryDate, isExpired: d.licenseExpiryDate < now });
  }

  return expiries.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
}
