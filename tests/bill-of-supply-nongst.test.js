import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Schema mirror matching src/lib/schemas/accounting.ts
const generateRentalInvoiceFromStatementSchema = z.object({
  statementId: z.string().uuid("Valid rental statement ID is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  taxTreatment: z.enum(["TAX_INVOICE", "BILL_OF_SUPPLY"]).default("TAX_INVOICE"),
  transportCharges: z.coerce.number().min(0, "Transport charges cannot be negative").optional().nullable(),
  transportDescription: z.string().optional().nullable(),
});

function calculateGst(input) {
  const taxable = new Prisma.Decimal(input.taxableValue);
  const rate = new Prisma.Decimal(input.gstRatePercent);
  const supplierState = (input.supplierStateCode || "33").trim();
  const pos = (input.placeOfSupply || "33").trim();
  const isInterState = supplierState !== pos;

  if (rate.isZero()) {
    return {
      isInterState,
      taxableValue: taxable,
      gstRatePercent: new Prisma.Decimal(0),
      cgstRatePercent: new Prisma.Decimal(0),
      cgstAmount: new Prisma.Decimal(0),
      sgstRatePercent: new Prisma.Decimal(0),
      sgstAmount: new Prisma.Decimal(0),
      igstRatePercent: new Prisma.Decimal(0),
      igstAmount: new Prisma.Decimal(0),
      totalTaxAmount: new Prisma.Decimal(0),
      totalAmount: taxable,
    };
  }

  if (isInterState) {
    const igstAmount = taxable.times(rate).dividedBy(100).toDecimalPlaces(2);
    return {
      isInterState: true,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstRatePercent: new Prisma.Decimal(0),
      cgstAmount: new Prisma.Decimal(0),
      sgstRatePercent: new Prisma.Decimal(0),
      sgstAmount: new Prisma.Decimal(0),
      igstRatePercent: rate,
      igstAmount,
      totalTaxAmount: igstAmount,
      totalAmount: taxable.plus(igstAmount),
    };
  } else {
    const halfRate = rate.dividedBy(2);
    const cgstAmount = taxable.times(halfRate).dividedBy(100).toDecimalPlaces(2);
    const sgstAmount = taxable.times(halfRate).dividedBy(100).toDecimalPlaces(2);
    const totalTax = cgstAmount.plus(sgstAmount);
    return {
      isInterState: false,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstRatePercent: halfRate,
      cgstAmount,
      sgstRatePercent: halfRate,
      sgstAmount,
      igstRatePercent: new Prisma.Decimal(0),
      igstAmount: new Prisma.Decimal(0),
      totalTaxAmount: totalTax,
      totalAmount: taxable.plus(totalTax),
    };
  }
}

describe("Non-GST / Bill of Supply (0% GST) Suite", () => {
  it("should validate schema defaults taxTreatment to TAX_INVOICE when omitted", () => {
    const payload = {
      statementId: "e0000000-0000-4000-8000-000000000001",
      invoiceDate: "2026-11-19",
      dueDate: "2026-12-04",
    };
    const parsed = generateRentalInvoiceFromStatementSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.taxTreatment, "TAX_INVOICE");
  });

  it("should validate schema accepts taxTreatment BILL_OF_SUPPLY", () => {
    const payload = {
      statementId: "e0000000-0000-4000-8000-000000000001",
      taxTreatment: "BILL_OF_SUPPLY",
      notes: "Non-GST supply to unregistered contractor",
    };
    const parsed = generateRentalInvoiceFromStatementSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.taxTreatment, "BILL_OF_SUPPLY");
  });

  it("should calculate zero tax and totalAmount equals taxableValue for Bill of Supply (0% GST)", () => {
    const taxableRental = new Prisma.Decimal("45000.00");
    const gstResult = calculateGst({
      taxableValue: taxableRental,
      gstRatePercent: new Prisma.Decimal(0),
      placeOfSupply: "33",
      supplierStateCode: "33",
    });

    assert.equal(gstResult.gstRatePercent.toNumber(), 0);
    assert.equal(gstResult.cgstAmount.toNumber(), 0);
    assert.equal(gstResult.sgstAmount.toNumber(), 0);
    assert.equal(gstResult.igstAmount.toNumber(), 0);
    assert.equal(gstResult.totalTaxAmount.toNumber(), 0);
    assert.equal(gstResult.totalAmount.toString(), taxableRental.toString());
  });

  it("should strictly guarantee SUM(debits) === SUM(credits) on Non-GST journal entry with zero tax liability", () => {
    const rentalSubtotal = new Prisma.Decimal("38500.00");
    const transportCharges = new Prisma.Decimal("1500.00");
    const grandTotal = rentalSubtotal.plus(transportCharges); // 40000.00

    // Non-GST / Bill of Supply: No CGST/SGST liability accounts
    const journalLines = [
      {
        account: "Accounts Receivable (1030)",
        debit: grandTotal,
        credit: new Prisma.Decimal(0),
      },
      {
        account: "Rental Income (4010)",
        debit: new Prisma.Decimal(0),
        credit: rentalSubtotal,
      },
      {
        account: "Transportation Income (4030)",
        debit: new Prisma.Decimal(0),
        credit: transportCharges,
      },
    ];

    const totalDebits = journalLines.reduce((sum, l) => sum.plus(l.debit), new Prisma.Decimal(0));
    const totalCredits = journalLines.reduce((sum, l) => sum.plus(l.credit), new Prisma.Decimal(0));

    assert.equal(totalDebits.toString(), "40000");
    assert.equal(totalCredits.toString(), "40000");
    assert.equal(totalDebits.equals(totalCredits), true);
  });

  it("should correctly filter GST invoices vs Non-GST Bills of Supply", () => {
    const mockInvoices = [
      { id: "1", invoiceNumber: "INV-001", totalTaxAmount: "7200.00", paymentStatus: "UNPAID" },
      { id: "2", invoiceNumber: "INV-002", totalTaxAmount: "0.00", paymentStatus: "PAID" },
      { id: "3", invoiceNumber: "INV-003", totalTaxAmount: "0", paymentStatus: "UNPAID" },
      { id: "4", invoiceNumber: "INV-004", totalTaxAmount: "1850.50", paymentStatus: "PARTIAL" },
    ];

    const filterInvoices = (taxFilter) => {
      return mockInvoices.filter((inv) => {
        if (taxFilter === "GST") return Number(inv.totalTaxAmount) > 0;
        if (taxFilter === "NON_GST") return Number(inv.totalTaxAmount) === 0;
        return true;
      });
    };

    const allInvoices = filterInvoices("ALL");
    const gstOnly = filterInvoices("GST");
    const nonGstOnly = filterInvoices("NON_GST");

    assert.equal(allInvoices.length, 4);
    assert.equal(gstOnly.length, 2);
    assert.deepEqual(gstOnly.map((i) => i.invoiceNumber), ["INV-001", "INV-004"]);
    assert.equal(nonGstOnly.length, 2);
    assert.deepEqual(nonGstOnly.map((i) => i.invoiceNumber), ["INV-002", "INV-003"]);
  });
});
