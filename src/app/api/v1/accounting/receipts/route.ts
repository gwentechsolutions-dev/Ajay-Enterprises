import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { createPaymentReceiptSchema } from "@/lib/schemas/accounting";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    const receipts = await db.paymentReceipt.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        depositAccount: { select: { id: true, accountCode: true, accountName: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, outstandingAmount: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    return NextResponse.json({ success: true, data: receipts });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "create");

    const body = await req.json();
    if (body && typeof body === "object" && !body.depositAccountId && body.receivingAccountId) {
      body.depositAccountId = body.receivingAccountId;
    }
    const parsed = createPaymentReceiptSchema.safeParse(body);
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

    const customer = await db.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: { message: "Customer not found" } }, { status: 404 });
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const fiscalYear = getCurrentFiscalYear(paymentDate);
    const amountReceived = new Prisma.Decimal(input.amountReceived);

    // Validate allocations
    let totalAllocated = new Prisma.Decimal(0);
    const allocationsToCreate: { invoiceId: string; amount: Prisma.Decimal }[] = [];

    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        const allocAmt = new Prisma.Decimal(alloc.amount);
        totalAllocated = totalAllocated.plus(allocAmt);
        allocationsToCreate.push({ invoiceId: alloc.invoiceId, amount: allocAmt });
      }
    }

    if (totalAllocated.gt(amountReceived)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Total allocated amount (₹${totalAllocated.toFixed(2)}) cannot exceed amount received (₹${amountReceived.toFixed(2)}).`,
          },
        },
        { status: 400 }
      );
    }

    const unallocatedAmount = amountReceived.minus(totalAllocated);
    const receiptNumber = input.receiptNumber || (await generateNextDocumentNumber("RECEIPT"));

    const createdReceipt = await db.$transaction(async (tx) => {
      // 1. Create Receipt Record
      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptNumber,
          customerId: input.customerId,
          paymentDate,
          fiscalYear,
          paymentMethod: input.paymentMethod,
          depositAccountId: input.depositAccountId,
          amountReceived,
          allocatedAmount: totalAllocated,
          unallocatedAmount,
          transactionReference: input.transactionReference || null,
          bankName: input.bankName || null,
          chequeDate: input.chequeDate ? new Date(input.chequeDate) : null,
          chequeStatus: input.paymentMethod === "CHEQUE" ? "PENDING_CLEARING" : "CLEARED",
          status: "POSTED",
          notes: input.notes || null,
          supportingDocUrl: input.supportingDocUrl || null,
        },
      });

      // 2. Create Allocations and update Invoices
      for (const alloc of allocationsToCreate) {
        await tx.paymentAllocation.create({
          data: {
            receiptId: receipt.id,
            invoiceId: alloc.invoiceId,
            allocatedAmount: alloc.amount,
            allocationDate: paymentDate,
          },
        });

        const inv = await tx.invoice.findUnique({
          where: { id: alloc.invoiceId },
        });

        if (inv) {
          const newPaid = new Prisma.Decimal(inv.paidAmount).plus(alloc.amount);
          const newOut = new Prisma.Decimal(inv.grandTotal).minus(newPaid);
          const isFullyPaid = newOut.lte(new Prisma.Decimal("0.01"));

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              outstandingAmount: isFullyPaid ? new Prisma.Decimal(0) : newOut,
              paymentStatus: isFullyPaid ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      // 3. Post Double-Entry Journal
      const arAccount = await getSystemAccount("1030", tx); // Debtors
      const advanceAccount = await getSystemAccount("2020", tx); // Customer Advances

      const journalLines = [
        // Dr: Bank or Cash Account (Total Received)
        {
          accountId: input.depositAccountId,
          description: `Receipt ${receiptNumber} from ${customer.name} via ${input.paymentMethod}`,
          debitAmount: amountReceived,
          creditAmount: new Prisma.Decimal(0),
          customerId: input.customerId,
        },
      ];

      // Cr: Accounts Receivable (for allocated amount)
      if (totalAllocated.gt(0)) {
        journalLines.push({
          accountId: arAccount!.id,
          description: `Settlement against invoices for Receipt ${receiptNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalAllocated,
          customerId: input.customerId,
        });
      }

      // Cr: Customer Advance Liability (for unallocated balance)
      if (unallocatedAmount.gt(0)) {
        journalLines.push({
          accountId: advanceAccount!.id,
          description: `Unallocated advance payment for Receipt ${receiptNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: unallocatedAmount,
          customerId: input.customerId,
        });
      }

      const journal = await postJournalEntry(
        {
          journalType: "RECEIPT",
          narration: `Payment received from ${customer.name}. Amount: ₹${amountReceived.toFixed(2)} (${input.paymentMethod})`,
          referenceDocumentType: "PAYMENT_RECEIPT",
          referenceDocumentId: receipt.id,
          referenceNumber: receiptNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: { journalEntryId: journal.id },
      });

      return receipt;
    });

    return NextResponse.json(
      {
        success: true,
        data: createdReceipt,
        message: `Payment Receipt ${createdReceipt.receiptNumber} posted successfully. Amount: ₹${createdReceipt.amountReceived.toFixed(2)}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

