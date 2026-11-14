import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface LabourReportFilters {
  workerId?: string;
  category?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

export async function getLabourReportsData(filters?: LabourReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    workerSummary,
    attendanceSummary,
    wageExpenseSummary,
    advancesSummary,
    wagesPayableBalance,
  ] = await Promise.all([
    getWorkerSummary(),
    getAttendanceSummary(start, end, filters?.workerId),
    getWageExpenseSummary(start, end, filters?.workerId),
    getAdvancesSummary(filters?.workerId),
    getWagesPayableBalance(),
  ]);

  return {
    period: { start, end },
    workerSummary,
    attendanceSummary,
    wageExpenseSummary,
    advancesSummary,
    wagesPayableBalance,
  };
}

async function getWorkerSummary() {
  const [total, active, categories] = await Promise.all([
    db.labourWorker.count(),
    db.labourWorker.count({ where: { status: "ACTIVE" } }),
    db.labourWorker.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { status: "ACTIVE" },
    }),
  ]);

  return {
    totalWorkers: total,
    activeWorkers: active,
    categoryBreakdown: categories.map((c) => ({
      category: c.category,
      count: c._count.id,
    })),
  };
}

async function getAttendanceSummary(start: Date, end: Date, workerId?: string) {
  const records = await db.labourAttendance.findMany({
    where: {
      attendanceDate: { gte: start, lte: end },
      ...(workerId ? { workerId } : {}),
    },
    include: {
      worker: { select: { name: true, workerCode: true, category: true, dailyWage: true } },
    },
  });

  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let totalOvertimeHours = new Prisma.Decimal(0);
  let totalOvertimePay = new Prisma.Decimal(0);

  for (const r of records) {
    if (r.status === "PRESENT") presentCount++;
    else if (r.status === "HALF_DAY") halfDayCount++;
    else if (r.status === "ABSENT") absentCount++;

    const ot = new Prisma.Decimal(r.overtimeHours || 0);
    totalOvertimeHours = totalOvertimeHours.plus(ot);

    // Standard 8hr day overtime estimation
    const hourlyRate = new Prisma.Decimal(r.worker.dailyWage).dividedBy(8);
    totalOvertimePay = totalOvertimePay.plus(ot.times(hourlyRate));
  }

  return {
    totalRecords: records.length,
    presentCount,
    halfDayCount,
    absentCount,
    totalOvertimeHours,
    totalOvertimePay: Math.round(totalOvertimePay.toNumber() * 100) / 100,
  };
}

async function getWageExpenseSummary(start: Date, end: Date, workerId?: string) {
  const settlements = await db.labourWageSettlement.findMany({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      periodEnd: { gte: start, lte: end },
      ...(workerId ? { workerId } : {}),
    },
    include: {
      worker: { select: { name: true, workerCode: true } },
    },
    orderBy: { periodEnd: "desc" },
  });

  let grossWages = new Prisma.Decimal(0);
  let advancesDeducted = new Prisma.Decimal(0);
  let netPayable = new Prisma.Decimal(0);

  for (const s of settlements) {
    grossWages = grossWages.plus(new Prisma.Decimal(s.grossAmount));
    advancesDeducted = advancesDeducted.plus(new Prisma.Decimal(s.advanceDeduction));
    netPayable = netPayable.plus(new Prisma.Decimal(s.netPayable));
  }

  return {
    settlementsCount: settlements.length,
    totalGrossWages: grossWages,
    totalAdvancesRecovered: advancesDeducted,
    totalNetWages: netPayable,
    recentSettlements: settlements.slice(0, 15).map((s) => ({
      id: s.id,
      settlementNumber: s.settlementNumber,
      workerName: s.worker.name,
      periodStartDate: s.periodStart,
      periodEndDate: s.periodEnd,
      grossWageAmount: s.grossAmount,
      advanceDeductionAmount: s.advanceDeduction,
      netPayableAmount: s.netPayable,
      paymentStatus: s.status,
    })),
  };
}

async function getAdvancesSummary(workerId?: string) {
  const advances = await db.labourAdvance.findMany({
    where: {
      status: { in: ["APPROVED", "PARTIALLY_RECOVERED"] },
      ...(workerId ? { workerId } : {}),
    },
    include: {
      worker: { select: { name: true, workerCode: true } },
    },
    orderBy: { advanceDate: "desc" },
  });

  let totalAdvanced = new Prisma.Decimal(0);
  let totalRecovered = new Prisma.Decimal(0);
  let totalRemaining = new Prisma.Decimal(0);

  for (const a of advances) {
    totalAdvanced = totalAdvanced.plus(new Prisma.Decimal(a.amount));
    totalRecovered = totalRecovered.plus(new Prisma.Decimal(a.recoveredAmount));
    totalRemaining = totalRemaining.plus(new Prisma.Decimal(a.outstandingAmount));
  }

  return {
    totalAdvanceIssued: totalAdvanced,
    totalAdvanceRecovered: totalRecovered,
    outstandingAdvanceReceivable: totalRemaining, // Reconciles with Account 1070
    advancesCount: advances.length,
    activeAdvances: advances.slice(0, 15).map((a) => ({
      id: a.id,
      advanceNumber: a.advanceNumber,
      workerName: a.worker.name,
      advanceDate: a.advanceDate,
      amount: a.amount,
      recoveredAmount: a.recoveredAmount,
      remainingAmount: a.outstandingAmount,
      status: a.status,
    })),
  };
}

/**
 * Reconciles Wages Payable (Account 2070) balance
 */
async function getWagesPayableBalance() {
  const wagesAccount = await db.chartOfAccount.findUnique({
    where: { accountCode: "2070" },
    include: {
      journalLines: {
        where: { journalEntry: { status: "POSTED" } },
        select: { debitAmount: true, creditAmount: true },
      },
    },
  });

  if (!wagesAccount) {
    return new Prisma.Decimal(0);
  }

  const debits = wagesAccount.journalLines.reduce(
    (sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)),
    new Prisma.Decimal(0)
  );
  const credits = wagesAccount.journalLines.reduce(
    (sum, l) => sum.plus(new Prisma.Decimal(l.creditAmount)),
    new Prisma.Decimal(0)
  );

  return credits.minus(debits);
}
