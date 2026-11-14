import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";

// ==============================================================================
// INVENTRA: FLEET MANAGEMENT SERVICE
// Exclusively for AJAY ENTERPRISES Company-Owned Fleet
// ==============================================================================

export interface MileageCalculationResult {
  validFillsCount: number;
  totalLitres: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  totalDistanceKm: Prisma.Decimal;
  averageKmPerLitre: Prisma.Decimal | null;
  averageCostPerKm: Prisma.Decimal | null;
  isReliable: boolean;
}

/**
 * Calculates vehicle mileage and fuel efficiency between full-tank fills.
 * Safely handles irregular entries, missing odometers, and non-full tank fills.
 */
export async function calculateVehicleMileage(vehicleId: string): Promise<MileageCalculationResult> {
  const fuelLogs = await db.vehicleFuelLog.findMany({
    where: { vehicleId },
    orderBy: { fuelDate: "asc" },
  });

  if (fuelLogs.length < 2) {
    const totalLitres = fuelLogs.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.quantityLitres)),
      new Prisma.Decimal(0)
    );
    const totalCost = fuelLogs.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.totalCost)),
      new Prisma.Decimal(0)
    );
    return {
      validFillsCount: fuelLogs.length,
      totalLitres,
      totalCost,
      totalDistanceKm: new Prisma.Decimal(0),
      averageKmPerLitre: null,
      averageCostPerKm: null,
      isReliable: false,
    };
  }

  let totalValidDistance = new Prisma.Decimal(0);
  let totalValidLitres = new Prisma.Decimal(0);
  let totalValidCost = new Prisma.Decimal(0);
  let validIntervals = 0;

  for (let i = 1; i < fuelLogs.length; i++) {
    const prev = fuelLogs[i - 1];
    const curr = fuelLogs[i];

    const prevOdo = new Prisma.Decimal(prev.odometerReading);
    const currOdo = new Prisma.Decimal(curr.odometerReading);
    const distance = currOdo.minus(prevOdo);

    // Filter out invalid odometer readings (reversals, negative distance, or absurd jumps)
    if (distance.gt(0) && distance.lt(new Prisma.Decimal(3000)) && curr.isFullTank) {
      const litres = new Prisma.Decimal(curr.quantityLitres);
      const cost = new Prisma.Decimal(curr.totalCost);

      totalValidDistance = totalValidDistance.plus(distance);
      totalValidLitres = totalValidLitres.plus(litres);
      totalValidCost = totalValidCost.plus(cost);
      validIntervals++;
    }
  }

  const averageKmPerLitre =
    totalValidLitres.gt(0) && totalValidDistance.gt(0)
      ? totalValidDistance.dividedBy(totalValidLitres)
      : null;

  const averageCostPerKm =
    totalValidDistance.gt(0) && totalValidCost.gt(0)
      ? totalValidCost.dividedBy(totalValidDistance)
      : null;

  return {
    validFillsCount: validIntervals,
    totalLitres: totalValidLitres,
    totalCost: totalValidCost,
    totalDistanceKm: totalValidDistance,
    averageKmPerLitre,
    averageCostPerKm,
    isReliable: validIntervals >= 2,
  };
}

/**
 * Checks vehicle and driver document expiry alerts.
 */
export async function getFleetComplianceAlerts(daysThreshold: number = 30) {
  const now = new Date();
  const alertCutoff = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  const [vehicles, drivers] = await Promise.all([
    db.vehicle.findMany({
      where: { status: "ACTIVE" },
      include: { defaultDriver: true, branch: true },
    }),
    db.driver.findMany({
      where: { status: "ACTIVE" },
    }),
  ]);

  const vehicleAlerts: Array<{
    vehicleId: string;
    vehicleNumber: string;
    alertType: "INSURANCE" | "FITNESS" | "POLLUTION" | "PERMIT";
    expiryDate: Date;
    daysRemaining: number;
    isExpired: boolean;
  }> = [];

  for (const v of vehicles) {
    if (v.insuranceExpiryDate) {
      const exp = new Date(v.insuranceExpiryDate);
      if (exp <= alertCutoff) {
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        vehicleAlerts.push({
          vehicleId: v.id,
          vehicleNumber: v.vehicleNumber,
          alertType: "INSURANCE",
          expiryDate: exp,
          daysRemaining: days,
          isExpired: days < 0,
        });
      }
    }
    if (v.fitnessExpiryDate) {
      const exp = new Date(v.fitnessExpiryDate);
      if (exp <= alertCutoff) {
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        vehicleAlerts.push({
          vehicleId: v.id,
          vehicleNumber: v.vehicleNumber,
          alertType: "FITNESS",
          expiryDate: exp,
          daysRemaining: days,
          isExpired: days < 0,
        });
      }
    }
    if (v.pollutionExpiryDate) {
      const exp = new Date(v.pollutionExpiryDate);
      if (exp <= alertCutoff) {
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        vehicleAlerts.push({
          vehicleId: v.id,
          vehicleNumber: v.vehicleNumber,
          alertType: "POLLUTION",
          expiryDate: exp,
          daysRemaining: days,
          isExpired: days < 0,
        });
      }
    }
    if (v.permitExpiryDate) {
      const exp = new Date(v.permitExpiryDate);
      if (exp <= alertCutoff) {
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        vehicleAlerts.push({
          vehicleId: v.id,
          vehicleNumber: v.vehicleNumber,
          alertType: "PERMIT",
          expiryDate: exp,
          daysRemaining: days,
          isExpired: days < 0,
        });
      }
    }
  }

  const driverAlerts: Array<{
    driverId: string;
    driverCode: string;
    name: string;
    expiryDate: Date;
    daysRemaining: number;
    isExpired: boolean;
  }> = [];

  for (const d of drivers) {
    if (d.licenseExpiryDate) {
      const exp = new Date(d.licenseExpiryDate);
      if (exp <= alertCutoff) {
        const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        driverAlerts.push({
          driverId: d.id,
          driverCode: d.driverCode,
          name: d.name,
          expiryDate: exp,
          daysRemaining: days,
          isExpired: days < 0,
        });
      }
    }
  }

  return { vehicleAlerts, driverAlerts };
}

/**
 * Validates that a vehicle has no conflicting active trips before creating a new one.
 */
export async function validateVehicleTripAssignment(vehicleId: string, tripDate: Date = new Date()) {
  const activeTrip = await db.vehicleTrip.findFirst({
    where: {
      vehicleId,
      status: "IN_TRANSIT",
    },
  });

  if (activeTrip) {
    throw new Error(
      `Vehicle is currently assigned to active trip ${activeTrip.tripNumber} (IN_TRANSIT). Complete or cancel the active trip first.`
    );
  }
}

