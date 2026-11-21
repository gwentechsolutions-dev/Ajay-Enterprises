import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ==============================================================================
// INVENTRA: VEHICLE FUEL CALCULATIONS & MILEAGE TRACKING ENGINE
// Adapted from UnblockNow & tailored for AJAY ENTERPRISES Company-Owned Fleet
// ==============================================================================

export const MONEY_DECIMALS = 2;
export const QUANTITY_DECIMALS = 2;
export const EFFICIENCY_DECIMALS = 2;

// Tolerance ratios for checking quantity * rate == totalCost
export const AMOUNT_TOLERANCE_RATIO = 0.02; // 2%
export const AMOUNT_TOLERANCE_ABSOLUTE = 2.0; // ₹2.00

// Plausible bounds for commercial fleet operations
export const MAX_PLAUSIBLE_DISTANCE_PER_FILL_KM = 3000;
export const MIN_PLAUSIBLE_KM_PER_LITRE = 1.5;
export const MAX_PLAUSIBLE_KM_PER_LITRE = 45.0;

export interface AmountCrossCheckResult {
  consistent: boolean;
  expectedAmount: number | null;
  difference: number | null;
  tolerance: number | null;
}

/**
 * Cross-checks whether quantity * rate matches the total amount within tolerance.
 * Pumps often round off or include slight paise differences.
 */
export function crossCheckFuelAmount(params: {
  quantity: number | null | undefined;
  pricePerUnit: number | null | undefined;
  totalAmount: number | null | undefined;
}): AmountCrossCheckResult {
  const { quantity, pricePerUnit, totalAmount } = params;

  if (
    quantity == null ||
    pricePerUnit == null ||
    totalAmount == null ||
    quantity <= 0 ||
    pricePerUnit <= 0
  ) {
    return { consistent: true, expectedAmount: null, difference: null, tolerance: null };
  }

  const expectedAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const difference = Math.round(Math.abs(expectedAmount - totalAmount) * 100) / 100;
  const tolerance = Math.round(
    Math.max(AMOUNT_TOLERANCE_ABSOLUTE, expectedAmount * AMOUNT_TOLERANCE_RATIO) * 100
  ) / 100;

  return {
    consistent: difference <= tolerance,
    expectedAmount,
    difference,
    tolerance,
  };
}

export interface OdometerValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  previousOdometer: number | null;
  distanceTravelled: number | null;
}

/**
 * Validates that a new odometer reading respects chronological reality:
 * 1. Current odometer cannot be lower than the latest recorded reading (unless allowReset is true).
 * 2. Negative distance cannot be accepted.
 * 3. Absurdly large distance jumps (> 3,000 km in one fill) trigger a warning.
 */
export async function validateOdometerProgression(params: {
  vehicleId: string;
  currentOdometer: number;
  entryDate?: Date;
  allowOdometerReset?: boolean;
  excludeLogId?: string;
}): Promise<OdometerValidationResult> {
  const { vehicleId, currentOdometer, entryDate = new Date(), allowOdometerReset = false, excludeLogId } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (currentOdometer < 0) {
    errors.push("Odometer reading cannot be negative.");
    return { valid: false, errors, warnings, previousOdometer: null, distanceTravelled: null };
  }

  // Find previous fuel log or trip before or on this date
  const priorLogs = await db.vehicleFuelLog.findMany({
    where: {
      vehicleId,
      fuelDate: { lte: entryDate },
      ...(excludeLogId ? { id: { not: excludeLogId } } : {}),
    },
    orderBy: { fuelDate: "desc" },
    take: 1,
  });

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { currentOdometer: true, vehicleNumber: true },
  });

  const lastLogOdo = priorLogs.length > 0 ? Number(priorLogs[0].odometerReading) : null;
  const vehicleMasterOdo = vehicle ? Number(vehicle.currentOdometer) : null;

  const previousOdometer = lastLogOdo ?? vehicleMasterOdo ?? null;

  if (previousOdometer !== null && previousOdometer > 0) {
    const diff = currentOdometer - previousOdometer;

    if (diff < 0) {
      if (allowOdometerReset) {
        warnings.push(
          `Odometer went backwards from ${previousOdometer.toLocaleString()} km to ${currentOdometer.toLocaleString()} km. Recorded as an authorized odometer cluster reset.`
        );
      } else {
        errors.push(
          `Current odometer (${currentOdometer.toLocaleString()} km) is lower than the last recorded reading (${previousOdometer.toLocaleString()} km). Check for typos or confirm an odometer reset.`
        );
      }
    } else if (diff > MAX_PLAUSIBLE_DISTANCE_PER_FILL_KM) {
      warnings.push(
        `Distance of ${diff.toLocaleString()} km since last refill is unusually high. Please confirm this is the total vehicle odometer and not a trip meter.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      previousOdometer,
      distanceTravelled: diff >= 0 ? diff : null,
    };
  }

  return {
    valid: true,
    errors,
    warnings,
    previousOdometer: null,
    distanceTravelled: null,
  };
}

export interface DuplicateReceiptCheckResult {
  isDuplicate: boolean;
  duplicateLogNumber?: string;
  duplicateDate?: string;
  reason?: string;
}

/**
 * Checks if a fuel receipt was already entered.
 */
export async function checkDuplicateFuelReceipt(params: {
  vehicleId: string;
  receiptNumber?: string | null;
  totalCost: number;
  fuelDate: Date;
  excludeId?: string;
}): Promise<DuplicateReceiptCheckResult> {
  const { vehicleId, receiptNumber, totalCost, fuelDate, excludeId } = params;

  // 1. If receipt number provided, check for identical receipt number across all fleet logs
  if (receiptNumber && receiptNumber.trim().length > 2) {
    const trimmed = receiptNumber.trim();
    const existing = await db.vehicleFuelLog.findFirst({
      where: {
        remarks: { contains: `Receipt: ${trimmed}` },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { logNumber: true, fuelDate: true },
    });

    if (existing) {
      return {
        isDuplicate: true,
        duplicateLogNumber: existing.logNumber,
        duplicateDate: existing.fuelDate.toISOString().slice(0, 10),
        reason: `A fuel log with receipt number "${trimmed}" already exists (${existing.logNumber}).`,
      };
    }
  }

  // 2. Same vehicle, same date, exact same total cost
  const startOfDay = new Date(fuelDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(fuelDate);
  endOfDay.setHours(23, 59, 59, 999);

  const sameDayMatch = await db.vehicleFuelLog.findFirst({
    where: {
      vehicleId,
      fuelDate: { gte: startOfDay, lte: endOfDay },
      totalCost: new Prisma.Decimal(totalCost),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { logNumber: true, fuelDate: true },
  });

  if (sameDayMatch) {
    return {
      isDuplicate: true,
      duplicateLogNumber: sameDayMatch.logNumber,
      duplicateDate: sameDayMatch.fuelDate.toISOString().slice(0, 10),
      reason: `A fuel log with identical vehicle, date, and amount ₹${totalCost.toFixed(2)} already exists (${sameDayMatch.logNumber}).`,
    };
  }

  return { isDuplicate: false };
}

export interface MileageDataPoint {
  id: string;
  logNumber: string;
  fuelDate: string;
  vehicleId: string;
  vehicleNumber: string;
  fuelType: string;
  odometerReading: number;
  previousOdometer: number | null;
  distanceKm: number | null;
  quantityLitres: number;
  pricePerUnit: number;
  totalCost: number;
  mileageKmPerLitre: number | null;
  costPerKm: number | null;
  isFullTank: boolean;
  stationName: string | null;
  receiptNumber: string | null;
}

/**
 * Reconstructs the full chronological mileage trend for a vehicle.
 */
export async function getMileageTrendData(params: {
  vehicleId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<MileageDataPoint[]> {
  const { vehicleId, startDate, endDate } = params;

  const logs = await db.vehicleFuelLog.findMany({
    where: {
      ...(vehicleId ? { vehicleId } : {}),
      ...(startDate || endDate
        ? {
            fuelDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
    },
    orderBy: { fuelDate: "asc" },
  });

  const dataPoints: MileageDataPoint[] = [];

  // Group by vehicle to calculate chronological deltas accurately
  const byVehicle = new Map<string, typeof logs>();
  for (const log of logs) {
    const list = byVehicle.get(log.vehicleId) || [];
    list.push(log);
    byVehicle.set(log.vehicleId, list);
  }

  for (const [, vehicleLogs] of byVehicle.entries()) {
    for (let i = 0; i < vehicleLogs.length; i++) {
      const curr = vehicleLogs[i];
      const prev = i > 0 ? vehicleLogs[i - 1] : null;

      const currOdo = Number(curr.odometerReading);
      const prevOdo = prev ? Number(prev.odometerReading) : null;

      let distanceKm: number | null = null;
      let mileage: number | null = null;
      let costPerKm: number | null = null;

      if (prevOdo !== null && currOdo > prevOdo) {
        distanceKm = Math.round((currOdo - prevOdo) * 100) / 100;
        const qty = Number(curr.quantityLitres);
        const cost = Number(curr.totalCost);

        if (qty > 0 && distanceKm > 0) {
          mileage = Math.round((distanceKm / qty) * 100) / 100;
          costPerKm = Math.round((cost / distanceKm) * 100) / 100;
        }
      }

      // Check for receipt number in remarks
      const receiptMatch = curr.remarks?.match(/Receipt:\s*([^\s;]+)/i);
      const receiptNumber = receiptMatch ? receiptMatch[1] : null;

      dataPoints.push({
        id: curr.id,
        logNumber: curr.logNumber,
        fuelDate: curr.fuelDate.toISOString(),
        vehicleId: curr.vehicleId,
        vehicleNumber: curr.vehicle.vehicleNumber,
        fuelType: curr.fuelType,
        odometerReading: currOdo,
        previousOdometer: prevOdo,
        distanceKm: curr.distanceSinceLast ? Number(curr.distanceSinceLast) : distanceKm,
        quantityLitres: Number(curr.quantityLitres),
        pricePerUnit: Number(curr.pricePerUnit),
        totalCost: Number(curr.totalCost),
        mileageKmPerLitre: curr.mileageKmPerLitre ? Number(curr.mileageKmPerLitre) : mileage,
        costPerKm: curr.costPerKm ? Number(curr.costPerKm) : costPerKm,
        isFullTank: curr.isFullTank,
        stationName: curr.fuelStation,
        receiptNumber,
      });
    }
  }

  // Return sorted newest first for tables or oldest first for charts
  return dataPoints;
}
