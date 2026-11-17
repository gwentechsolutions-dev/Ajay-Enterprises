import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { calculateWageSettlementSchema } from "@/lib/schemas/labour";
import { calculateWorkerWages } from "@/lib/labour/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get("workerId") || undefined;
    const status = searchParams.get("status") || undefined;

    const settlements = await db.labourWageSettlement.findMany({
      where: {
        ...(workerId ? { workerId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, workerCode: true, category: true, mobileNumber: true } },
      },
      orderBy: { periodEnd: "desc" },
    });

    return NextResponse.json({ success: true, data: settlements });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "approve");

    const body = await req.json();
    const parsed = calculateWageSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    // Prevent duplicate settlements for the same worker and overlapping period
    const overlapping = await db.labourWageSettlement.findFirst({
      where: {
        workerId: input.workerId,
        status: { notIn: ["CANCELLED", "REVERSED"] },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });
    if (overlapping) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OVERLAPPING_SETTLEMENT",
            message: `Worker already has active wage settlement ${overlapping.settlementNumber} for overlapping period (${overlapping.periodStart.toISOString().split("T")[0]} to ${overlapping.periodEnd.toISOString().split("T")[0]}).`,
          },
        },
        { status: 422 }
      );
    }

    const calc = await calculateWorkerWages({
      workerId: input.workerId,
      periodStart,
      periodEnd,
      overtimeRatePerHour: input.overtimeRatePerHour,
      overtimeMultiplier: input.overtimeMultiplier,
      requireApprovedOvertimeOnly: input.requireApprovedOvertimeOnly,
      halfDayFactor: input.halfDayFactor,
      monthlyProrationPolicy: input.monthlyProrationPolicy,
      bonusAmount: input.bonusAmount,
      otherDeductions: input.otherDeductions,
      advanceDeduction: input.advanceDeduction,
    });

    const settlementNumber = await generateNextDocumentNumber("LAB_WAGE");

    const settlement = await db.$transaction(async (tx) => {
      // 1. Recover advances if applicable
      let remainingAdvanceToRecover = calc.advanceDeduction;
      if (remainingAdvanceToRecover.gt(0)) {
        const activeAdvances = await tx.labourAdvance.findMany({
          where: {
            workerId: input.workerId,
            status: { in: ["APPROVED", "PARTIALLY_RECOVERED"] },
          },
          orderBy: { advanceDate: "asc" },
        });

        for (const adv of activeAdvances) {
          if (remainingAdvanceToRecover.lte(0)) break;
          const out = new Prisma.Decimal(adv.outstandingAmount);
          const recoverFromThis = remainingAdvanceToRecover.gte(out) ? out : remainingAdvanceToRecover;
          const newRecovered = new Prisma.Decimal(adv.recoveredAmount).plus(recoverFromThis);
          const newOut = out.minus(recoverFromThis);

          await tx.labourAdvance.update({
            where: { id: adv.id },
            data: {
              recoveredAmount: newRecovered,
              outstandingAmount: newOut,
              status: newOut.lte(0) ? "RECOVERED" : "PARTIALLY_RECOVERED",
            },
          });

          remainingAdvanceToRecover = remainingAdvanceToRecover.minus(recoverFromThis);
        }
      }

      // 2. Post Accounting Journal if requested
      let journalId: string | null = null;
      if (input.postToAccounts && calc.grossAmount.gt(0)) {
        const wageExpenseAccount = await getSystemAccount("5040", tx); // Yard Labour Wages (Expense)
        const wagesPayableAccount = await getSystemAccount("2070", tx); // Wages & Labour Payable (Liability)
        const advanceAccount = await getSystemAccount("1070", tx); // Employee & Labour Advances (Asset)

        if (wageExpenseAccount && wagesPayableAccount) {
          // B. Gross wage accrual: Dr Wage Expense (5040), Cr Wages Payable (2070)
          const lines = [
            {
              accountId: wageExpenseAccount.id,
              description: `Gross Wages for ${calc.workerName} (${calc.workerCode})`,
              debitAmount: calc.grossAmount,
              creditAmount: new Prisma.Decimal(0),
            },
            {
              accountId: wagesPayableAccount.id,
              description: `Gross Wages Accrual for ${calc.workerName}`,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: calc.grossAmount,
            },
          ];

          // C. Advance recovery: Dr Wages Payable (2070), Cr Employee Advances (1070)
          if (calc.advanceDeduction.gt(0) && advanceAccount) {
            lines.push({
              accountId: wagesPayableAccount.id,
              description: `Advance recovery deduction for ${calc.workerName}`,
              debitAmount: calc.advanceDeduction,
              creditAmount: new Prisma.Decimal(0),
            });
            lines.push({
              accountId: advanceAccount.id,
              description: `Advance recovery from ${calc.workerName}`,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: calc.advanceDeduction,
            });
          }

          const journal = await postJournalEntry(
            {
              journalType: "ADJUSTMENT",
              postingDate: new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Wage accrual & advance recovery for ${calc.workerName} (${calc.workerCode}) for period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
              referenceDocumentType: "WAGE_SETTLEMENT",
              referenceDocumentId: settlementNumber,
              referenceNumber: settlementNumber,
              lines,
            },
            { id: session!.id, name: session!.name, role: session!.role, ipAddress: req.headers.get("x-forwarded-for") || undefined },
            tx
          );
          journalId = journal.id;
        }
      }

      // 3. Create Settlement
      const created = await tx.labourWageSettlement.create({
        data: {
          settlementNumber,
          workerId: input.workerId,
          periodStart,
          periodEnd,
          daysPresent: calc.daysPresent,
          halfDays: calc.halfDays,
          daysLeave: calc.daysLeave,
          overtimeHours: calc.overtimeHours,
          baseWageAmount: calc.baseWageAmount,
          overtimeAmount: calc.overtimeAmount,
          bonusAmount: calc.bonusAmount,
          grossAmount: calc.grossAmount,
          advanceDeduction: calc.advanceDeduction,
          otherDeductions: calc.otherDeductions,
          netPayable: calc.netPayable,
          paidAmount: input.postToAccounts ? calc.netPayable : new Prisma.Decimal(0),
          status: input.postToAccounts ? "PAID" : "APPROVED",
          approvedById: session!.id,
          approvedAt: new Date(),
          journalEntryId: journalId,
          remarks: input.remarks || null,
        },
      });

      return created;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "APPROVE",
      module: "labour",
      entityType: "LabourWageSettlement",
      entityId: settlement.id,
      afterState: settlement,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: settlement,
      message: `Wage settlement ${settlement.settlementNumber} approved. Net payable: ₹${Number(settlement.netPayable).toFixed(2)}`,
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

