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
  halfDayFactor?: number;
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
      overtimeHours = overtimeHours.plus(new Prisma.Decimal(att.overtimeHours));
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
    // Monthly salary: prorate based on 30 standard working days if partial
    const monthlyRate = new Prisma.Decimal(worker.monthlySalary);
    baseWageAmount = monthlyRate;
  }

  // Calculate Overtime
  const defaultOtRate = worker.wageType === "DAILY"
    ? new Prisma.Decimal(worker.dailyWage).dividedBy(8).times(1.5) // 1.5x hourly rate
    : new Prisma.Decimal(100);
  const otRate = params.overtimeRatePerHour ? new Prisma.Decimal(params.overtimeRatePerHour) : defaultOtRate;
  const overtimeAmount = overtimeHours.times(otRate);

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

