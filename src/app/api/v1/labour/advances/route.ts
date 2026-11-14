import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { postJournalEntry, getSystemAccount } from "@/lib/accounting/ledger";
import { logAuditEvent } from "@/lib/audit";
import { createLabourAdvanceSchema } from "@/lib/schemas/labour";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get("workerId") || undefined;
    const status = searchParams.get("status") || undefined;

    const advances = await db.labourAdvance.findMany({
      where: {
        ...(workerId ? { workerId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, workerCode: true, mobileNumber: true } },
      },
      orderBy: { advanceDate: "desc" },
    });

    return NextResponse.json({ success: true, data: advances });
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
    const parsed = createLabourAdvanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const amount = new Prisma.Decimal(input.amount);
    const advanceNumber = input.advanceNumber || (await generateNextDocumentNumber("LAB_ADV"));

    const advance = await db.$transaction(async (tx) => {
      const worker = await tx.labourWorker.findUnique({ where: { id: input.workerId } });
      if (!worker) {
        throw new Error(`Worker '${input.workerId}' not found.`);
      }

      // Accounting Journal Entry: Debit Employee Advances (1060), Credit Cash/Bank
      let journalId: string | null = null;
      if (input.postToAccounts) {
        const advanceAccount = await getSystemAccount("1060", tx);
        const paymentAccount = input.paidFromAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: input.paidFromAccountId } })
          : input.paymentMode === "CASH"
          ? await getSystemAccount("1010", tx)
          : await getSystemAccount("1020", tx);

        if (advanceAccount && paymentAccount) {
          const journal = await postJournalEntry(
            {
              journalType: "PAYMENT",
              postingDate: input.advanceDate ? new Date(input.advanceDate) : new Date(),
              fiscalYear: getCurrentFiscalYear(),
              narration: `Labour Advance issued to ${worker.name} (${worker.workerCode}) - ₹${amount.toString()}`,
              referenceDocumentType: "LABOUR_ADVANCE",
              referenceDocumentId: advanceNumber,
              referenceNumber: advanceNumber,
              lines: [
                {
                  accountId: advanceAccount.id,
                  description: `Advance to worker ${worker.name}`,
                  debitAmount: amount,
                  creditAmount: new Prisma.Decimal(0),
                },
                {
                  accountId: paymentAccount.id,
                  description: `Payment of advance - ${advanceNumber}`,
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

      const created = await tx.labourAdvance.create({
        data: {
          advanceNumber,
          workerId: input.workerId,
          advanceDate: input.advanceDate ? new Date(input.advanceDate) : new Date(),
          amount,
          recoveredAmount: new Prisma.Decimal(0),
          outstandingAmount: amount,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference || null,
          paidFromAccountId: input.paidFromAccountId || null,
          purpose: input.purpose || null,
          status: "APPROVED",
          approvedById: session!.id,
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
      action: "CREATE",
      module: "labour",
      entityType: "LabourAdvance",
      entityId: advance.id,
      afterState: advance,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: advance, message: `Advance ${advance.advanceNumber} issued.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

