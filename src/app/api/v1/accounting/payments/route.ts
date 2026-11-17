import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { createSupplierPaymentSchema } from "@/lib/schemas/accounting";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");

    const payments = await db.supplierPayment.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        disbursingAccount: { select: { id: true, accountCode: true, accountName: true } },
        allocations: {
          include: {
            purchaseBill: { select: { id: true, billNumber: true, supplierInvoiceNumber: true, grandTotal: true, outstandingAmount: true } },
          },
        },
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
    await requirePermission(session, "accounting", "create");

    const body = await req.json();
    const parsed = createSupplierPaymentSchema.safeParse(body);
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

    const supplier = await db.supplier.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      return NextResponse.json({ success: false, error: { message: "Supplier not found" } }, { status: 404 });
    }

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const fiscalYear = getCurrentFiscalYear(paymentDate);
    const amountPaid = new Prisma.Decimal(input.amountPaid);

    // Validate allocations
    let totalAllocated = new Prisma.Decimal(0);
    const allocationsToCreate: { purchaseBillId: string; amount: Prisma.Decimal }[] = [];

    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        const allocAmt = new Prisma.Decimal(alloc.amount);
        totalAllocated = totalAllocated.plus(allocAmt);
        allocationsToCreate.push({ purchaseBillId: alloc.purchaseBillId, amount: allocAmt });
      }
    }

    if (totalAllocated.gt(amountPaid)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Total allocated amount (₹${totalAllocated.toFixed(2)}) cannot exceed total payment amount (₹${amountPaid.toFixed(2)}).`,
          },
        },
        { status: 400 }
      );
    }

    const unallocatedAmount = amountPaid.minus(totalAllocated);
    const paymentNumber = input.paymentNumber || (await generateNextDocumentNumber("PAYMENT_VOUCHER"));

    const createdPayment = await db.$transaction(async (tx) => {
      // 1. Create Supplier Payment Voucher
      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: input.supplierId,
          paymentDate,
          fiscalYear,
          paymentMethod: input.paymentMethod,
          disbursingAccountId: input.disbursingAccountId,
          amountPaid,
          allocatedAmount: totalAllocated,
          unallocatedAmount,
          transactionReference: input.transactionReference || null,
          status: "POSTED",
          notes: input.notes || null,
        },
      });

      // 2. Create Allocations and update Purchase Bills
      for (const alloc of allocationsToCreate) {
        await tx.supplierPaymentAllocation.create({
          data: {
            supplierPaymentId: payment.id,
            purchaseBillId: alloc.purchaseBillId,
            allocatedAmount: alloc.amount,
            allocationDate: paymentDate,
          },
        });

        const bill = await tx.purchaseBill.findUnique({
          where: { id: alloc.purchaseBillId },
        });

        if (bill) {
          const newPaid = new Prisma.Decimal(bill.paidAmount).plus(alloc.amount);
          const newOut = new Prisma.Decimal(bill.grandTotal).minus(newPaid);
          const isFullyPaid = newOut.lte(new Prisma.Decimal("0.01"));

          await tx.purchaseBill.update({
            where: { id: bill.id },
            data: {
              paidAmount: newPaid,
              outstandingAmount: isFullyPaid ? new Prisma.Decimal(0) : newOut,
              paymentStatus: isFullyPaid ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      // 3. Post Double-Entry Journal
      const apAccount = await getSystemAccount("2010", tx); // Creditors
      const advanceAccount = await getSystemAccount("1050", tx); // Supplier Advances

      const journalLines = [];

      // Dr: Accounts Payable (for bill settlement)
      if (totalAllocated.gt(0)) {
        journalLines.push({
          accountId: apAccount!.id,
          description: `Bill settlement via Payment ${paymentNumber} to ${supplier.name}`,
          debitAmount: totalAllocated,
          creditAmount: new Prisma.Decimal(0),
          supplierId: input.supplierId,
        });
      }

      // Dr: Supplier Advances Asset (for unallocated balance)
      if (unallocatedAmount.gt(0)) {
        journalLines.push({
          accountId: advanceAccount!.id,
          description: `Advance payment via Payment ${paymentNumber} to ${supplier.name}`,
          debitAmount: unallocatedAmount,
          creditAmount: new Prisma.Decimal(0),
          supplierId: input.supplierId,
        });
      }

      // Cr: Bank or Cash Account (Total Disbursed)
      journalLines.push({
        accountId: input.disbursingAccountId,
        description: `Disbursement for Payment Voucher ${paymentNumber} via ${input.paymentMethod}`,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: amountPaid,
        supplierId: input.supplierId,
      });

      const journal = await postJournalEntry(
        {
          journalType: "PAYMENT",
          narration: `Payment made to ${supplier.name}. Amount: ₹${amountPaid.toFixed(2)} (${input.paymentMethod})`,
          referenceDocumentType: "SUPPLIER_PAYMENT",
          referenceDocumentId: payment.id,
          referenceNumber: paymentNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journal.id },
      });

      return payment;
    });

    return NextResponse.json(
      {
        success: true,
        data: createdPayment,
        message: `Supplier Payment ${createdPayment.paymentNumber} posted successfully. Amount: ₹${createdPayment.amountPaid.toFixed(2)}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

