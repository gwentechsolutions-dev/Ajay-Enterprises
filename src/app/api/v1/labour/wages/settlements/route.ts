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
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const calc = await calculateWorkerWages({
      workerId: input.workerId,
      periodStart,
      periodEnd,
      overtimeRatePerHour: input.overtimeRatePerHour,
      halfDayFactor: input.halfDayFactor,
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
        const wageExpenseAccount = await getSystemAccount("5030", tx); // Yard Labour & Loading Wages
        const advanceAccount = await getSystemAccount("1050", tx); // Advances
        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : await getSystemAccount("1010", tx); // Default cash

        if (wageExpenseAccount && paymentAccount) {
          const lines = [
            {
              accountId: wageExpenseAccount.id,
              description: `Gross Wages for ${calc.workerName} (${calc.workerCode})`,
              debitAmount: calc.grossAmount,
              creditAmount: new Prisma.Decimal(0),
            },
          ];

          if (calc.advanceDeduction.gt(0) && advanceAccount) {
            lines.push({
              accountId: advanceAccount.id,
              description: `Advance recovery from ${calc.workerName}`,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: calc.advanceDeduction,
            });
          }

          if (calc.netPayable.gt(0)) {
            lines.push({
              accountId: paymentAccount.id,
              description: `Net Wage Payment to ${calc.workerName} for ${settlementNumber}`,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: calc.netPayable,
            });
          }

          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Wage settlement for ${calc.workerName} (${calc.workerCode}) for period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
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

