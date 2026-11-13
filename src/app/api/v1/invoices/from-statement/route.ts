import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { generateRentalInvoiceFromStatementSchema } from "@/lib/schemas/accounting";
import { calculateGst, calculateRoundOff, getStateCodeFromGstin } from "@/lib/accounting/gst-engine";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { getSystemAccount } from "@/lib/accounting/chart-of-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "create");

    const body = await req.json();
    const parsed = generateRentalInvoiceFromStatementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const { statementId, invoiceDate: reqInvDate, dueDate: reqDueDate, notes } = parsed.data;

    const statement = await db.rentalStatement.findUnique({
      where: { id: statementId },
      include: {
        customer: true,
        customerSite: true,
        items: {
          include: {
            materialVariant: true,
            customerSite: true,
          },
        },
        siteSummaries: {
          include: { customerSite: true },
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ success: false, error: { message: "Rental Statement not found" } }, { status: 404 });
    }

    // Must be APPROVED or FINALIZED
    if (statement.status !== "APPROVED" && statement.status !== "FINALIZED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Statement ${statement.statementNumber} is in ${statement.status} status. Only APPROVED or FINALIZED statements can be converted into tax invoices.`,
          },
        },
        { status: 400 }
      );
    }

    // Prevent duplicate invoicing of the same statement
    const existingInvoice = await db.invoice.findFirst({
      where: {
        rentalStatementId: statement.id,
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (existingInvoice) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_INVOICE",
            message: `Invoice ${existingInvoice.invoiceNumber} has already been issued for Rental Statement ${statement.statementNumber}. Duplicate invoicing is blocked.`,
          },
        },
        { status: 409 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const invoiceDate = reqInvDate ? new Date(reqInvDate) : new Date();
    const dueDate = reqDueDate
      ? new Date(reqDueDate)
      : new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days default
    const fiscalYear = getCurrentFiscalYear(invoiceDate);

    // Determine place of supply from customer GSTIN or site
    const placeOfSupply = getStateCodeFromGstin(statement.customer.gstin);
    const isInterState = placeOfSupply !== "33";

    // 1. Build line items from Statement Items (SAC 9973 for equipment rental)
    let subtotal = new Prisma.Decimal(0);
    let totalCgst = new Prisma.Decimal(0);
    let totalSgst = new Prisma.Decimal(0);
    let totalIgst = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);

    const invoiceItemsData = statement.items.map((it) => {
      const taxable = new Prisma.Decimal(it.rentalAmount);
      const gst = calculateGst({
        taxableValue: taxable,
        gstRatePercent: 18, // 18% standard GST for equipment rental (SAC 9973)
        placeOfSupply,
      });

      subtotal = subtotal.plus(taxable);
      totalCgst = totalCgst.plus(gst.cgstAmount);
      totalSgst = totalSgst.plus(gst.sgstAmount);
      totalIgst = totalIgst.plus(gst.igstAmount);
      totalTax = totalTax.plus(gst.totalTaxAmount);

      return {
        materialVariantId: it.materialVariantId as string | null,
        itemType: "RENTAL",
        itemDescription: `${it.materialVariant.name} - Rental (${it.billableDays} days @ ₹${Number(it.applicableDailyRate).toFixed(2)}/day). Site: ${it.customerSite.siteName}`,
        hsnSacCode: "9973",
        quantity: it.closingHeldQty,
        uom: it.materialVariant.uom,
        unitRate: it.applicableDailyRate,
        discountAmount: new Prisma.Decimal(0),
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

    // 2. Add Damage Charges if present on statement
    const dmgCharges = new Prisma.Decimal(statement.totalDamageCharges);
    if (dmgCharges.gt(0)) {
      const gstDmg = calculateGst({ taxableValue: dmgCharges, gstRatePercent: 18, placeOfSupply });
      subtotal = subtotal.plus(dmgCharges);
      totalCgst = totalCgst.plus(gstDmg.cgstAmount);
      totalSgst = totalSgst.plus(gstDmg.sgstAmount);
      totalIgst = totalIgst.plus(gstDmg.igstAmount);
      totalTax = totalTax.plus(gstDmg.totalTaxAmount);

      invoiceItemsData.push({
        materialVariantId: null,
        itemType: "DAMAGE_CHARGE",
        itemDescription: `Repair & Damage Charges as assessed in Statement ${statement.statementNumber}`,
        hsnSacCode: "9973",
        quantity: new Prisma.Decimal(1),
        uom: "Job",
        unitRate: dmgCharges,
        discountAmount: new Prisma.Decimal(0),
        taxableValue: dmgCharges,
        gstRatePercent: gstDmg.gstRatePercent,
        cgstRatePercent: gstDmg.cgstRatePercent,
        cgstAmount: gstDmg.cgstAmount,
        sgstRatePercent: gstDmg.sgstRatePercent,
        sgstAmount: gstDmg.sgstAmount,
        igstRatePercent: gstDmg.igstRatePercent,
        igstAmount: gstDmg.igstAmount,
        totalAmount: gstDmg.totalAmount,
      });
    }

    // 3. Add Missing Material Charges if present
    const missCharges = new Prisma.Decimal(statement.totalMissingCharges);
    if (missCharges.gt(0)) {
      const gstMiss = calculateGst({ taxableValue: missCharges, gstRatePercent: 18, placeOfSupply });
      subtotal = subtotal.plus(missCharges);
      totalCgst = totalCgst.plus(gstMiss.cgstAmount);
      totalSgst = totalSgst.plus(gstMiss.sgstAmount);
      totalIgst = totalIgst.plus(gstMiss.igstAmount);
      totalTax = totalTax.plus(gstMiss.totalTaxAmount);

      invoiceItemsData.push({
        materialVariantId: null,
        itemType: "MISSING_CHARGE",
        itemDescription: `Replacement Value for Lost / Unreturned Material in Statement ${statement.statementNumber}`,
        hsnSacCode: "9973",
        quantity: new Prisma.Decimal(1),
        uom: "Job",
        unitRate: missCharges,
        discountAmount: new Prisma.Decimal(0),
        taxableValue: missCharges,
        gstRatePercent: gstMiss.gstRatePercent,
        cgstRatePercent: gstMiss.cgstRatePercent,
        cgstAmount: gstMiss.cgstAmount,
        sgstRatePercent: gstMiss.sgstRatePercent,
        sgstAmount: gstMiss.sgstAmount,
        igstRatePercent: gstMiss.igstRatePercent,
        igstAmount: gstMiss.igstAmount,
        totalAmount: gstMiss.totalAmount,
      });
    }

    const grandTotalRaw = subtotal.plus(totalTax);
    const { roundedTotal, roundOffAmount } = calculateRoundOff(grandTotalRaw);

    const invoiceNumber = await generateNextDocumentNumber("INV_RENTAL");

    const createdInvoice = await db.$transaction(async (tx) => {
      // Create Invoice
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: "RENTAL",
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
          rentalStatementId: statement.id,
          invoiceDate,
          dueDate,
          fiscalYear,
          placeOfSupply,
          isInterState,
          customerGstin: statement.customer.gstin || null,
          customerPan: statement.customer.pan || null,
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
          notes: notes || `Generated from Statement ${statement.statementNumber}`,
          createdById: actor.id,
          postedById: actor.id,
          postedAt: new Date(),
          items: {
            create: invoiceItemsData,
          },
        },
      });

      // Post Double-Entry Journal to General Ledger
      const arAccount = await getSystemAccount("1030", tx);
      const rentalIncomeAcc = await getSystemAccount("4010", tx);
      const cgstAccount = await getSystemAccount("2041", tx);
      const sgstAccount = await getSystemAccount("2042", tx);
      const igstAccount = await getSystemAccount("2043", tx);

      const journalLines = [
        {
          accountId: arAccount!.id,
          description: `Rental Invoice ${invoiceNumber} - Receivable from ${statement.customer.name}`,
          debitAmount: roundedTotal,
          creditAmount: new Prisma.Decimal(0),
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        },
        {
          accountId: rentalIncomeAcc!.id,
          description: `Rental Income for ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: subtotal,
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        },
      ];

      if (totalCgst.gt(0)) {
        journalLines.push({
          accountId: cgstAccount!.id,
          description: `CGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalCgst,
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        });
      }
      if (totalSgst.gt(0)) {
        journalLines.push({
          accountId: sgstAccount!.id,
          description: `SGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalSgst,
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        });
      }
      if (totalIgst.gt(0)) {
        journalLines.push({
          accountId: igstAccount!.id,
          description: `IGST Output Liability on ${invoiceNumber}`,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: totalIgst,
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        });
      }

      if (!roundOffAmount.isZero()) {
        const otherExpense = await getSystemAccount("5060", tx);
        journalLines.push({
          accountId: otherExpense!.id,
          description: `Round off on ${invoiceNumber}`,
          debitAmount: roundOffAmount.lt(0) ? roundOffAmount.abs() : new Prisma.Decimal(0),
          creditAmount: roundOffAmount.gt(0) ? roundOffAmount.abs() : new Prisma.Decimal(0),
          customerId: statement.customerId,
          customerSiteId: statement.customerSiteId || null,
        });
      }

      const journal = await postJournalEntry(
        {
          journalType: "SALES",
          narration: `Monthly Rental Tax Invoice ${invoiceNumber} against Statement ${statement.statementNumber}`,
          referenceDocumentType: "INVOICE",
          referenceDocumentId: inv.id,
          referenceNumber: invoiceNumber,
          lines: journalLines,
        },
        actor,
        tx
      );

      // Snapshot freeze
      const snapshotPayload = {
        frozenAt: new Date().toISOString(),
        invoiceNumber,
        statementNumber: statement.statementNumber,
        grandTotal: roundedTotal.toString(),
        taxableAmount: subtotal.toString(),
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
        data: createdInvoice,
        message: `Rental Invoice ${createdInvoice.invoiceNumber} successfully created from Statement ${statement.statementNumber}.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : error.message?.includes("DUPLICATE_INVOICE")
      ? 409
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
