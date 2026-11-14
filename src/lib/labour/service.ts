import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";

// ==============================================================================
// INVENTRA: LABOUR & WORKFORCE SERVICE
// AJAY ENTERPRISES | Domain: Workforce Management & Wage ERP
// ==============================================================================

export interface WageCalculationDetail {
  workerId: string;
  workerName: string;
  workerCode: string;
  wageType: string;
  dailyWage: Prisma.Decimal;
  monthlySalary: Prisma.Decimal;
  daysPresent: Prisma.Decimal;
  halfDays: Prisma.Decimal;
  daysLeave: Prisma.Decimal;
  overtimeHours: Prisma.Decimal;
  baseWageAmount: Prisma.Decimal;
  overtimeAmount: Prisma.Decimal;
  bonusAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  advanceDeduction: Prisma.Decimal;
  otherDeductions: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  outstandingAdvance: Prisma.Decimal;
}

/**
 * Calculates wages for a worker over a specified date range based on attendance and advances.
 */
export async function calculateWorkerWages(params: {
  workerId: string;
  periodStart: Date;
  periodEnd: Date;
  overtimeRatePerHour?: number;
  overtimeMultiplier?: number;
  requireApprovedOvertimeOnly?: boolean;
  halfDayFactor?: number;
  monthlyProrationPolicy?: "STANDARD_30_DAYS" | "ACTUAL_MONTH_DAYS" | "WORKING_DAYS_EXCLUDING_SUNDAYS";
  bonusAmount?: number;
  otherDeductions?: number;
  advanceDeduction?: number;
}): Promise<WageCalculationDetail> {
  const worker = await db.labourWorker.findUnique({
    where: { id: params.workerId },
    include: {
      advances: {
        where: { status: { in: ["APPROVED", "PARTIALLY_RECOVERED"] } },
      },
    },
  });

  if (!worker) {
    throw new Error(`Worker with ID '${params.workerId}' not found.`);
  }

  // Fetch all attendance records within the date range
  const attendances = await db.labourAttendance.findMany({
    where: {
      workerId: params.workerId,
      attendanceDate: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
    },
  });

  let daysPresent = new Prisma.Decimal(0);
  let halfDays = new Prisma.Decimal(0);
  let daysLeave = new Prisma.Decimal(0);
  let overtimeHours = new Prisma.Decimal(0);

  for (const att of attendances) {
    if (att.status === "PRESENT") {
      daysPresent = daysPresent.plus(1);
    } else if (att.status === "HALF_DAY") {
      halfDays = halfDays.plus(1);
    } else if (att.status === "PAID_LEAVE" || att.status === "UNPAID_LEAVE") {
      daysLeave = daysLeave.plus(1);
    }
    if (att.overtimeHours && new Prisma.Decimal(att.overtimeHours).gt(0)) {
      // Overtime requires authorized supervisor approval unless explicitly allowed
      if (params.requireApprovedOvertimeOnly === false || att.isApproved) {
        overtimeHours = overtimeHours.plus(new Prisma.Decimal(att.overtimeHours));
      }
    }
  }

  const halfDayFactor = new Prisma.Decimal(params.halfDayFactor ?? 0.5);
  let baseWageAmount = new Prisma.Decimal(0);

  if (worker.wageType === "DAILY") {
    const dailyRate = new Prisma.Decimal(worker.dailyWage);
    const fullDayWage = daysPresent.times(dailyRate);
    const halfDayWage = halfDays.times(dailyRate).times(halfDayFactor);
    baseWageAmount = fullDayWage.plus(halfDayWage);
  } else {
    // Configurable Monthly salary proration policy
    const monthlyRate = new Prisma.Decimal(worker.monthlySalary);
    const effectiveDays = daysPresent.plus(halfDays.times(halfDayFactor));

    const policy = params.monthlyProrationPolicy || "STANDARD_30_DAYS";
    let divisorDays = 30;

    if (policy === "ACTUAL_MONTH_DAYS") {
      const year = params.periodStart.getFullYear();
      const month = params.periodStart.getMonth() + 1;
      divisorDays = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31
    } else if (policy === "WORKING_DAYS_EXCLUDING_SUNDAYS") {
      // Count total non-Sunday days in period
      let workingDays = 0;
      const curr = new Date(params.periodStart);
      while (curr <= params.periodEnd) {
        if (curr.getDay() !== 0) workingDays++;
        curr.setDate(curr.getDate() + 1);
      }
      divisorDays = workingDays > 0 ? workingDays : 26;
    }

    if (effectiveDays.gte(divisorDays)) {
      baseWageAmount = monthlyRate;
    } else {
      const dailyEquivalent = monthlyRate.dividedBy(divisorDays);
      baseWageAmount = dailyEquivalent.times(effectiveDays).toDecimalPlaces(2);
    }
  }

  // Calculate Overtime with configurable multiplier
  const otMultiplier = new Prisma.Decimal(params.overtimeMultiplier ?? 1.5);
  const defaultOtRate = worker.wageType === "DAILY"
    ? new Prisma.Decimal(worker.dailyWage).dividedBy(8).times(otMultiplier)
    : new Prisma.Decimal(worker.monthlySalary).dividedBy(30 * 8).times(otMultiplier);
  const otRate = params.overtimeRatePerHour ? new Prisma.Decimal(params.overtimeRatePerHour) : defaultOtRate;
  const overtimeAmount = overtimeHours.times(otRate).toDecimalPlaces(2);

  const bonusAmount = new Prisma.Decimal(params.bonusAmount ?? 0);
  const otherDeductions = new Prisma.Decimal(params.otherDeductions ?? 0);

  const grossAmount = baseWageAmount.plus(overtimeAmount).plus(bonusAmount);

  // Outstanding advances
  const totalOutstandingAdvance = worker.advances.reduce(
    (sum, adv) => sum.plus(new Prisma.Decimal(adv.outstandingAmount)),
    new Prisma.Decimal(0)
  );

  let advanceDeduction = new Prisma.Decimal(params.advanceDeduction ?? 0);
  if (!params.advanceDeduction && totalOutstandingAdvance.gt(0)) {
    // Default recovery: up to 50% of gross or outstanding balance, whichever is less
    const maxRecovery = grossAmount.times(0.5);
    advanceDeduction = totalOutstandingAdvance.lt(maxRecovery) ? totalOutstandingAdvance : maxRecovery;
  }

  const netPayable = grossAmount.minus(advanceDeduction).minus(otherDeductions);

  return {
    workerId: worker.id,
    workerName: worker.name,
    workerCode: worker.workerCode,
    wageType: worker.wageType,
    dailyWage: new Prisma.Decimal(worker.dailyWage),
    monthlySalary: new Prisma.Decimal(worker.monthlySalary),
    daysPresent,
    halfDays,
    daysLeave,
    overtimeHours,
    baseWageAmount,
    overtimeAmount,
    bonusAmount,
    grossAmount,
    advanceDeduction,
    otherDeductions,
    netPayable: netPayable.lt(0) ? new Prisma.Decimal(0) : netPayable,
    outstandingAdvance: totalOutstandingAdvance,
  };
}

