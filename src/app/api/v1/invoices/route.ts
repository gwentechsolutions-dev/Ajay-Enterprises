import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createInvoiceSchema } from "@/lib/schemas/accounting";
import { validationErrorResponse } from "@/lib/api-validation";
import { calculateGst, calculateRoundOff } from "@/lib/accounting/gst-engine";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const type = searchParams.get("type");

    const invoices = await db.invoice.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(type ? { invoiceType: type } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, gstin: true, primaryMobile: true, whatsappNumber: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true, siteContactDetails: true, siteOwnerContact: true, siteInCharge: true } },
        items: true,
      },
      orderBy: { invoiceDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: invoices });
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
    const parsed = createInvoiceSchema.safeParse(body);
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

    const invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
    const dueDate = new Date(input.dueDate);
    const fiscalYear = getCurrentFiscalYear(invoiceDate);

    // Compute GST breakdowns for each item
    let subtotal = new Prisma.Decimal(0);
    let totalCgst = new Prisma.Decimal(0);
    let totalSgst = new Prisma.Decimal(0);
    let totalIgst = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);

    const processedItems = input.items.map((it) => {
      const lineQty = new Prisma.Decimal(it.quantity);
      const lineRate = new Prisma.Decimal(it.unitRate);
      const discount = new Prisma.Decimal(it.discountAmount || 0);
      const taxable = lineQty.times(lineRate).minus(discount);

      const gst = calculateGst({
        taxableValue: taxable,
        gstRatePercent: it.gstRatePercent,
        placeOfSupply: input.placeOfSupply,
      });

      subtotal = subtotal.plus(taxable);
      totalCgst = totalCgst.plus(gst.cgstAmount);
      totalSgst = totalSgst.plus(gst.sgstAmount);
      totalIgst = totalIgst.plus(gst.igstAmount);
      totalTax = totalTax.plus(gst.totalTaxAmount);

      return {
        materialVariantId: it.materialVariantId || null,
        itemType: it.itemType || "SALES",
        itemDescription: it.itemDescription,
        hsnSacCode: it.hsnSacCode || "7308",
        quantity: lineQty,
        uom: it.uom || "Nos.",
        unitRate: lineRate,
        discountAmount: discount,
        taxableValue: taxable,
        gstRatePercent: gst.gstRatePercent,
        cgstRatePercent: gst.cgstRatePercent,
        cgstAmount: gst.cgstAmount,
        sgstRatePercent: gst.sgstRatePercent,
        sgstAmount: gst.sgstAmount,
        igstRatePercent: gst.igstRatePercent,
        igstAmount: gst.igstAmount,
        totalAmount: gst.totalAmount,
      };
    });

    const grandTotalRaw = subtotal.plus(totalTax);
    const { roundedTotal, roundOffAmount } = calculateRoundOff(grandTotalRaw);

    const docPrefix = input.invoiceType === "RENTAL" ? "INV_RENTAL" : input.invoiceType === "SALES" ? "SALES_INV" : "SERVICE_INV";
    const invoiceNumber = input.invoiceNumber || (await generateNextDocumentNumber(docPrefix as any));

    const invoice = await db.$transaction(async (tx) => {
      // 1. Create Invoice Header & Lines
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: input.invoiceType,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
          rentalStatementId: input.rentalStatementId || null,
          invoiceDate,
          dueDate,
          fiscalYear,
          placeOfSupply: input.placeOfSupply,
          isInterState: input.placeOfSupply !== "33",
          customerGstin: input.customerGstin || null,
          customerPan: input.customerPan || null,
          billingAddress: input.billingAddress || null,
          shippingAddress: input.shippingAddress || null,
          subtotal,
          taxableAmount: subtotal,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalTaxAmount: totalTax,
          roundOff: roundOffAmount,
          grandTotal: roundedTotal,
          paidAmount: new Prisma.Decimal(0),
          outstandingAmount: roundedTotal,
          paymentStatus: "UNPAID",
          status: "POSTED",
          notes: input.notes || null,
          termsAndConditions: input.termsAndConditions || null,
          createdById: actor.id,
          postedById: actor.id,
          postedAt: new Date(),
          items: {
            create: processedItems,
          },
        },
      });

      // 2. Fetch Control Accounts for General Ledger Posting
      const arAccount = await getSystemAccount("1030", tx); // Debtors Control
      const incomeAccount = await getSystemAccount(input.invoiceType === "RENTAL" ? "4010" : "4020", tx);
      const cgstAccount = await getSystemAccount("2041", tx);
      const sgstAccount = await getSystemAccount("2042", tx);
      const igstAccount = await getSystemAccount("2043", tx);

      // 3. Build Balanced Double-Entry Journal Lines
      const journalLines = [
        // Dr: Accounts Receivable (Grand Total)
        {
          accountId: arAccount!.id,
          description: `Invoice ${invoiceNumber} - Receivable from customer`,
          debitAmount: roundedTotal,
          creditAmount: new Prisma.Decimal(0),
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
        },
        // Cr: Revenue / Income (Taxable Subtotal)
        {
          accountId: incomeAccount!.id,
          description: `Revenue for Invoice ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: subtotal,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
        },
      ];

      // Cr: CGST Output Liability
      if (totalCgst.gt(0)) {
        journalLines.push({
          accountId: cgstAccount!.id,
          description: `CGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalCgst,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
        });
      }

      // Cr: SGST Output Liability
      if (totalSgst.gt(0)) {
        journalLines.push({
          accountId: sgstAccount!.id,
          description: `SGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalSgst,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
        });
      }

      // Cr: IGST Output Liability
      if (totalIgst.gt(0)) {
        journalLines.push({
          accountId: igstAccount!.id,
          description: `IGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalIgst,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId || null,
        });
      }

      // Handle roundOff line if non-zero
      if (!roundOffAmount.isZero()) {
        const otherExpense = await getSystemAccount("5060", tx);
        if (roundOffAmount.gt(0)) {
          // Rounded up: Extra income / credit
          journalLines.push({
            accountId: otherExpense!.id,
            description: `Round off adjustment on ${invoiceNumber}`,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: roundOffAmount.abs(),
            customerId: input.customerId,
            customerSiteId: input.customerSiteId || null,
          });
        } else {
          // Rounded down: Expense / debit
          journalLines.push({
            accountId: otherExpense!.id,
            description: `Round off adjustment on ${invoiceNumber}`,
            debitAmount: roundOffAmount.abs(),
            creditAmount: new Prisma.Decimal(0),
            customerId: input.customerId,
            customerSiteId: input.customerSiteId || null,
          });
        }
      }

      // 4. Post Journal Entry to General Ledger
      const journal = await postJournalEntry(
        {
          journalType: "SALES",
          narration: `Tax Invoice ${invoiceNumber} issued to customer. Total: ₹${roundedTotal.toFixed(2)}`,
          referenceDocumentType: "INVOICE",
          referenceDocumentId: inv.id,
          referenceNumber: invoiceNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      // Link journal to invoice and freeze snapshot
      const snapshotPayload = {
        frozenAt: new Date().toISOString(),
        invoiceNumber,
        grandTotal: roundedTotal.toString(),
        taxableAmount: subtotal.toString(),
        totalTaxAmount: totalTax.toString(),
        journalNumber: journal.journalNumber,
      };

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          journalEntryId: journal.id,
          snapshotPayload,
        },
      });

      return inv;
    });

    return NextResponse.json(
      {
        success: true,
        data: invoice,
        message: `Tax Invoice ${invoice.invoiceNumber} generated and posted to General Ledger.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

