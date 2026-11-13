import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { closeFinancialYearSchema } from "@/lib/schemas/accounting";
import { postJournalEntry } from "@/lib/accounting/ledger";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "admin");

    const body = await req.json();
    const parsed = closeFinancialYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const { fiscalYear, retainedEarningsAccountId, remarks } = parsed.data;

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    // 1. Check if this FY is already closed
    const existingClosing = await db.financialYearClosing.findUnique({
      where: { fiscalYear },
    });
    if (existingClosing && existingClosing.isClosed) {
      return NextResponse.json(
        { success: false, error: { message: `Financial Year ${fiscalYear} is already closed.` } },
        { status: 400 }
      );
    }

    // 2. Validate Retained Earnings account
    const retainedEarningsAccount = await db.chartOfAccount.findUnique({
      where: { id: retainedEarningsAccountId },
    });
    if (!retainedEarningsAccount || retainedEarningsAccount.accountCategory !== "EQUITY") {
      return NextResponse.json(
        { success: false, error: { message: "Invalid Retained Earnings account. Must be an EQUITY account." } },
        { status: 400 }
      );
    }

    // 3. Find all income and expense accounts with non-zero balances
    const pnlAccounts = await db.chartOfAccount.findMany({
      where: {
        accountCategory: { in: ["INCOME", "EXPENSE"] },
        isActive: true,
      },
    });

    // 4. Calculate Net Profit / Loss and prepare closing journal lines
    let totalIncome = new Prisma.Decimal(0);
    let totalExpenses = new Prisma.Decimal(0);
    const closingLines: Array<{
      accountId: string;
      debitAmount: number;
      creditAmount: number;
      description: string;
    }> = [];

    for (const acc of pnlAccounts) {
      const bal = new Prisma.Decimal(acc.currentBalance);
      if (bal.isZero()) continue;

      if (acc.accountCategory === "INCOME") {
        // Income normal balance is Credit. To zero it out, DEBIT the account.
        totalIncome = totalIncome.plus(bal);
        closingLines.push({
          accountId: acc.id,
          debitAmount: bal.toNumber(),
          creditAmount: 0,
          description: `Close ${acc.accountName} to Retained Earnings for FY ${fiscalYear}`,
        });
      } else if (acc.accountCategory === "EXPENSE") {
        // Expense normal balance is Debit. To zero it out, CREDIT the account.
        totalExpenses = totalExpenses.plus(bal);
        closingLines.push({
          accountId: acc.id,
          debitAmount: 0,
          creditAmount: bal.toNumber(),
          description: `Close ${acc.accountName} to Retained Earnings for FY ${fiscalYear}`,
        });
      }
    }

    const netProfitOrLoss = totalIncome.minus(totalExpenses);

    // If there are closing lines, balance them against Retained Earnings
    let journal = null;
    if (closingLines.length > 0) {
      if (netProfitOrLoss.gt(0)) {
        // Net Profit: Credit Retained Earnings
        closingLines.push({
          accountId: retainedEarningsAccount.id,
          debitAmount: 0,
          creditAmount: netProfitOrLoss.toNumber(),
          description: `Net Profit transfer to Retained Earnings for FY ${fiscalYear}`,
        });
      } else if (netProfitOrLoss.lt(0)) {
        // Net Loss: Debit Retained Earnings
        closingLines.push({
          accountId: retainedEarningsAccount.id,
          debitAmount: netProfitOrLoss.abs().toNumber(),
          creditAmount: 0,
          description: `Net Loss absorption from Retained Earnings for FY ${fiscalYear}`,
        });
      }

      // Post the Year-End Closing Journal
      journal = await postJournalEntry(
        {
          journalType: "YEAR_END_CLOSING",
          narration: `Annual Financial Year Closing for FY ${fiscalYear}. Net Profit/Loss: ₹${netProfitOrLoss.toFixed(2)}. ${remarks || ""}`.trim(),
          postingDate: new Date(),
          referenceDocumentType: "FY_CLOSING",
          referenceNumber: `FY-CLOSE-${fiscalYear}`,
          lines: closingLines,
        },
        actor
      );
    }

    // 5. Lock all periods belonging to this fiscal year
    await db.accountingPeriod.updateMany({
      where: { fiscalYear },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedById: actor.id,
        notes: `Locked upon Financial Year ${fiscalYear} closure`,
      },
    });

    // 6. Record FinancialYearClosing
    const [startYear] = fiscalYear.split("-");
    const startDate = new Date(parseInt(startYear, 10), 3, 1);
    const endDate = new Date(parseInt(startYear, 10) + 1, 2, 31, 23, 59, 59);

    const closingRecord = await db.financialYearClosing.upsert({
      where: { fiscalYear },
      create: {
        fiscalYear,
        startDate,
        endDate,
        isClosed: true,
        closedAt: new Date(),
        closedById: actor.id,
        retainedEarningsTransferred: netProfitOrLoss,
        closingJournalId: journal?.id || null,
        remarks,
      },
      update: {
        isClosed: true,
        closedAt: new Date(),
        closedById: actor.id,
        retainedEarningsTransferred: netProfitOrLoss,
        closingJournalId: journal?.id || null,
        remarks,
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "CLOSE_FINANCIAL_YEAR",
      module: "accounting",
      entityType: "FinancialYearClosing",
      entityId: closingRecord.id,
      notes: `Financial Year ${fiscalYear} closed. Net Profit/Loss: ₹${netProfitOrLoss.toFixed(2)}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        closing: closingRecord,
        netProfitOrLoss: netProfitOrLoss.toNumber(),
        closingJournal: journal,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED")
      ? 401
      : error.message.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
