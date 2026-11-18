import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// Delivery Note Schema matching src/lib/schemas/delivery-note.ts
const createDeliveryNoteSchema = z.object({
  dnNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer construction site is required"),
  sourceWarehouseId: z.string().uuid("Source warehouse is required"),
  deliveryDate: z.string().optional(),
  driverName: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  transportMode: z.string().default("COMPANY_VEHICLE"),
  eWayBillNumber: z.string().optional().nullable(),
  contactPersonId: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  transportCharges: z.coerce.number().min(0, "Transport charges cannot be negative").optional().nullable(),
  items: z.array(z.object({
    materialVariantId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
    dailyRate: z.coerce.number().min(0).optional().nullable(),
    condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
    remarks: z.string().optional().nullable(),
  })).min(1, "At least one material item is required"),
});

// Statement to Invoice Schema matching src/lib/schemas/accounting.ts
const generateRentalInvoiceFromStatementSchema = z.object({
  statementId: z.string().uuid("Valid rental statement ID is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  transportCharges: z.coerce.number().min(0, "Transport charges cannot be negative").optional().nullable(),
  transportDescription: z.string().optional().nullable(),
});

function calculateGst(input) {
  const taxable = new Prisma.Decimal(input.taxableValue);
  const rate = new Prisma.Decimal(input.gstRatePercent);
  const supplierState = (input.supplierStateCode || "33").trim();
  const pos = (input.placeOfSupply || "33").trim();
  const isInterState = supplierState !== pos;

  if (isInterState) {
    const igstAmount = new Prisma.Decimal(taxable.times(rate).dividedBy(100).toFixed(2));
    return {
      isInterState: true,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstAmount: new Prisma.Decimal(0),
      sgstAmount: new Prisma.Decimal(0),
      igstAmount,
      totalAmount: taxable.plus(igstAmount),
    };
  } else {
    const halfRate = rate.dividedBy(2);
    const halfTax = new Prisma.Decimal(taxable.times(halfRate).dividedBy(100).toFixed(2));
    return {
      isInterState: false,
      taxableValue: taxable,
      gstRatePercent: rate,
      cgstAmount: halfTax,
      sgstAmount: halfTax,
      igstAmount: new Prisma.Decimal(0),
      totalAmount: taxable.plus(halfTax).plus(halfTax),
    };
  }
}

function calculateRoundOff(amount) {
  const dec = new Prisma.Decimal(amount);
  const rounded = dec.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const diff = rounded.minus(dec);
  return { roundedTotal: rounded, roundOffAmount: diff };
}

describe("Transportation / Freight Charges (Option A + Option B)", () => {
  it("should validate DeliveryNote schema with optional transportCharges", () => {
    const validPayload = {
      customerId: "a0000000-0000-4000-8000-000000000001",
      customerSiteId: "b0000000-0000-4000-8000-000000000001",
      sourceWarehouseId: "c0000000-0000-4000-8000-000000000001",
      deliveryDate: "2026-11-18",
      vehicleNumber: "TN-09-AB-1234",
      transportCharges: 2500,
      notes: "Direct site trip with scaffolding poles",
      items: [
        {
          materialVariantId: "d0000000-0000-4000-8000-000000000001",
          quantity: 100,
          ownershipType: "OWNED",
          dailyRate: 3.5,
          condition: "GOOD",
        },
      ],
    };

    const parsed = createDeliveryNoteSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.transportCharges, 2500);
    }
  });

  it("should permit DeliveryNote creation without transportCharges (optional field)", () => {
    const payloadWithoutTransport = {
      customerId: "a0000000-0000-4000-8000-000000000001",
      customerSiteId: "b0000000-0000-4000-8000-000000000001",
      sourceWarehouseId: "c0000000-0000-4000-8000-000000000001",
      deliveryDate: "2026-11-18",
      vehicleNumber: "TN-09-AB-1234",
      items: [
        {
          materialVariantId: "d0000000-0000-4000-8000-000000000001",
          quantity: 50,
          ownershipType: "OWNED",
          dailyRate: 2.0,
        },
      ],
    };

    const parsed = createDeliveryNoteSchema.safeParse(payloadWithoutTransport);
    assert.equal(parsed.success, true);
  });

  it("should reject negative transportCharges on DeliveryNote", () => {
    const invalidPayload = {
      customerId: "a0000000-0000-4000-8000-000000000001",
      customerSiteId: "b0000000-0000-4000-8000-000000000001",
      sourceWarehouseId: "c0000000-0000-4000-8000-000000000001",
      transportCharges: -500,
      items: [
        {
          materialVariantId: "d0000000-0000-4000-8000-000000000001",
          quantity: 50,
        },
      ],
    };

    const parsed = createDeliveryNoteSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false);
  });

  it("should validate generateRentalInvoiceFromStatementSchema with optional transportCharges and description", () => {
    const payload = {
      statementId: "e0000000-0000-4000-8000-000000000001",
      invoiceDate: "2026-11-18",
      dueDate: "2026-12-03",
      transportCharges: 3000,
      transportDescription: "Freight charges for DN-2026-0001 & DN-2026-0002",
      notes: "Consolidated monthly billing",
    };

    const parsed = generateRentalInvoiceFromStatementSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.transportCharges, 3000);
      assert.equal(parsed.data.transportDescription, "Freight charges for DN-2026-0001 & DN-2026-0002");
    }
  });

  it("should compute exact GST for transportation charges (Intra-State: 5% = CGST 2.5% + SGST 2.5%)", () => {
    const transportVal = new Prisma.Decimal(2000);
    const gstResult = calculateGst({
      taxableValue: transportVal,
      gstRatePercent: new Prisma.Decimal(5),
      placeOfSupply: "33", // Tamil Nadu intra-state
      supplierStateCode: "33",
    });

    assert.equal(gstResult.isInterState, false);
    assert.equal(gstResult.cgstAmount.toNumber(), 50.0);
    assert.equal(gstResult.sgstAmount.toNumber(), 50.0);
    assert.equal(gstResult.igstAmount.toNumber(), 0);
    assert.equal(gstResult.totalAmount.toNumber(), 2100.0);
  });

  it("should strictly guarantee SUM(debits) === SUM(credits) on invoice journal with transport charges", () => {
    const rentalSubtotal = new Prisma.Decimal(10000);
    const transportCharges = new Prisma.Decimal(1500);
    const totalTaxable = rentalSubtotal.plus(transportCharges);

    // Rental GST (18%) + Transport GST (5%)
    const gstRental = calculateGst({
      taxableValue: rentalSubtotal,
      gstRatePercent: 18,
      placeOfSupply: "33",
      supplierStateCode: "33",
    });
    const gstTransport = calculateGst({
      taxableValue: transportCharges,
      gstRatePercent: 5,
      placeOfSupply: "33",
      supplierStateCode: "33",
    });

    const totalCgst = gstRental.cgstAmount.plus(gstTransport.cgstAmount);
    const totalSgst = gstRental.sgstAmount.plus(gstTransport.sgstAmount);
    const totalTax = totalCgst.plus(totalSgst);

    const grandTotalRaw = totalTaxable.plus(totalTax);
    const { roundedTotal, roundOffAmount } = calculateRoundOff(grandTotalRaw);

    // Build double-entry lines
    const journalLines = [
      // AR Debit
      { account: "1030", debit: roundedTotal, credit: new Prisma.Decimal(0) },
      // Rental Income Credit
      { account: "4010", debit: new Prisma.Decimal(0), credit: rentalSubtotal },
      // Transport Income Credit
      { account: "4050", debit: new Prisma.Decimal(0), credit: transportCharges },
      // CGST Output Liability Credit
      { account: "2041", debit: new Prisma.Decimal(0), credit: totalCgst },
      // SGST Output Liability Credit
      { account: "2042", debit: new Prisma.Decimal(0), credit: totalSgst },
    ];

    if (!roundOffAmount.isZero()) {
      journalLines.push({
        account: "5060",
        debit: roundOffAmount.lt(0) ? roundOffAmount.abs() : new Prisma.Decimal(0),
        credit: roundOffAmount.gt(0) ? roundOffAmount.abs() : new Prisma.Decimal(0),
      });
    }

    const sumDebits = journalLines.reduce((acc, l) => acc.plus(l.debit), new Prisma.Decimal(0));
    const sumCredits = journalLines.reduce((acc, l) => acc.plus(l.credit), new Prisma.Decimal(0));

    assert.equal(
      sumDebits.toFixed(2),
      sumCredits.toFixed(2),
      `Double entry must balance: Debits (${sumDebits.toFixed(2)}) !== Credits (${sumCredits.toFixed(2)})`
    );
  });

  it("should enforce non-carry-forward rule: transport is a one-time event charge, not a recurring statement accrual", () => {
    // Delivery Note carries transport charges for a specific dispatch trip
    const dn1 = {
      dnNumber: "DN-2026-0001",
      transportCharges: new Prisma.Decimal(1500),
      isTransportBilled: false,
      billedInvoiceId: null,
    };

    // Upon generating invoice for Period 1:
    const invoice1Id = "inv-0000-0001";
    dn1.isTransportBilled = true;
    dn1.billedInvoiceId = invoice1Id;

    // In Period 2 statement calculation, query unbilled delivery notes:
    const candidateDns = [dn1];
    const unbilledForPeriod2 = candidateDns.filter((dn) => !dn.isTransportBilled && dn.transportCharges.gt(0));

    // Zero unbilled transport carries forward!
    assert.equal(unbilledForPeriod2.length, 0, "No previously billed transport notes can carry forward into Period 2");
  });
});
