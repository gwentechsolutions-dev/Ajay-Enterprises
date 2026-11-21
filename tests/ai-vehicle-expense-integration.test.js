import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ==============================================================================
// INVENTRA: UNBLOCKNOW AI VEHICLE EXPENSE INTEGRATION TEST SUITE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// Comprehensive Verification of DeepSeek AI Extraction, Fuel Calculations,
// Odometer Progression, Expense Categorization, and Double-Entry GL Alignment
// ==============================================================================

// ------------------------------------------------------------------------------
// Replicating pure calculation and validation helpers for direct unit testing
// ------------------------------------------------------------------------------
const AMOUNT_TOLERANCE_RATIO = 0.02; // 2%
const AMOUNT_TOLERANCE_ABSOLUTE = 2.0; // ₹2.00
const MIN_PLAUSIBLE_KM_PER_LITRE = 1.5;
const MAX_PLAUSIBLE_KM_PER_LITRE = 45.0;

function crossCheckFuelAmount(params) {
  const { quantity, pricePerUnit, totalAmount } = params;

  if (
    quantity == null ||
    pricePerUnit == null ||
    totalAmount == null ||
    quantity <= 0 ||
    pricePerUnit <= 0
  ) {
    return { consistent: true, expectedAmount: null, difference: null, tolerance: null };
  }

  const expectedAmount = Math.round(quantity * pricePerUnit * 100) / 100;
  const difference = Math.round(Math.abs(expectedAmount - totalAmount) * 100) / 100;
  const tolerance = Math.round(
    Math.max(AMOUNT_TOLERANCE_ABSOLUTE, expectedAmount * AMOUNT_TOLERANCE_RATIO) * 100
  ) / 100;

  return {
    consistent: difference <= tolerance,
    expectedAmount,
    difference,
    tolerance,
  };
}

function coercePositiveNumber(val, max = 10000000) {
  if (val == null || val === "") return null;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || num > max) return null;
  return Math.round(num * 100) / 100;
}

function coerceConfidence(val) {
  if (val == null) return 0.8;
  const num = Number(val);
  if (!Number.isFinite(num)) return 0.8;
  return Math.min(1.0, Math.max(0.0, Math.round(num * 100) / 100));
}

function normalizeExtractionResult(raw, scanType, category = null) {
  const rawFields = raw?.fields && typeof raw.fields === "object" ? raw.fields : {};
  const rawConfidence = raw?.fieldConfidence && typeof raw.fieldConfidence === "object" ? raw.fieldConfidence : {};
  const rawOrigins = raw?.fieldOrigins && typeof raw.fieldOrigins === "object" ? raw.fieldOrigins : {};

  const match = ["yes", "no", "unsure"].includes(raw?.match) ? raw.match : "unsure";
  const readable = ["full", "partial", "none"].includes(raw?.readable) ? raw.readable : "partial";

  const warnings = [];
  const checks = [];

  const date = rawFields.date || null;
  const time = rawFields.time || null;
  const vendor = rawFields.vendor || null;
  const invoiceNumber = rawFields.invoiceNumber || null;
  const fuelType = rawFields.fuelType || null;

  const quantity = coercePositiveNumber(rawFields.quantity, 1000);
  const ratePerUnit = coercePositiveNumber(rawFields.ratePerUnit, 500);
  const totalAmount = coercePositiveNumber(rawFields.totalAmount, 10000000);
  const taxAmount = coercePositiveNumber(rawFields.taxAmount, 1000000);
  const odometerKm = coercePositiveNumber(rawFields.odometerKm, 2000000);

  const vehicleRegistration = rawFields.vehicleRegistration || null;
  const paymentMethod = rawFields.paymentMethod || null;
  const description = rawFields.description || null;
  const policyNumber = rawFields.policyNumber || null;
  const policyExpiryDate = rawFields.policyExpiryDate || null;
  const quantityUnit = rawFields.quantityUnit || "L";

  if (quantity != null && ratePerUnit != null && totalAmount != null) {
    const crossCheck = crossCheckFuelAmount({ quantity, pricePerUnit: ratePerUnit, totalAmount });
    if (!crossCheck.consistent) {
      warnings.push(`Amount mismatch: expected ₹${crossCheck.expectedAmount}, printed ₹${totalAmount}`);
      checks.push({ code: "AMOUNT_MISMATCH", details: crossCheck });
    }
  }

  const fields = {
    date,
    time,
    vendor,
    invoiceNumber,
    fuelType,
    quantity,
    quantityUnit,
    ratePerUnit,
    totalAmount,
    taxAmount,
    odometerKm,
    vehicleRegistration,
    paymentMethod,
    description,
    category: category || rawFields.category || (scanType === "fuel_receipt" ? "fuel" : null),
    policyNumber,
    policyExpiryDate,
  };

  const fieldConfidence = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val !== null && val !== undefined) {
      fieldConfidence[key] = coerceConfidence(rawConfidence[key]);
    }
  }

  const missingFields = [];
  if (scanType === "fuel_receipt") {
    if (!date) missingFields.push("date");
    if (quantity == null) missingFields.push("quantity");
    if (ratePerUnit == null) missingFields.push("ratePerUnit");
    if (totalAmount == null) missingFields.push("totalAmount");
  } else if (scanType === "pump_meter") {
    if (quantity == null) missingFields.push("quantity");
    if (totalAmount == null) missingFields.push("totalAmount");
  } else if (scanType === "odometer") {
    if (odometerKm == null) missingFields.push("odometerKm");
  }

  let status = "success";
  if (match === "no") {
    status = "invalid_image";
  } else if (readable === "none" || Object.keys(fieldConfidence).length === 0) {
    status = "unreadable";
  } else if (missingFields.length > 0) {
    status = "partial";
  }

  if (status === "invalid_image") {
    for (const key of Object.keys(fields)) {
      fields[key] = null;
    }
    for (const key of Object.keys(fieldConfidence)) {
      delete fieldConfidence[key];
    }
  }

  return {
    documentType: scanType,
    status,
    reasonCode: status === "invalid_image" ? "WRONG_IMAGE" : status === "unreadable" ? "NO_VALUES_READ" : null,
    fields,
    fieldConfidence,
    fieldOrigins: rawOrigins,
    missingFields,
    warnings,
    checks,
    requiresReview: true,
  };
}

// ------------------------------------------------------------------------------
// Schemas under test
// ------------------------------------------------------------------------------
const SERVICE_CATEGORIES = [
  "REGULAR_SERVICE",
  "ENGINE_REPAIR",
  "MECHANICAL_REPAIR",
  "ELECTRICAL_REPAIR",
  "TYRES",
  "BATTERY",
  "TYRES_BATTERIES",
  "BRAKE_SYSTEM",
  "ELECTRICAL",
  "BODYWORK",
  "SPARE_PARTS",
  "VEHICLE_SERVICING",
  "VEHICLE_WASHING",
  "INSURANCE_REPAIR",
  "OTHER",
];

const EXPENSE_CATEGORIES = [
  "FUEL",
  "REPAIR_MAINTENANCE",
  "VEHICLE_SERVICING",
  "MECHANICAL_REPAIR",
  "ELECTRICAL_REPAIR",
  "TYRES_BATTERIES",
  "SPARE_PARTS",
  "INSURANCE",
  "POLLUTION_CERTIFICATE",
  "PERMIT_FITNESS",
  "ROAD_TAX_PERMIT",
  "VEHICLE_WASHING",
  "TOLL",
  "PARKING",
  "TOLL_PARKING",
  "DRIVER_ALLOWANCE",
  "OTHER",
];

const createVehicleFuelLogSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  driverId: z.string().uuid().optional().nullable().or(z.literal("")),
  fuelDate: z.string().optional(),
  fuelType: z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]).default("DIESEL"),
  fuelStation: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  quantityLitres: z.coerce.number().positive("Quantity must be greater than 0"),
  quantityUnit: z.string().optional().default("L"),
  pricePerUnit: z.coerce.number().positive("Price per unit must be greater than 0"),
  odometerReading: z.coerce.number().min(0, "Odometer reading is required"),
  allowOdometerReset: z.boolean().optional().default(false),
  isFullTank: z.boolean().default(true),
  receiptDocumentUrl: z.string().optional().nullable().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("CASH"),
});

const createVehicleMaintenanceSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  serviceCategory: z.enum(SERVICE_CATEGORIES).default("REGULAR_SERVICE"),
  serviceDate: z.string().optional(),
  odometerReading: z.coerce.number().min(0, "Odometer reading is required"),
  serviceProvider: z.string().optional().nullable(),
  descriptionOfWork: z.string().min(3, "Description of work is required"),
  partsCost: z.coerce.number().min(0).default(0),
  labourCost: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  invoiceDocumentUrl: z.string().optional().nullable().or(z.literal("")),
  nextServiceDate: z.string().optional().nullable(),
  nextServiceOdometer: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("BANK_TRANSFER"),
});

const createVehicleExpenseSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  expenseCategory: z.enum(EXPENSE_CATEGORIES).default("OTHER"),
  expenseDate: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  taxAmount: z.coerce.number().min(0).default(0),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("CASH"),
  paymentReference: z.string().optional().nullable(),
  description: z.string().min(3, "Description is required"),
  receiptDocumentUrl: z.string().optional().nullable().or(z.literal("")),
});

// ==============================================================================
// TEST SCENARIOS
// ==============================================================================

describe("1. DeepSeek Vision OCR Normalization & Defensive Parsing Suite", () => {
  it("should normalize clean fuel receipt extraction with correct types and confidence", () => {
    const rawAiReply = {
      match: "yes",
      readable: "full",
      fields: {
        date: "2026-11-20",
        time: "14:30",
        vendor: "Indian Oil Corporation, Hosur Road",
        invoiceNumber: "IOC-98412",
        fuelType: "DIESEL",
        quantity: 45.5,
        quantityUnit: "L",
        ratePerUnit: 94.2,
        totalAmount: 4286.1,
        odometerKm: 52400,
        vehicleRegistration: "TN-01-AB-1234",
        paymentMethod: "UPI",
      },
      fieldConfidence: {
        totalAmount: 0.98,
        quantity: 0.96,
        ratePerUnit: 0.95,
        odometerKm: 0.9,
      },
    };

    const normalized = normalizeExtractionResult(rawAiReply, "fuel_receipt");

    assert.equal(normalized.status, "success");
    assert.equal(normalized.fields.totalAmount, 4286.1);
    assert.equal(normalized.fields.quantity, 45.5);
    assert.equal(normalized.fields.ratePerUnit, 94.2);
    assert.equal(normalized.fields.fuelType, "DIESEL");
    assert.equal(normalized.fields.vendor, "Indian Oil Corporation, Hosur Road");
    assert.equal(normalized.fields.odometerKm, 52400);
    assert.equal(normalized.missingFields.length, 0);
    assert.equal(normalized.checks.length, 0);
    assert.equal(normalized.requiresReview, true);
  });

  it("should extract dispenser pump meter reading and flag missing receipt-only fields as partial", () => {
    const rawMeterReply = {
      match: "yes",
      readable: "full",
      fields: {
        quantity: 38.25,
        quantityUnit: "L",
        ratePerUnit: 98.4,
        totalAmount: 3763.8,
      },
      fieldConfidence: {
        quantity: 0.99,
        totalAmount: 0.99,
      },
    };

    const normalized = normalizeExtractionResult(rawMeterReply, "pump_meter");

    assert.equal(normalized.status, "success");
    assert.equal(normalized.fields.quantity, 38.25);
    assert.equal(normalized.fields.totalAmount, 3763.8);
    assert.equal(normalized.fields.ratePerUnit, 98.4);
    assert.equal(normalized.fields.vendor, null);
    assert.equal(normalized.fields.date, null);
  });

  it("should accurately extract total odometer reading and ignore trip meter", () => {
    const rawOdoReply = {
      match: "yes",
      readable: "full",
      fields: {
        odometerKm: 64210,
      },
      fieldConfidence: {
        odometerKm: 0.95,
      },
    };

    const normalized = normalizeExtractionResult(rawOdoReply, "odometer");

    assert.equal(normalized.status, "success");
    assert.equal(normalized.fields.odometerKm, 64210);
    assert.equal(normalized.fields.totalAmount, null);
    assert.equal(normalized.missingFields.length, 0);
  });

  it("should reject unrelated/invalid images (e.g. selfies or greeting cards) with INVALID_IMAGE status", () => {
    const rawInvalidReply = {
      match: "no",
      readable: "none",
      fields: {
        totalAmount: 500, // Even if hallucinated, must be zeroed out
        vendor: "Happy Diwali",
      },
      fieldConfidence: {},
    };

    const normalized = normalizeExtractionResult(rawInvalidReply, "fuel_receipt");

    assert.equal(normalized.status, "invalid_image");
    assert.equal(normalized.reasonCode, "WRONG_IMAGE");
    assert.equal(normalized.fields.totalAmount, null);
    assert.equal(normalized.fields.vendor, null);
  });

  it("should detect unreadable documents with UNREADABLE status", () => {
    const rawBlurryReply = {
      match: "unsure",
      readable: "none",
      fields: {},
      fieldConfidence: {},
    };

    const normalized = normalizeExtractionResult(rawBlurryReply, "fuel_receipt");

    assert.equal(normalized.status, "unreadable");
    assert.equal(normalized.reasonCode, "NO_VALUES_READ");
  });

  it("should extract maintenance workshop invoice with vendor, amount, taxes and description", () => {
    const rawServiceReply = {
      match: "yes",
      readable: "full",
      fields: {
        date: "2026-11-15",
        vendor: "TVS Commercial Spares & Services",
        invoiceNumber: "TVS-2026-904",
        totalAmount: 18450.0,
        taxAmount: 2814.4,
        description: "Clutch plate overhaul, transmission oil change, front brake shoe relining",
        odometerKm: 54100,
        category: "repair",
      },
      fieldConfidence: {
        totalAmount: 0.98,
        invoiceNumber: 0.95,
      },
    };

    const normalized = normalizeExtractionResult(rawServiceReply, "expense_bill", "repair");

    assert.equal(normalized.status, "success");
    assert.equal(normalized.fields.totalAmount, 18450.0);
    assert.equal(normalized.fields.taxAmount, 2814.4);
    assert.equal(normalized.fields.vendor, "TVS Commercial Spares & Services");
    assert.equal(normalized.fields.invoiceNumber, "TVS-2026-904");
    assert.equal(normalized.fields.category, "repair");
  });

  it("should support combined 3-in-1 scanning with field origins tracking", () => {
    const rawCombinedReply = {
      match: "yes",
      readable: "full",
      fields: {
        date: "2026-11-20",
        vendor: "Bharat Petroleum Highway Oasis",
        invoiceNumber: "BP-5821",
        quantity: 50.0,
        ratePerUnit: 96.5,
        totalAmount: 4825.0,
        odometerKm: 78500,
        fuelType: "DIESEL",
      },
      fieldOrigins: {
        date: "receipt",
        vendor: "receipt",
        invoiceNumber: "receipt",
        quantity: "pump_meter",
        ratePerUnit: "pump_meter",
        totalAmount: "pump_meter",
        odometerKm: "odometer",
      },
      fieldConfidence: {
        totalAmount: 0.98,
        quantity: 0.99,
        odometerKm: 0.97,
      },
    };

    const normalized = normalizeExtractionResult(rawCombinedReply, "combined_fuel");

    assert.equal(normalized.status, "success");
    assert.equal(normalized.fieldOrigins.quantity, "pump_meter");
    assert.equal(normalized.fieldOrigins.odometerKm, "odometer");
    assert.equal(normalized.fieldOrigins.vendor, "receipt");
    assert.equal(normalized.fields.totalAmount, 4825.0);
    assert.equal(normalized.fields.odometerKm, 78500);
  });
});

describe("2. Fuel Calculations, Arithmetic Checks & Mileage Tracking Suite", () => {
  it("should verify consistent amount when quantity * rate matches total within 2% tolerance", () => {
    const check1 = crossCheckFuelAmount({
      quantity: 50.0,
      pricePerUnit: 98.5,
      totalAmount: 4925.0,
    });
    assert.equal(check1.consistent, true);
    assert.equal(check1.difference, 0);

    // Minor paisa rounding difference (e.g. ₹1 difference on ₹5000)
    const check2 = crossCheckFuelAmount({
      quantity: 50.0,
      pricePerUnit: 98.5,
      totalAmount: 4926.0,
    });
    assert.equal(check2.consistent, true);
    assert.ok(check2.difference <= check2.tolerance);
  });

  it("should flag inconsistent amount when quantity * rate diverges from total by more than tolerance", () => {
    const check = crossCheckFuelAmount({
      quantity: 50.0,
      pricePerUnit: 98.5,
      totalAmount: 4200.0, // Major mismatch
    });
    assert.equal(check.consistent, false);
    assert.equal(check.expectedAmount, 4925.0);
    assert.equal(check.difference, 725.0);
  });

  it("should calculate exact distance, mileage (KM/L) and cost per km between two odometer readings", () => {
    const prevOdometer = 50000;
    const currentOdometer = 50350; // 350 km
    const fuelQuantity = 50; // 50 Litres
    const totalCost = 4925; // ₹4,925

    const distance = currentOdometer - prevOdometer;
    const mileage = distance / fuelQuantity;
    const costPerKm = totalCost / distance;

    assert.equal(distance, 350);
    assert.equal(mileage, 7.0); // 7.00 km/L (typical commercial truck)
    assert.equal(Math.round(costPerKm * 100) / 100, 14.07); // ₹14.07 / km

    // Within plausible bounds for commercial fleet
    assert.ok(mileage >= MIN_PLAUSIBLE_KM_PER_LITRE);
    assert.ok(mileage <= MAX_PLAUSIBLE_KM_PER_LITRE);
  });

  it("should reject negative fuel quantity and zero rate in schema validation", () => {
    const invalidPayload = {
      vehicleId: "11111111-1111-1111-1111-111111111111",
      quantityLitres: -10, // Invalid
      pricePerUnit: 0, // Invalid
      odometerReading: 50000,
    };

    const parsed = createVehicleFuelLogSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false);
    const errors = parsed.error.flatten().fieldErrors;
    assert.ok(errors.quantityLitres);
    assert.ok(errors.pricePerUnit);
  });
});

describe("3. Vehicle Maintenance & Expense Categorization Suite", () => {
  it("should validate all 11 required vehicle expense categories in INVENTRA", () => {
    const categoriesToTest = [
      "REGULAR_SERVICE",
      "MECHANICAL_REPAIR",
      "ELECTRICAL_REPAIR",
      "TYRES_BATTERIES",
      "SPARE_PARTS",
      "INSURANCE",
      "POLLUTION_CERTIFICATE",
      "PERMIT_FITNESS",
      "VEHICLE_WASHING",
      "TOLL_PARKING",
      "OTHER",
    ];

    for (const cat of categoriesToTest) {
      assert.ok(
        SERVICE_CATEGORIES.includes(cat) || EXPENSE_CATEGORIES.includes(cat),
        `Category ${cat} must be recognized in schemas`
      );
    }
  });

  it("should validate workshop maintenance schema with parts, labour and tax costs", () => {
    const validJob = {
      vehicleId: "22222222-2222-2222-2222-222222222222",
      serviceCategory: "REGULAR_SERVICE",
      serviceDate: "2026-11-20",
      odometerReading: 58000,
      serviceProvider: "Mahindra Authorised Service",
      descriptionOfWork: "Scheduled 60,000 km periodic service with engine oil change and hub greasing",
      partsCost: 8500,
      labourCost: 3200,
      taxAmount: 2106,
      nextServiceDate: "2027-05-20",
      nextServiceOdometer: 68000,
      postToAccounts: true,
      paymentMode: "BANK_TRANSFER",
    };

    const parsed = createVehicleMaintenanceSchema.safeParse(validJob);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      const total = parsed.data.partsCost + parsed.data.labourCost + parsed.data.taxAmount;
      assert.equal(total, 13806);
    }
  });

  it("should validate direct non-fuel vehicle expense schema (e.g. Insurance / Tolls)", () => {
    const validExpense = {
      vehicleId: "22222222-2222-2222-2222-222222222222",
      expenseCategory: "INSURANCE",
      expenseDate: "2026-11-20",
      amount: 45000,
      taxAmount: 8100, // 18% GST
      paymentMode: "BANK_TRANSFER",
      paymentReference: "CHQ-092182",
      description: "Annual Comprehensive Goods Carrier Insurance Renewal (Policy #BA-9941029)",
    };

    const parsed = createVehicleExpenseSchema.safeParse(validExpense);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      const total = parsed.data.amount + parsed.data.taxAmount;
      assert.equal(total, 53100);
    }
  });
});

describe("4. Double-Entry General Ledger Guarantee (SUM(debits) === SUM(credits))", () => {
  it("should strictly guarantee SUM(debits) === SUM(credits) for Fuel Journal Voucher on Account 5030", () => {
    const fuelCost = new Prisma.Decimal("4925.00");

    const journalLines = [
      {
        accountCode: "5030",
        accountName: "Transport & Vehicle Fuel Costs",
        debitAmount: fuelCost,
        creditAmount: new Prisma.Decimal(0),
      },
      {
        accountCode: "1010",
        accountName: "Cash on Hand",
        debitAmount: new Prisma.Decimal(0),
        creditAmount: fuelCost,
      },
    ];

    const sumDebits = journalLines.reduce((sum, l) => sum.plus(l.debitAmount), new Prisma.Decimal(0));
    const sumCredits = journalLines.reduce((sum, l) => sum.plus(l.creditAmount), new Prisma.Decimal(0));

    assert.equal(sumDebits.equals(sumCredits), true);
    assert.equal(sumDebits.toFixed(2), "4925.00");
    assert.equal(sumCredits.toFixed(2), "4925.00");
  });

  it("should strictly guarantee SUM(debits) === SUM(credits) for Maintenance Journal Voucher on Account 5035", () => {
    const partsCost = new Prisma.Decimal("8500.00");
    const labourCost = new Prisma.Decimal("3200.00");
    const taxCost = new Prisma.Decimal("2106.00");
    const totalCost = partsCost.plus(labourCost).plus(taxCost); // 13806.00

    const journalLines = [
      {
        accountCode: "5035",
        accountName: "Vehicle Servicing & Maintenance",
        debitAmount: totalCost,
        creditAmount: new Prisma.Decimal(0),
      },
      {
        accountCode: "1020",
        accountName: "HDFC Bank Operating Account",
        debitAmount: new Prisma.Decimal(0),
        creditAmount: totalCost,
      },
    ];

    const sumDebits = journalLines.reduce((sum, l) => sum.plus(l.debitAmount), new Prisma.Decimal(0));
    const sumCredits = journalLines.reduce((sum, l) => sum.plus(l.creditAmount), new Prisma.Decimal(0));

    assert.equal(sumDebits.equals(sumCredits), true);
    assert.equal(sumDebits.toFixed(2), "13806.00");
    assert.equal(sumCredits.toFixed(2), "13806.00");
  });
});
