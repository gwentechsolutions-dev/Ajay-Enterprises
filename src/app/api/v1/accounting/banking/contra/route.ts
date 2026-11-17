import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { createContraTransactionSchema } from "@/lib/schemas/accounting";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "create");

    const body = await req.json();
    const parsed = createContraTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    if (input.fromAccountId === input.toAccountId) {
      return NextResponse.json(
        { success: false, error: { message: "Source and destination accounts must be different." } },
        { status: 400 }
      );
    }

    const [fromAcc, toAcc] = await Promise.all([
      db.chartOfAccount.findUnique({ where: { id: input.fromAccountId } }),
      db.chartOfAccount.findUnique({ where: { id: input.toAccountId } }),
    ]);

    if (!fromAcc || !toAcc) {
      return NextResponse.json({ success: false, error: { message: "Invalid account selected." } }, { status: 404 });
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const amount = new Prisma.Decimal(input.amount);
    const txnDate = input.transactionDate ? new Date(input.transactionDate) : new Date();
    const fiscalYear = getCurrentFiscalYear(txnDate);
    const txnNumber = `TXN-${Date.now()}`;

    const result = await db.$transaction(async (tx) => {
      // 1. Create Bank Transaction record
      const txn = await tx.bankTransaction.create({
        data: {
          transactionNumber: txnNumber,
          transactionType: "CONTRA_TRANSFER",
          accountId: input.toAccountId,
          counterpartyAccountId: input.fromAccountId,
          transactionDate: txnDate,
          amount,
          referenceNumber: input.referenceNumber || null,
          description: input.description,
          isReconciled: true,
          reconciledDate: txnDate,
        },
      });

      // 2. Post Double-Entry Journal
      // Dr: Destination Account (Increase asset)
      // Cr: Source Account (Decrease asset)
      const journalLines = [
        {
          accountId: input.toAccountId,
          description: `Contra Transfer: Received into ${toAcc.accountName}`,
          debitAmount: amount,
          creditAmount: new Prisma.Decimal(0),
        },
        {
          accountId: input.fromAccountId,
          description: `Contra Transfer: Disbursed from ${fromAcc.accountName}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: amount,
        },
      ];

      const journal = await postJournalEntry(
        {
          journalType: "CONTRA",
          narration: `Contra Transfer: ₹${amount.toFixed(2)} transferred from ${fromAcc.accountName} to ${toAcc.accountName}. ${input.description}`,
          referenceDocumentType: "CONTRA",
          referenceDocumentId: txn.id,
          referenceNumber: txnNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      return { txn, journal };
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Contra transfer of ₹${amount.toFixed(2)} completed. Journal: ${result.journal.journalNumber}.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

