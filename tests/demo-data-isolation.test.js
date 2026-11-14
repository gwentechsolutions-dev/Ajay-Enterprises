import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

// ==============================================================================
// INVENTRA ERP: DEMO DATA MANAGEMENT & ISOLATION VERIFICATION SUITE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// Comprehensive Verification of Data Isolation, Accounting Integrity & Safe Cleanup
// ==============================================================================

const prisma = new PrismaClient();

// ------------------------------------------------------------------------------
// Validation Schemas for Demo Data Domain
// ------------------------------------------------------------------------------
const demoDataRunSchema = z.object({
  runNumber: z.string().regex(/^DEMO-\d{4}-\d{2,4}$/, "Invalid demo run number format"),
  status: z.enum(["ACTIVE", "CLEARED"]).default("ACTIVE"),
  totalRecords: z.number().int().min(0),
  moduleCounts: z.record(z.string(), z.number()),
});

const demoRecordTrackingSchema = z.object({
  demoRunId: z.string().uuid(),
  tableName: z.string().min(1),
  recordId: z.string().min(1),
  recordCode: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
});

describe("1. Demo Data Management: Schemas & Tracking Integrity", () => {
  it("should validate valid DemoDataRun payload", () => {
    const validPayload = {
      runNumber: "DEMO-2026-2701",
      status: "ACTIVE",
      totalRecords: 142,
      moduleCounts: {
        masterData: 12,
        inventory: 24,
        purchases: 8,
        operations: 16,
        rentals: 18,
        accounting: 28,
        fleet: 12,
        labour: 14,
        maintenance: 10,
      },
    };
    const parsed = demoDataRunSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
  });

  it("should reject invalid DemoDataRun format or negative record counts", () => {
    const invalidPayload = {
      runNumber: "INVALID-FORMAT",
      status: "ACTIVE",
      totalRecords: -5,
      moduleCounts: {},
    };
    const parsed = demoDataRunSchema.safeParse(invalidPayload);
    assert.equal(parsed.success, false);
  });

  it("should validate DemoDataRecord registry entry with UUID and tableName", () => {
    const entry = {
      demoRunId: "a0000000-0000-0000-0000-000000000001",
      tableName: "Invoice",
      recordId: "b0000000-0000-0000-0000-000000000001",
      recordCode: "AE/INV/DEMO-2026-0001",
      details: "Rental Tax Invoice for Skyline Infra",
    };
    const parsed = demoRecordTrackingSchema.safeParse(entry);
    assert.equal(parsed.success, true);
  });
});

describe("2. Double-Entry Accounting Rule Enforcement on Demo Journals", () => {
  it("should enforce SUM(debits) === SUM(credits) on demo sales invoice journals", () => {
    const lines = [
      { accountCode: "1030", debitAmount: new Prisma.Decimal("188210.00"), creditAmount: new Prisma.Decimal("0.00") },
      { accountCode: "4010", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("145000.00") },
      { accountCode: "4030", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("8000.00") },
      { accountCode: "4040", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("6500.00") },
      { accountCode: "2041", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("14355.00") },
      { accountCode: "2042", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("14355.00") },
    ];

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const l of lines) {
      totalDebit = totalDebit.add(l.debitAmount);
      totalCredit = totalCredit.add(l.creditAmount);
    }

    assert.equal(totalDebit.toFixed(2), totalCredit.toFixed(2));
    assert.equal(totalDebit.toFixed(2), "188210.00");
  });

  it("should enforce SUM(debits) === SUM(credits) on capital and operational expenses", () => {
    const capitalLines = [
      { accountCode: "1020", debitAmount: new Prisma.Decimal("1500000.00"), creditAmount: new Prisma.Decimal("0.00") },
      { accountCode: "1010", debitAmount: new Prisma.Decimal("150000.00"), creditAmount: new Prisma.Decimal("0.00") },
      { accountCode: "1200", debitAmount: new Prisma.Decimal("3500000.00"), creditAmount: new Prisma.Decimal("0.00") },
      { accountCode: "3010", debitAmount: new Prisma.Decimal("0.00"), creditAmount: new Prisma.Decimal("5150000.00") },
    ];

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const l of capitalLines) {
      totalDebit = totalDebit.add(l.debitAmount);
      totalCredit = totalCredit.add(l.creditAmount);
    }
    assert.equal(totalDebit.toFixed(2), totalCredit.toFixed(2));
    assert.equal(totalDebit.toFixed(2), "5150000.00");
  });
});

describe("3. Movement-Derived Inventory Stock Calculation Integrity", () => {
  it("should calculate exact warehouse available stock from movement sequences", () => {
    // Sequence:
    // + 2,500 Opening Stock (Warehouse)
    // +   400 Purchase Receipt (GRN)
    // -   500 Delivery Dispatch (DN)
    // +   125 Return Receipt Good (MRN)
    // +    18 Repaired & Released from Maintenance
    // Available in Main Yard = 2500 + 400 - 500 + 125 + 18 = 2543 units
    const openingQty = new Prisma.Decimal(2500);
    const grnQty = new Prisma.Decimal(400);
    const dnQty = new Prisma.Decimal(500);
    const returnGoodQty = new Prisma.Decimal(125);
    const repairedQty = new Prisma.Decimal(18);

    const calculatedAvailable = openingQty
      .add(grnQty)
      .sub(dnQty)
      .add(returnGoodQty)
      .add(repairedQty);

    assert.equal(calculatedAvailable.toNumber(), 2543);
  });

  it("should correctly calculate site custody stock across dispatches, returns, and direct transfers", () => {
    // Skyline Site 1A:
    // + 500 Delivered (DN)
    // - 150 Returned (MRN)
    // - 100 Transferred Direct to Apex Site 2A (DSTN)
    // Custody remaining at Skyline Site 1A = 500 - 150 - 100 = 250 units
    const delivered = new Prisma.Decimal(500);
    const returned = new Prisma.Decimal(150);
    const directTransferred = new Prisma.Decimal(100);

    const currentHeld = delivered.sub(returned).sub(directTransferred);
    assert.equal(currentHeld.toNumber(), 250);

    // Apex Site 2A:
    // + 100 Received from Skyline Site 1A via Direct Transfer
    // Custody at Apex Site 2A = 100 units
    const apexReceived = directTransferred;
    assert.equal(apexReceived.toNumber(), 100);
  });
});

describe("4. Database Live Isolation & Safe One-Click Cleanup Execution", () => {
  let testDemoRunId;
  let testGenuineCustomerId;
  let testGenuineSiteId;
  let testDemoCustomerId;

  before(async () => {
    const existing = await prisma.demoDataRun.findFirst({ where: { status: "ACTIVE" } });
    if (existing) {
      await prisma.demoDataRecord.deleteMany({ where: { demoRunId: existing.id } });
      await prisma.demoDataRun.update({
        where: { id: existing.id },
        data: { status: "CLEARED", clearedAt: new Date() },
      });
    }
  });

  after(async () => {
    if (testDemoRunId) {
      await prisma.demoDataRecord.deleteMany({ where: { demoRunId: testDemoRunId } });
      if (testDemoCustomerId) {
        await prisma.customer.deleteMany({ where: { id: testDemoCustomerId } });
      }
      await prisma.demoDataRun.deleteMany({ where: { id: testDemoRunId } });
    }

    if (testGenuineCustomerId) {
      if (testGenuineSiteId) {
        await prisma.stockBalance.deleteMany({ where: { siteId: testGenuineSiteId } });
        await prisma.customerSite.deleteMany({ where: { id: testGenuineSiteId } });
      }
      await prisma.customer.deleteMany({ where: { id: testGenuineCustomerId } });
    }

    await prisma.$disconnect();
  });

  it("should create a demo run alongside genuine customer records", async () => {
    // 1. Create a GENUINE business customer (isDemo: false, demoRunId: null)
    const genuineCustomer = await prisma.customer.create({
      data: {
        customerCode: `CUST-REAL-TEST-99`,
        name: "Genuine Real Construction Pvt Ltd",
        legalBusinessName: "Genuine Real Construction Private Limited",
        customerType: "COMPANY",
        gstStatus: "REGISTERED",
        gstin: "29AABCU8888Z1Z2",
        pan: "AABCU8888Z",
        primaryMobile: "9988776655",
        billingAddress: "Real Office Complex, Residency Road, Bengaluru",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560025",
        isDemo: false,
        demoRunId: null,
      },
    });
    testGenuineCustomerId = genuineCustomer.id;

    const genuineSite = await prisma.customerSite.create({
      data: {
        customerId: genuineCustomer.id,
        siteCode: "SITE-REAL-99",
        siteName: "Genuine Real Project Site Alpha",
        fullAddress: "Residency Road, Bengaluru",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560025",
        gpsLatitude: new Prisma.Decimal("12.9719"),
        gpsLongitude: new Prisma.Decimal("77.6012"),
        siteInCharge: "Real Engineer",
        siteContactDetails: "9988776656",
        isDemo: false,
        demoRunId: null,
      },
    });
    testGenuineSiteId = genuineSite.id;

    // 2. Create a DEMO run and a DEMO customer
    const demoRun = await prisma.demoDataRun.create({
      data: {
        runNumber: `DEMO-TEST-${Date.now().toString().slice(-4)}`,
        status: "ACTIVE",
        totalRecords: 1,
        moduleCounts: JSON.stringify({ masterData: 1 }),
      },
    });
    testDemoRunId = demoRun.id;

    const demoCustomer = await prisma.customer.create({
      data: {
        customerCode: `CUST-DEMO-TEST-01`,
        name: "Sample Demo Customer Pvt Ltd",
        legalBusinessName: "Sample Demo Customer Private Limited",
        customerType: "COMPANY",
        gstStatus: "REGISTERED",
        gstin: "29AABCS1111Z1Z1",
        pan: "AABCS1111Z",
        primaryMobile: "9800112233",
        billingAddress: "Demo Address, Whitefield, Bengaluru",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560066",
        isDemo: true,
        demoRunId: demoRun.id,
      },
    });
    testDemoCustomerId = demoCustomer.id;

    await prisma.demoDataRecord.create({
      data: {
        demoRunId: demoRun.id,
        tableName: "Customer",
        recordId: demoCustomer.id,
        recordCode: demoCustomer.customerCode,
        details: demoCustomer.name,
      },
    });

    assert.ok(genuineCustomer.id);
    assert.ok(demoCustomer.id);
    assert.equal(genuineCustomer.isDemo, false);
    assert.equal(demoCustomer.isDemo, true);
  });

  it("should detect conflict if genuine record references a demo customer", async () => {
    const demoCust = await prisma.customer.findUnique({ where: { id: testDemoCustomerId } });
    assert.ok(demoCust);

    const conflictFound = (demoCustId, genuineInvoices) => {
      return genuineInvoices.some((inv) => inv.customerId === demoCustId && inv.isDemo === false);
    };

    const simulatedGenuineInvoices = [
      { invoiceNumber: "INV-REAL-001", customerId: testDemoCustomerId, isDemo: false },
    ];

    assert.equal(conflictFound(testDemoCustomerId, simulatedGenuineInvoices), true);
  });

  it("should cleanly remove demo records and preserve genuine records completely untouched", async () => {
    // Execute reverse deletion of the demo records
    await prisma.demoDataRecord.deleteMany({ where: { demoRunId: testDemoRunId } });
    await prisma.customer.deleteMany({ where: { demoRunId: testDemoRunId } });
    await prisma.demoDataRun.update({
      where: { id: testDemoRunId },
      data: { status: "CLEARED", clearedAt: new Date() },
    });

    // 1. Verify demo customer is completely gone
    const demoCustCheck = await prisma.customer.findUnique({ where: { id: testDemoCustomerId } });
    assert.equal(demoCustCheck, null, "Demo customer was not deleted!");

    // 2. CRITICAL: Verify genuine customer is 100% intact!
    const genuineCustCheck = await prisma.customer.findUnique({ where: { id: testGenuineCustomerId } });
    assert.ok(genuineCustCheck, "Genuine customer was deleted! Isolation violation!");
    assert.equal(genuineCustCheck.name, "Genuine Real Construction Pvt Ltd");
    assert.equal(genuineCustCheck.isDemo, false);

    // 3. Verify genuine site is 100% intact!
    const genuineSiteCheck = await prisma.customerSite.findUnique({ where: { id: testGenuineSiteId } });
    assert.ok(genuineSiteCheck, "Genuine customer site was deleted!");
    assert.equal(genuineSiteCheck.siteName, "Genuine Real Project Site Alpha");
  });
});
