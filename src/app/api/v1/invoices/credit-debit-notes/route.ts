import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { createCreditDebitNoteSchema } from "@/lib/schemas/accounting";
import { calculateGst } from "@/lib/accounting/gst-engine";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");

    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");
    const customerId = searchParams.get("customerId");
    const type = searchParams.get("type");

    const notes = await db.creditDebitNote.findMany({
      where: {
        ...(invoiceId ? { invoiceId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(type ? { noteType: type } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        invoice: { select: { id: true, invoiceNumber: true, grandTotal: true } },
        items: true,
      },
      orderBy: { noteDate: "desc" },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "create");

    const body = await req.json();
    const parsed = createCreditDebitNoteSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { message: "Referenced invoice not found" } }, { status: 404 });
    }

    const noteDate = input.noteDate ? new Date(input.noteDate) : new Date();
    const fiscalYear = getCurrentFiscalYear(noteDate);

    // Compute GST on adjustment amount
    const gst = calculateGst({
      taxableValue: input.taxableAmount,
      gstRatePercent: input.gstRatePercent,
      placeOfSupply: invoice.placeOfSupply,
    });

    const prefix = input.noteType === "CREDIT_NOTE" ? "CREDIT_NOTE" : "DEBIT_NOTE";
    const noteNumber = input.noteNumber || (await generateNextDocumentNumber(prefix as any));

    const result = await db.$transaction(async (tx) => {
      // 1. Create Credit/Debit Note
      const note = await tx.creditDebitNote.create({
        data: {
          noteNumber,
          noteType: input.noteType,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          noteDate,
          fiscalYear,
          reason: input.reason,
          taxableAmount: gst.taxableValue,
          cgstAmount: gst.cgstAmount,
          sgstAmount: gst.sgstAmount,
          igstAmount: gst.igstAmount,
          totalAmount: gst.totalAmount,
          status: "POSTED",
          remarks: input.remarks || null,
          items: {
            create: [
              {
                description: input.description,
                hsnSacCode: input.hsnSacCode || "9973",
                taxableValue: gst.taxableValue,
                gstRatePercent: gst.gstRatePercent,
                cgstAmount: gst.cgstAmount,
                sgstAmount: gst.sgstAmount,
                igstAmount: gst.igstAmount,
                totalAmount: gst.totalAmount,
              },
            ],
          },
        },
      });

      // 2. Adjust invoice outstanding balance
      if (input.noteType === "CREDIT_NOTE") {
        const newOutstanding = new Prisma.Decimal(invoice.outstandingAmount).minus(gst.totalAmount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            outstandingAmount: newOutstanding.lt(0) ? new Prisma.Decimal(0) : newOutstanding,
            paymentStatus: newOutstanding.lte(0) ? "PAID" : "PARTIAL",
          },
        });
      } else {
        const newOutstanding = new Prisma.Decimal(invoice.outstandingAmount).plus(gst.totalAmount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            outstandingAmount: newOutstanding,
          },
        });
      }

      // 3. Post Double-Entry Journal
      const arAccount = await getSystemAccount("1030", tx);
      const incomeAccount = await getSystemAccount("4010", tx);
      const cgstAccount = await getSystemAccount("2041", tx);
      const sgstAccount = await getSystemAccount("2042", tx);
      const igstAccount = await getSystemAccount("2043", tx);

      let journalLines = [];

      if (input.noteType === "CREDIT_NOTE") {
        // CREDIT NOTE: Reduces customer receivable (Credit AR, Debit Revenue & GST Output)
        journalLines = [
          {
            accountId: arAccount!.id,
            description: `Credit Note ${noteNumber} on Inv ${invoice.invoiceNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: gst.totalAmount,
            customerId: invoice.customerId,
          },
          {
            accountId: incomeAccount!.id,
            description: `Revenue reduction for Credit Note ${noteNumber}`,
            debitAmount: gst.taxableValue,
            creditAmount: new Prisma.Decimal(0),
            customerId: invoice.customerId,
          },
        ];
        if (gst.cgstAmount.gt(0)) {
          journalLines.push({
            accountId: cgstAccount!.id,
            description: `CGST Output reversal for ${noteNumber}`,
            debitAmount: gst.cgstAmount,
            creditAmount: new Prisma.Decimal(0),
            customerId: invoice.customerId,
          });
        }
        if (gst.sgstAmount.gt(0)) {
          journalLines.push({
            accountId: sgstAccount!.id,
            description: `SGST Output reversal for ${noteNumber}`,
            debitAmount: gst.sgstAmount,
            creditAmount: new Prisma.Decimal(0),
            customerId: invoice.customerId,
          });
        }
        if (gst.igstAmount.gt(0)) {
          journalLines.push({
            accountId: igstAccount!.id,
            description: `IGST Output reversal for ${noteNumber}`,
            debitAmount: gst.igstAmount,
            creditAmount: new Prisma.Decimal(0),
            customerId: invoice.customerId,
          });
        }
      } else {
        // DEBIT NOTE: Increases customer receivable (Debit AR, Credit Revenue & GST Output)
        journalLines = [
          {
            accountId: arAccount!.id,
            description: `Debit Note ${noteNumber} on Inv ${invoice.invoiceNumber}`,
            debitAmount: gst.totalAmount,
            creditAmount: new Prisma.Decimal(0),
            customerId: invoice.customerId,
          },
          {
            accountId: incomeAccount!.id,
            description: `Revenue addition for Debit Note ${noteNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: gst.taxableValue,
            customerId: invoice.customerId,
          },
        ];
        if (gst.cgstAmount.gt(0)) {
          journalLines.push({
            accountId: cgstAccount!.id,
            description: `CGST Output on ${noteNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: gst.cgstAmount,
            customerId: invoice.customerId,
          });
        }
        if (gst.sgstAmount.gt(0)) {
          journalLines.push({
            accountId: sgstAccount!.id,
            description: `SGST Output on ${noteNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: gst.sgstAmount,
            customerId: invoice.customerId,
          });
        }
        if (gst.igstAmount.gt(0)) {
          journalLines.push({
            accountId: igstAccount!.id,
            description: `IGST Output on ${noteNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: gst.igstAmount,
            customerId: invoice.customerId,
          });
        }
      }

      const journal = await postJournalEntry(
        {
          journalType: "ADJUSTMENT",
          narration: `${input.noteType} ${noteNumber} issued on Invoice ${invoice.invoiceNumber}. Reason: ${input.reason}`,
          referenceDocumentType: "CREDIT_DEBIT_NOTE",
          referenceDocumentId: note.id,
          referenceNumber: noteNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      await tx.creditDebitNote.update({
        where: { id: note.id },
        data: { journalEntryId: journal.id },
      });

      return note;
    });

    return NextResponse.json(
      { success: true, data: result, message: `${input.noteType} ${result.noteNumber} posted successfully.` },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

