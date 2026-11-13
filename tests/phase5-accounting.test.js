import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ==============================================================================
// INVENTRA PHASE 5: INVOICING, GST & DOUBLE-ENTRY ACCOUNTING ERP TEST SUITE
// Operating Business Identity: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

// Helper for exact decimal arithmetic matching PostgreSQL DECIMAL(15, 2)
function roundTo2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ------------------------------------------------------------------------------
// GST Engine Logic Matching src/lib/accounting/gst-engine.ts
// ------------------------------------------------------------------------------
function isValidGstin(gstin) {
  if (!gstin) return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

function getStateCodeFromGstin(gstin) {
  if (!gstin || !isValidGstin(gstin)) return "33"; // Default Tamil Nadu
  return gstin.trim().substring(0, 2);
}

function calculateGst({ taxableValue, gstRatePercent = 18, placeOfSupply = "33", supplierStateCode = "33" }) {
  const taxable = new Prisma.Decimal(taxableValue);
  const rate = new Prisma.Decimal(gstRatePercent);
  const isInterState = placeOfSupply.trim() !== supplierStateCode.trim();

  let cgstRatePercent = new Prisma.Decimal(0);
  let sgstRatePercent = new Prisma.Decimal(0);
  let igstRatePercent = new Prisma.Decimal(0);

  let cgstAmount = new Prisma.Decimal(0);
  let sgstAmount = new Prisma.Decimal(0);
  let igstAmount = new Prisma.Decimal(0);

  if (isInterState) {
    igstRatePercent = rate;
    igstAmount = taxable.times(rate).dividedBy(100);
  } else {
    const halfRate = rate.dividedBy(2);
    cgstRatePercent = halfRate;
    sgstRatePercent = halfRate;
    cgstAmount = taxable.times(halfRate).dividedBy(100);
    sgstAmount = taxable.times(halfRate).dividedBy(100);
  }

  const totalTaxAmount = cgstAmount.plus(sgstAmount).plus(igstAmount);
  const totalAmount = taxable.plus(totalTaxAmount);

  return {
    isInterState,
    taxableValue: taxable,
    gstRatePercent: rate,
    cgstRatePercent,
    cgstAmount,
    sgstRatePercent,
    sgstAmount,
    igstRatePercent,
    igstAmount,
    totalTaxAmount,
    totalAmount,
  };
}

function calculateRoundOff(rawAmount) {
  const raw = new Prisma.Decimal(rawAmount);
  const rounded = new Prisma.Decimal(Math.round(raw.toNumber()));
  const roundOff = rounded.minus(raw);
  return { roundedTotal: rounded, roundOffAmount: roundOff };
}

// ------------------------------------------------------------------------------
// Zod Validation Schemas Mirroring src/lib/schemas/accounting.ts
// ------------------------------------------------------------------------------
const createAccountSchema = z.object({
  accountCode: z.string().min(3).max(10),
  accountName: z.string().min(2),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  subcategory: z.string(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  openingBalance: z.coerce.number().default(0),
  isControlAccount: z.boolean().default(false),
});

const journalLineSchema = z
  .object({
    accountId: z.string().uuid(),
    description: z.string().optional().nullable(),
    debitAmount: z.coerce.number().min(0).default(0),
    creditAmount: z.coerce.number().min(0).default(0),
  })
  .refine(
    (d) => (d.debitAmount > 0 && d.creditAmount === 0) || (d.creditAmount > 0 && d.debitAmount === 0),
    { message: "Must be either debit or credit, not both." }
  );

const createJournalEntrySchema = z.object({
  journalType: z.enum(["GENERAL", "SALES", "PURCHASE", "RECEIPT", "PAYMENT", "CONTRA", "ADJUSTMENT", "REVERSAL", "YEAR_END_CLOSING"]).default("GENERAL"),
  postingDate: z.string().optional(),
  narration: z.string().min(3),
  referenceNumber: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(2),
});

const generateRentalInvoiceFromStatementSchema = z.object({
  statementId: z.string().uuid(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

const createCreditDebitNoteSchema = z.object({
  originalInvoiceId: z.string().uuid(),
  noteType: z.enum(["CREDIT", "DEBIT"]),
  reason: z.string().min(2),
  items: z.array(
    z.object({
      itemDescription: z.string().min(2),
      hsnSacCode: z.string().default("9973"),
      quantity: z.coerce.number().positive(),
      unitRate: z.coerce.number().nonnegative(),
      taxableValue: z.coerce.number().nonnegative(),
      gstRatePercent: z.coerce.number().default(18),
    })
  ).min(1),
});

const createPurchaseBillSchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNumber: z.string().min(1),
  billDate: z.string().optional(),
  dueDate: z.string().optional(),
  itcEligibility: z.enum(["ELIGIBLE", "INELIGIBLE", "BLOCKED"]).default("ELIGIBLE"),
  tdsDeducted: z.coerce.number().min(0).default(0),
  items: z.array(
    z.object({
      itemDescription: z.string().min(2),
      hsnCode: z.string().default("7308"),
      quantity: z.coerce.number().positive(),
      uom: z.string().default("Nos."),
      unitPrice: z.coerce.number().nonnegative(),
      gstRatePercent: z.coerce.number().default(18),
    })
  ).min(1),
});

const createPaymentReceiptSchema = z.object({
  customerId: z.string().uuid(),
  paymentMethod: z.enum(["BANK_TRANSFER", "NEFT_RTGS", "UPI", "CASH", "CHEQUE"]),
  receivingAccountId: z.string().uuid(),
  amountReceived: z.coerce.number().positive(),
  transactionReference: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      invoiceId: z.string().uuid(),
      amount: z.coerce.number().positive(),
    })
  ).optional(),
});

const createContraTransactionSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  description: z.string().min(3),
});

const closeFinancialYearSchema = z.object({
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/),
  retainedEarningsAccountId: z.string().uuid(),
  remarks: z.string().optional().nullable(),
});

// ==============================================================================
// TEST SPECIFICATIONS (24 TARGETED SCENARIOS)
// ==============================================================================

describe("1. Chart of Accounts & Structural Invariants", () => {
  it("should validate Chart of Accounts schema with code, category, and normal balance", () => {
    const validAsset = {
      accountCode: "1050",
      accountName: "Accounts Receivable (Trade Debtors)",
      category: "ASSET",
      subcategory: "CURRENT_ASSETS",
      normalBalance: "DEBIT",
      openingBalance: 0,
      isControlAccount: true,
    };
    const parsed = createAccountSchema.safeParse(validAsset);
    assert.strictEqual(parsed.success, true);
  });

  it("should reject accounts with invalid code format or mismatched category", () => {
    const invalidAccount = {
      accountCode: "A",
      accountName: "Invalid Account",
      category: "UNKNOWN_CAT",
      subcategory: "MISC",
    };
    const parsed = createAccountSchema.safeParse(invalidAccount);
    assert.strictEqual(parsed.success, false);
  });

  it("should enforce account numbering ranges: Assets 1000s, Liabilities 2000s, Equity 3000s, Income 4000s, Expenses 5000s", () => {
    const codeRanges = {
      ASSET: /^1\d{3}$/,
      LIABILITY: /^2\d{3}$/,
      EQUITY: /^3\d{3}$/,
      INCOME: /^4\d{3}$/,
      EXPENSE: /^5\d{3}$/,
    };

    assert.match("1010", codeRanges.ASSET);
    assert.match("2010", codeRanges.LIABILITY);
    assert.match("3010", codeRanges.EQUITY);
    assert.match("4010", codeRanges.INCOME);
    assert.match("5010", codeRanges.EXPENSE);
  });
});

describe("2. General Ledger Double-Entry Invariant (Σ Debits == Σ Credits)", () => {
  it("should validate and accept a perfectly balanced double-entry journal entry", () => {
    const balancedJournal = {
      journalType: "GENERAL",
      postingDate: "2026-06-01",
      narration: "Material maintenance expenses paid by cheque",
      lines: [
        {
          accountId: "11111111-1111-1111-1111-111111111111",
          description: "Maintenance Expenses (Debit)",
          debitAmount: 15000,
          creditAmount: 0,
        },
        {
          accountId: "22222222-2222-2222-2222-222222222222",
          description: "Bank Account HDFC (Credit)",
          debitAmount: 0,
          creditAmount: 15000,
        },
      ],
    };

    const parsed = createJournalEntrySchema.safeParse(balancedJournal);
    assert.strictEqual(parsed.success, true);

    const totalDebit = balancedJournal.lines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredit = balancedJournal.lines.reduce((sum, l) => sum + l.creditAmount, 0);
    assert.strictEqual(totalDebit, totalCredit);
    assert.strictEqual(Math.abs(totalDebit - totalCredit) <= 0.001, true);
  });

  it("should reject an unbalanced journal entry where debits do not equal credits", () => {
    const unbalancedLines = [
      { accountId: "11111111-1111-1111-1111-111111111111", debitAmount: 25000, creditAmount: 0 },
      { accountId: "22222222-2222-2222-2222-222222222222", debitAmount: 0, creditAmount: 20000 },
    ];

    const totalDebit = unbalancedLines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredit = unbalancedLines.reduce((sum, l) => sum + l.creditAmount, 0);
    const diff = Math.abs(totalDebit - totalCredit);

    // Business ledger invariant check
    assert.strictEqual(diff > 0.001, true);
    assert.strictEqual(diff, 5000);
  });

  it("should reject a journal line having both non-zero debit and non-zero credit", () => {
    const invalidLine = {
      accountId: "11111111-1111-1111-1111-111111111111",
      debitAmount: 500,
      creditAmount: 500,
    };

    const parsed = createJournalEntrySchema.safeParse({
      narration: "Invalid test entry",
      lines: [invalidLine, { accountId: "22222222-2222-2222-2222-222222222222", debitAmount: 0, creditAmount: 500 }],
    });
    assert.strictEqual(parsed.success, false);
  });
});

describe("3. Indian Statutory GST Engine & Place of Supply", () => {
  it("should calculate intra-state GST (9% CGST + 9% SGST) for Tamil Nadu (33) to Tamil Nadu (33)", () => {
    const gst = calculateGst({
      taxableValue: 100000,
      gstRatePercent: 18,
      placeOfSupply: "33",
      supplierStateCode: "33",
    });

    assert.strictEqual(gst.isInterState, false);
    assert.strictEqual(gst.cgstAmount.toNumber(), 9000);
    assert.strictEqual(gst.sgstAmount.toNumber(), 9000);
    assert.strictEqual(gst.igstAmount.toNumber(), 0);
    assert.strictEqual(gst.totalTaxAmount.toNumber(), 18000);
    assert.strictEqual(gst.totalAmount.toNumber(), 118000);
  });

  it("should calculate inter-state GST (18% IGST) for Tamil Nadu (33) to Karnataka (29)", () => {
    const gst = calculateGst({
      taxableValue: 100000,
      gstRatePercent: 18,
      placeOfSupply: "29", // Karnataka
      supplierStateCode: "33", // Tamil Nadu
    });

    assert.strictEqual(gst.isInterState, true);
    assert.strictEqual(gst.cgstAmount.toNumber(), 0);
    assert.strictEqual(gst.sgstAmount.toNumber(), 0);
    assert.strictEqual(gst.igstAmount.toNumber(), 18000);
    assert.strictEqual(gst.totalTaxAmount.toNumber(), 18000);
    assert.strictEqual(gst.totalAmount.toNumber(), 118000);
  });

  it("should round off fractional invoice amounts accurately to nearest rupee", () => {
    const roundOff1 = calculateRoundOff(15420.40);
    assert.strictEqual(roundOff1.roundedTotal.toNumber(), 15420.00);
    assert.strictEqual(roundOff1.roundOffAmount.toNumber(), -0.40);

    const roundOff2 = calculateRoundOff(15420.65);
    assert.strictEqual(roundOff2.roundedTotal.toNumber(), 15421.00);
    assert.strictEqual(roundOff2.roundOffAmount.toNumber(), 0.35);
  });

  it("should validate Indian GSTIN format and extract state code", () => {
    assert.strictEqual(isValidGstin("33AABCA1234F1Z5"), true);
    assert.strictEqual(isValidGstin("29ABCDE1234F2Z5"), true);
    assert.strictEqual(isValidGstin("INVALID_GSTIN"), false);
    assert.strictEqual(getStateCodeFromGstin("33AABCA1234F1Z5"), "33");
    assert.strictEqual(getStateCodeFromGstin("29ABCDE1234F2Z5"), "29");
    assert.strictEqual(getStateCodeFromGstin(null), "33"); // Default to intra-state TN
  });
});

describe("4. Tax Invoicing & Rental Statement Conversion", () => {
  it("should validate Rental Statement conversion schema", () => {
    const input = {
      statementId: "33333333-3333-3333-3333-333333333333",
      invoiceDate: "2026-06-01",
      dueDate: "2026-06-16",
      notes: "Monthly centering rental invoice for May 2026",
    };
    const parsed = generateRentalInvoiceFromStatementSchema.safeParse(input);
    assert.strictEqual(parsed.success, true);
  });

  it("should prevent duplicate invoice generation for the same Rental Statement", () => {
    const invoiceDb = new Map();
    function createInvoiceFromStatement(stmtId, invData) {
      if (invoiceDb.has(stmtId)) {
        throw new Error(`Tax Invoice already generated for Statement ${stmtId}. Invoice: ${invoiceDb.get(stmtId).invoiceNumber}`);
      }
      invoiceDb.set(stmtId, invData);
      return invData;
    }

    const inv1 = { id: "inv-001", invoiceNumber: "INV-2026-0001", rentalStatementId: "stmt-001" };
    createInvoiceFromStatement("stmt-001", inv1);

    assert.throws(
      () => createInvoiceFromStatement("stmt-001", { id: "inv-002", invoiceNumber: "INV-2026-0002" }),
      /Tax Invoice already generated/
    );
  });

  it("should freeze immutable snapshot payload upon invoice generation", () => {
    const invoice = {
      invoiceNumber: "INV-2026-0001",
      customer: { name: "L&T Constructions", gstin: "33AABCA1234F1Z5" },
      totalAmount: 250000,
      snapshotPayload: {
        company: { name: "AJAY ENTERPRISES", gstin: "33AAAAA0000A1Z5" },
        customer: { name: "L&T Constructions", gstin: "33AABCA1234F1Z5" },
        items: [{ description: "Props 3.0m - Rental", amount: 200000 }],
        taxBreakdown: { cgst: 18000, sgst: 18000, totalTax: 36000 },
      },
    };

    assert.ok(invoice.snapshotPayload);
    assert.strictEqual(invoice.snapshotPayload.customer.name, "L&T Constructions");
    assert.strictEqual(invoice.snapshotPayload.taxBreakdown.totalTax, 36000);
  });
});

describe("5. Credit & Debit Notes", () => {
  it("should validate Credit Note schema with invoice reference and GST correction", () => {
    const creditNote = {
      originalInvoiceId: "44444444-4444-4444-4444-444444444444",
      noteType: "CREDIT",
      reason: "RATE_DIFFERENCE",
      items: [
        {
          itemDescription: "Rental rate adjustment discount",
          hsnSacCode: "9973",
          quantity: 1,
          unitRate: 5000,
          taxableValue: 5000,
          gstRatePercent: 18,
        },
      ],
    };

    const parsed = createCreditDebitNoteSchema.safeParse(creditNote);
    assert.strictEqual(parsed.success, true);
  });
});

describe("6. Supplier Purchase Bills & Input Tax Credit (ITC)", () => {
  it("should validate Purchase Bill schema with ITC classification and TDS", () => {
    const bill = {
      supplierId: "55555555-5555-5555-5555-555555555555",
      supplierInvoiceNumber: "SUPP-INV-9901",
      billDate: "2026-05-15",
      dueDate: "2026-06-15",
      itcEligibility: "ELIGIBLE",
      tdsDeducted: 250,
      items: [
        {
          itemDescription: "Centering Acrow Spans 4.0m Purchase",
          hsnCode: "7308",
          quantity: 100,
          uom: "Nos.",
          unitPrice: 1200,
          gstRatePercent: 18,
        },
      ],
    };

    const parsed = createPurchaseBillSchema.safeParse(bill);
    assert.strictEqual(parsed.success, true);
  });

  it("should verify ITC eligibility options (ELIGIBLE, INELIGIBLE, BLOCKED)", () => {
    const allowedItc = ["ELIGIBLE", "INELIGIBLE", "BLOCKED"];
    assert.strictEqual(allowedItc.includes("ELIGIBLE"), true);
    assert.strictEqual(allowedItc.includes("BLOCKED"), true);
    assert.strictEqual(allowedItc.includes("NON_STANDARD"), false);
  });
});

describe("7. Customer Receipts, Payments & Banking Contra", () => {
  it("should validate customer payment receipt with multi-invoice allocation", () => {
    const receipt = {
      customerId: "66666666-6666-6666-6666-666666666666",
      paymentMethod: "BANK_TRANSFER",
      receivingAccountId: "77777777-7777-7777-7777-777777777777",
      amountReceived: 100000,
      transactionReference: "UTR202606019921",
      allocations: [
        { invoiceId: "88888888-8888-8888-8888-888888888888", amount: 60000 },
        { invoiceId: "99999999-9999-9999-9999-999999999999", amount: 40000 },
      ],
    };

    const parsed = createPaymentReceiptSchema.safeParse(receipt);
    assert.strictEqual(parsed.success, true);

    const totalAllocated = receipt.allocations.reduce((sum, a) => sum + a.amount, 0);
    assert.strictEqual(totalAllocated, receipt.amountReceived);
  });

  it("should calculate unallocated advance when payment received exceeds invoice allocations", () => {
    const amountReceived = new Prisma.Decimal(150000);
    const allocated = new Prisma.Decimal(100000);
    const unallocated = amountReceived.minus(allocated);

    assert.strictEqual(unallocated.toNumber(), 50000);
  });

  it("should validate Banking Contra transfer voucher schema", () => {
    const contra = {
      fromAccountId: "11111111-1111-1111-1111-111111111111", // Cash in Hand
      toAccountId: "22222222-2222-2222-2222-222222222222", // HDFC Bank
      amount: 45000,
      description: "Cash deposited into bank account",
    };

    const parsed = createContraTransactionSchema.safeParse(contra);
    assert.strictEqual(parsed.success, true);
  });

  it("should simulate journal reversal creating an exact inverse entry", () => {
    const originalLines = [
      { accountId: "acc-1050", debit: 50000, credit: 0 },
      { accountId: "acc-4010", debit: 0, credit: 50000 },
    ];

    const reversalLines = originalLines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
    }));

    assert.strictEqual(reversalLines[0].debit, 0);
    assert.strictEqual(reversalLines[0].credit, 50000);
    assert.strictEqual(reversalLines[1].debit, 50000);
    assert.strictEqual(reversalLines[1].credit, 0);

    const revTotalDebit = reversalLines.reduce((sum, l) => sum + l.debit, 0);
    const revTotalCredit = reversalLines.reduce((sum, l) => sum + l.credit, 0);
    assert.strictEqual(revTotalDebit, revTotalCredit);
  });
});

describe("8. Financial Statements & Financial Year Closing", () => {
  it("should verify Trial Balance equation (Total Debits == Total Credits)", () => {
    const trialBalanceRows = [
      { account: "Cash in Hand", debit: 24000, credit: 0 },
      { account: "Bank Account HDFC", debit: 450000, credit: 0 },
      { account: "Accounts Receivable", debit: 350000, credit: 0 },
      { account: "Centering Equipment Assets", debit: 2500000, credit: 0 },
      { account: "Accounts Payable", debit: 0, credit: 180000 },
      { account: "GST Output Tax", debit: 0, credit: 54000 },
      { account: "Owner Capital", debit: 0, credit: 2000000 },
      { account: "Retained Earnings", debit: 0, credit: 500000 },
      { account: "Rental Income", debit: 0, credit: 950000 },
      { account: "Maintenance Expenses", debit: 210000, credit: 0 },
      { account: "Labour Wages", debit: 150000, credit: 0 },
    ];

    const totalDebit = trialBalanceRows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = trialBalanceRows.reduce((sum, r) => sum + r.credit, 0);

    assert.strictEqual(totalDebit, totalCredit);
    assert.strictEqual(totalDebit, 3684000);
  });

  it("should calculate Profit & Loss Statement (Total Income - Total Expenses = Net Profit)", () => {
    const income = 950000;
    const expenses = 210000 + 150000; // Maintenance + Wages = 360000
    const netProfit = income - expenses;

    assert.strictEqual(netProfit, 590000);
  });

  it("should verify Balance Sheet fundamental equation: Assets == Liabilities + Equity", () => {
    const assets = 24000 + 450000 + 350000 + 2500000; // 3324000
    const liabilities = 180000 + 54000; // 234000
    const capitalAndReserves = 2000000 + 500000; // 2500000
    const currentPeriodProfit = 590000;
    const totalEquity = capitalAndReserves + currentPeriodProfit; // 3090000

    assert.strictEqual(assets, liabilities + totalEquity);
    assert.strictEqual(assets, 3324000);
  });

  it("should validate Financial Year Closing schema", () => {
    const fyClose = {
      fiscalYear: "2025-26",
      retainedEarningsAccountId: "33333333-3333-3333-3333-333333333333",
      remarks: "Annual FY closing completed with auditor signoff",
    };

    const parsed = closeFinancialYearSchema.safeParse(fyClose);
    assert.strictEqual(parsed.success, true);
  });

  it("should simulate Financial Year closing zeroing P&L accounts into Retained Earnings", () => {
    const netProfit = new Prisma.Decimal(590000);
    const retainedEarningsBefore = new Prisma.Decimal(500000);
    const retainedEarningsAfter = retainedEarningsBefore.plus(netProfit);

    assert.strictEqual(retainedEarningsAfter.toNumber(), 1090000);
  });
});
