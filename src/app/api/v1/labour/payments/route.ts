import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { recordLabourPaymentSchema } from "@/lib/schemas/labour";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get("workerId") || undefined;

    const payments = await db.labourPayment.findMany({
      where: workerId ? { workerId } : undefined,
      include: {
        worker: { select: { id: true, name: true, workerCode: true } },
        wageSettlement: { select: { id: true, settlementNumber: true, netPayable: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "create");

    const body = await req.json();
    const parsed = recordLabourPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const amount = new Prisma.Decimal(input.amount);
    const paymentNumber = await generateNextDocumentNumber("LAB_PAY");

    const payment = await db.$transaction(async (tx) => {
      const worker = await tx.labourWorker.findUnique({ where: { id: input.workerId } });
      if (!worker) {
        throw new Error(`Worker '${input.workerId}' not found.`);
      }

      // Accounting Journal Entry: Debit Wages Payable (2060) or Labour Expense (5040), Credit Cash/Bank
      let journalId: string | null = null;
      if (input.postToAccounts) {
        const debitAccount = input.wageSettlementId
          ? (await getSystemAccount("2060", tx)) || (await getSystemAccount("5040", tx))
          : await getSystemAccount("5040", tx);
        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : input.paymentMode === "CASH"
          ? await getSystemAccount("1010", tx)
          : await getSystemAccount("1020", tx);

        if (debitAccount && paymentAccount) {
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Labour wage payment to ${worker.name} (${worker.workerCode}) - ₹${amount.toString()}`,
              referenceDocumentType: "LABOUR_PAYMENT",
              referenceDocumentId: paymentNumber,
              referenceNumber: paymentNumber,
              lines: [
                {
                  accountId: debitAccount.id,
                  description: `Wage payment to ${worker.name}`,
                  debitAmount: amount,
                  creditAmount: new Prisma.Decimal(0),
                },
                {
                  accountId: paymentAccount.id,
                  description: `Payment voucher - ${paymentNumber}`,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: amount,
                },
              ],
            },
            { id: session!.id, name: session!.name, role: session!.role, ipAddress: req.headers.get("x-forwarded-for") || undefined },
            tx
          );
          journalId = journal.id;
        }
      }

      const created = await tx.labourPayment.create({
        data: {
          paymentNumber,
          workerId: input.workerId,
          wageSettlementId: input.wageSettlementId || null,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          amount,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference || null,
          paidFromAccountId: input.paidFromAccountId || null,
          receiptDocumentUrl: input.receiptDocumentUrl || null,
          journalEntryId: journalId,
          remarks: input.remarks || null,
          status: "POSTED",
        },
      });

      // Update wage settlement paid amount if linked
      if (input.wageSettlementId) {
        const stm = await tx.labourWageSettlement.findUnique({ where: { id: input.wageSettlementId } });
        if (stm) {
          const newPaid = new Prisma.Decimal(stm.paidAmount).plus(amount);
          const isFullyPaid = newPaid.gte(new Prisma.Decimal(stm.netPayable));
          await tx.labourWageSettlement.update({
            where: { id: input.wageSettlementId },
            data: {
              paidAmount: newPaid,
              status: isFullyPaid ? "PAID" : stm.status,
            },
          });
        }
      }

      return created;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "labour",
      entityType: "LabourPayment",
      entityId: payment.id,
      afterState: payment,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: payment, message: `Payment ${payment.paymentNumber} recorded.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

