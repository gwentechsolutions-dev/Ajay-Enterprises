import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { createPurchaseBillSchema } from "@/lib/schemas/accounting";
import { calculateGst } from "@/lib/accounting/gst-engine";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "view");

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");

    const bills = await db.purchaseBill.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true, gstin: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        goodsReceiptNote: { select: { id: true, grnNumber: true } },
        items: true,
      },
      orderBy: { billDate: "desc" },
    });

    return NextResponse.json({ success: true, data: bills });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "create");

    const body = await req.json();
    const parsed = createPurchaseBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    // Duplicate supplier invoice detection
    const existing = await db.purchaseBill.findUnique({
      where: {
        supplierId_supplierInvoiceNumber: {
          supplierId: input.supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_SUPPLIER_INVOICE",
            message: `Supplier Invoice Number '${input.supplierInvoiceNumber}' has already been booked for this supplier in Bill ${existing.billNumber}.`,
          },
        },
        { status: 409 }
      );
    }

    const supplier = await db.supplier.findUnique({
      where: { id: input.supplierId },
    });
    if (!supplier) {
      return NextResponse.json({ success: false, error: { message: "Supplier not found" } }, { status: 404 });
    }

    const billDate = input.billDate ? new Date(input.billDate) : new Date();
    const dueDate = new Date(input.dueDate);
    const supplierInvoiceDate = new Date(input.supplierInvoiceDate);
    const fiscalYear = getCurrentFiscalYear(billDate);

    // Compute GST per line item
    let subtotal = new Prisma.Decimal(0);
    let totalCgst = new Prisma.Decimal(0);
    let totalSgst = new Prisma.Decimal(0);
    let totalIgst = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);

    const processedItems = input.items.map((it) => {
      const lineQty = new Prisma.Decimal(it.quantity);
      const lineRate = new Prisma.Decimal(it.unitRate);
      const taxable = lineQty.times(lineRate);

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
        description: it.description,
        hsnSacCode: it.hsnSacCode || "7308",
        quantity: lineQty,
        uom: it.uom || "Nos.",
        unitRate: lineRate,
        taxableValue: taxable,
        gstRatePercent: gst.gstRatePercent,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount,
        totalAmount: gst.totalAmount,
      };
    });

    const grandTotalRaw = subtotal.plus(totalTax);
    const tdsPercent = new Prisma.Decimal(input.tdsPercent || 0);
    const tdsAmount = subtotal.times(tdsPercent).dividedBy(100).round();
    const netPayable = grandTotalRaw.minus(tdsAmount);

    const billNumber = input.billNumber || (await generateNextDocumentNumber("PURCHASE_INV"));

    const createdBill = await db.$transaction(async (tx) => {
      // 1. Create Purchase Bill
      const bill = await tx.purchaseBill.create({
        data: {
          billNumber,
          billType: input.billType,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId || null,
          goodsReceiptNoteId: input.goodsReceiptNoteId || null,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          supplierInvoiceDate,
          billDate,
          dueDate,
          fiscalYear,
          supplierGstin: supplier.gstin || null,
          placeOfSupply: input.placeOfSupply,
          isInterState: input.placeOfSupply !== "33",
          itcEligibility: input.itcEligibility,
          taxableAmount: subtotal,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          totalTaxAmount: totalTax,
          tdsPercent,
          tdsAmount,
          grandTotal: grandTotalRaw,
          paidAmount: new Prisma.Decimal(0),
          outstandingAmount: netPayable,
          paymentStatus: "UNPAID",
          status: "POSTED",
          remarks: input.remarks || null,
          supportingDocUrl: input.supportingDocUrl || null,
          items: {
            create: processedItems,
          },
        },
      });

      // 2. Fetch Control Accounts for General Ledger Posting
      const apAccount = await getSystemAccount("2010", tx); // Creditors Control
      const purchaseExpAcc = await getSystemAccount("5010", tx);
      const cgstItcAcc = await getSystemAccount("1041", tx);
      const sgstItcAcc = await getSystemAccount("1042", tx);
      const igstItcAcc = await getSystemAccount("1043", tx);
      const tdsPayableAcc = await getSystemAccount("2050", tx);

      // 3. Build Balanced Journal Lines
      const journalLines = [
        // Dr: Purchases Expense (Taxable Subtotal)
        {
          accountId: purchaseExpAcc!.id,
          description: `Purchase Bill ${billNumber} - Material Purchases`,
          debitAmount: subtotal,
          creditAmount: new Prisma.Decimal(0),
          supplierId: input.supplierId,
        },
      ];

      // Dr: Input Tax Credit (if eligible under GST Sec 16; capitalize if blocked under Sec 17(5))
      const isBlockedItc = input.itcEligibility === "INELIGIBLE_SEC_17_5" || input.itcEligibility === "BLOCKED";
      if (!isBlockedItc) {
        if (totalCgst.gt(0)) {
          journalLines.push({
            accountId: cgstItcAcc!.id,
            description: `CGST Input Tax Credit on Bill ${billNumber}`,
            debitAmount: totalCgst,
            creditAmount: new Prisma.Decimal(0),
            supplierId: input.supplierId,
          });
        }
        if (totalSgst.gt(0)) {
          journalLines.push({
            accountId: sgstItcAcc!.id,
            description: `SGST Input Tax Credit on Bill ${billNumber}`,
            debitAmount: totalSgst,
            creditAmount: new Prisma.Decimal(0),
            supplierId: input.supplierId,
          });
        }
        if (totalIgst.gt(0)) {
          journalLines.push({
            accountId: igstItcAcc!.id,
            description: `IGST Input Tax Credit on Bill ${billNumber}`,
            debitAmount: totalIgst,
            creditAmount: new Prisma.Decimal(0),
            supplierId: input.supplierId,
          });
        }
      } else {
        // If Ineligible, capitalize tax into purchase expense
        journalLines[0].debitAmount = subtotal.plus(totalTax);
      }

      // Cr: Accounts Payable (Net Payable after TDS)
      journalLines.push({
        accountId: apAccount!.id,
        description: `Payable to ${supplier.name} on Bill ${billNumber}`,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: netPayable,
        supplierId: input.supplierId,
      });

      // Cr: TDS Payable (if TDS deducted)
      if (tdsAmount.gt(0)) {
        journalLines.push({
          accountId: tdsPayableAcc!.id,
          description: `TDS deducted on Bill ${billNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: tdsAmount,
          supplierId: input.supplierId,
        });
      }

      // 4. Post Journal Entry
      const journal = await postJournalEntry(
        {
          journalType: "PURCHASE",
          narration: `Purchase Bill ${billNumber} from ${supplier.name}. Inv Ref: ${input.supplierInvoiceNumber}`,
          referenceDocumentType: "PURCHASE_BILL",
          referenceDocumentId: bill.id,
          referenceNumber: billNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      await tx.purchaseBill.update({
        where: { id: bill.id },
        data: { journalEntryId: journal.id },
      });

      return bill;
    });

    return NextResponse.json(
      { success: true, data: createdBill, message: `Purchase Bill ${createdBill.billNumber} booked and posted to General Ledger.` },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

