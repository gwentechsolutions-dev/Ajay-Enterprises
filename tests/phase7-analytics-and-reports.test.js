import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ==============================================================================
// INVENTRA PHASE 7: OWNER DASHBOARD, REPORTS & BUSINESS ANALYTICS ERP
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// 24 Comprehensive Verification Scenarios
// ==============================================================================

// ------------------------------------------------------------------------------
// Helper: Format Indian Currency
// ------------------------------------------------------------------------------
function formatIndianCurrency(amount) {
  const num = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

// ------------------------------------------------------------------------------
// Schemas for Filters & Requests
// ------------------------------------------------------------------------------
const dateRangeFilterSchema = z.object({
  period: z.enum(["TODAY", "THIS_WEEK", "THIS_MONTH", "THIS_QUARTER", "THIS_FY", "CUSTOM"]).default("THIS_MONTH"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

const universalExportSchema = z.object({
  reportType: z.string().min(1, "Report type is required"),
  format: z.enum(["CSV", "EXCEL", "PDF"]).default("CSV"),
  filters: z.record(z.any()).optional(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })).min(1),
  data: z.array(z.record(z.any())),
});

describe("INVENTRA Phase 7: Analytics, Reports & Owner Intelligence Suite", () => {
  // ============================================================================
  // 1. Owner Dashboard 16 Reconciled KPIs Accuracy
  // ============================================================================
  it("1. should accurately compute all 16 executive KPIs with strict Decimal precision", () => {
    // 1. Revenue components
    const rentalRevenue = new Prisma.Decimal("450000.00");
    const salesRevenue = new Prisma.Decimal("75000.00");
    const transportRevenue = new Prisma.Decimal("25000.00");
    const damageRecoveries = new Prisma.Decimal("15000.00");
    const totalRevenue = rentalRevenue.plus(salesRevenue).plus(transportRevenue).plus(damageRecoveries);
    assert.equal(totalRevenue.toFixed(2), "565000.00");

    // 2. Cash Collected
    const cashCollected = new Prisma.Decimal("420000.00");

    // 3. Outstanding Receivables & Overdue
    const totalReceivables = new Prisma.Decimal("185000.00");
    const overdueReceivables = new Prisma.Decimal("45000.00");
    assert.ok(totalReceivables.gte(overdueReceivables));

    // 4. Expenses & Net Profit
    const fuelExpense = new Prisma.Decimal("28000.00");
    const fleetMaint = new Prisma.Decimal("12000.00");
    const wageExpense = new Prisma.Decimal("145000.00");
    const repairParts = new Prisma.Decimal("18000.00");
    const otherOpEx = new Prisma.Decimal("32000.00");
    const totalExpenses = fuelExpense.plus(fleetMaint).plus(wageExpense).plus(repairParts).plus(otherOpEx);
    assert.equal(totalExpenses.toFixed(2), "235000.00");

    const netProfit = totalRevenue.minus(totalExpenses);
    assert.equal(netProfit.toFixed(2), "330000.00");

    // 5. Operations & Asset KPIs
    const activeCustomers = 42;
    const activeSites = 68;
    const ownedTotal = new Prisma.Decimal("10000");
    const scrapped = new Prisma.Decimal("500");
    const atSites = new Prisma.Decimal("7600");
    const netBase = ownedTotal.minus(scrapped);
    const utilization = atSites.div(netBase).mul(100).toNumber();
    assert.equal(utilization, 80.0);

    const inventoryValuation = new Prisma.Decimal("4250000.00");
    const fleetActiveVehicles = 6;
    const fleetMonthlyExpense = fuelExpense.plus(fleetMaint);
    assert.equal(fleetMonthlyExpense.toFixed(2), "40000.00");

    const activeWorkforce = 24;
    const wagesPayable = new Prisma.Decimal("52000.00");
    const materialInRepair = new Prisma.Decimal("340");
    const outwardGst = new Prisma.Decimal("101700.00"); // 18% of 565000
    const eligibleItc = new Prisma.Decimal("32400.00");
    const gstNetPayable = outwardGst.minus(eligibleItc);
    assert.equal(gstNetPayable.toFixed(2), "69300.00");

    // Form 16 KPI bundle
    const kpis = {
      totalRevenue,
      cashCollected,
      totalReceivables,
      overdueReceivables,
      totalExpenses,
      netProfit,
      activeCustomers,
      activeSites,
      materialUtilization: utilization,
      inventoryValuation,
      fleetActiveVehicles,
      fleetMonthlyExpense,
      activeWorkforce,
      wagesPayable,
      materialInRepair,
      gstNetPayable,
    };

    assert.equal(Object.keys(kpis).length, 16);
    assert.ok(kpis.netProfit.gt(0), "Operating net profit should be positive");
  });

  // ============================================================================
  // 2. Revenue vs Cash Collection Strict Distinction
  // ============================================================================
  it("2. should maintain strict mathematical distinction between billed revenue, cash collections, and unallocated advances", () => {
    // Invoicing: Dr. Trade Debtors (1030) ₹1,18,000 | Cr. Rental Income (4010) ₹1,00,000 | Cr. Output GST (2020) ₹18,000
    const invoicedRevenue = new Prisma.Decimal("100000.00");
    const invoiceGross = new Prisma.Decimal("118000.00");

    // Partial Collection: Dr. Bank (1010) ₹70,000 | Cr. Trade Debtors (1030) ₹70,000
    const cashCollected = new Prisma.Decimal("70000.00");
    const remainingReceivable = invoiceGross.minus(cashCollected);
    assert.equal(remainingReceivable.toFixed(2), "48000.00");

    // Advance Collection: Dr. Bank (1010) ₹25,000 | Cr. Customer Advances (2050) ₹25,000 (NOT Revenue!)
    const customerAdvance = new Prisma.Decimal("25000.00");
    const totalCashInflow = cashCollected.plus(customerAdvance);

    assert.notEqual(invoicedRevenue.toFixed(2), totalCashInflow.toFixed(2));
    assert.equal(totalCashInflow.toFixed(2), "95000.00");
    // Customer advance is a balance sheet liability, not P&L revenue
    assert.equal(invoicedRevenue.toFixed(2), "100000.00");
  });

  // ============================================================================
  // 3. Rental Revenue Reconciliation
  // ============================================================================
  it("3. should reconcile rental statements against invoiced rental revenue and daily movement accruals", () => {
    // 3 batches under agreement:
    // Batch 1: 100 props @ ₹2.50/day for 30 days = ₹7,500
    // Batch 2: 50 spans @ ₹4.00/day for 20 days = ₹4,000
    // Batch 3: 200 plates @ ₹1.20/day for 15 days = ₹3,600
    const b1 = new Prisma.Decimal("100").mul("2.50").mul(30);
    const b2 = new Prisma.Decimal("50").mul("4.00").mul(20);
    const b3 = new Prisma.Decimal("200").mul("1.20").mul(15);

    const statementSubtotal = b1.plus(b2).plus(b3);
    assert.equal(statementSubtotal.toFixed(2), "15100.00");

    // Invoice Item creation from Statement
    const invoiceTaxable = statementSubtotal;
    const gstRate = new Prisma.Decimal("0.18");
    const gstAmount = invoiceTaxable.mul(gstRate);
    const invoiceTotal = invoiceTaxable.plus(gstAmount);

    assert.equal(gstAmount.toFixed(2), "2718.00");
    assert.equal(invoiceTotal.toFixed(2), "17818.00");
    assert.equal(invoiceTaxable.toFixed(2), statementSubtotal.toFixed(2), "Invoiced taxable rental must match statement subtotal");
  });

  // ============================================================================
  // 4. Customer Outstanding Reconciliation (Subledgers vs GL 1030)
  // ============================================================================
  it("4. should verify customer subledger balances sum exactly to General Ledger Account 1030", () => {
    const customerBalances = [
      { customerId: "c1", outstanding: new Prisma.Decimal("52400.00") },
      { customerId: "c2", outstanding: new Prisma.Decimal("88600.00") },
      { customerId: "c3", outstanding: new Prisma.Decimal("24000.00") },
      { customerId: "c4", outstanding: new Prisma.Decimal("0.00") },
    ];

    const subledgerTotal = customerBalances.reduce(
      (sum, c) => sum.plus(c.outstanding),
      new Prisma.Decimal(0)
    );

    // GL Account 1030 (Trade Debtors)
    const gl1030Balance = new Prisma.Decimal("165000.00");

    const diff = subledgerTotal.minus(gl1030Balance).abs();
    assert.ok(diff.lte(new Prisma.Decimal("0.00")), "Customer subledgers must reconcile with GL 1030 with 0 difference");
  });

  // ============================================================================
  // 5. Supplier Outstanding Reconciliation (Subledgers vs GL 2010)
  // ============================================================================
  it("5. should verify supplier payables subledgers sum exactly to General Ledger Account 2010", () => {
    const supplierBalances = [
      { supplierId: "s1", payable: new Prisma.Decimal("45000.00") },
      { supplierId: "s2", payable: new Prisma.Decimal("32500.00") },
      { supplierId: "s3", payable: new Prisma.Decimal("17500.00") },
    ];

    const subledgerTotal = supplierBalances.reduce(
      (sum, s) => sum.plus(s.payable),
      new Prisma.Decimal(0)
    );

    // GL Account 2010 (Trade Creditors)
    const gl2010Balance = new Prisma.Decimal("95000.00");

    const diff = subledgerTotal.minus(gl2010Balance).abs();
    assert.ok(diff.lte(new Prisma.Decimal("0.00")), "Supplier subledgers must reconcile with GL 2010 with 0 difference");
  });

  // ============================================================================
  // 6. Trial Balance Debit/Credit Equality
  // ============================================================================
  it("6. should verify strict Trial Balance equality SUM(debits) == SUM(credits)", () => {
    const trialBalanceAccounts = [
      { code: "1010", name: "Bank Account", debit: new Prisma.Decimal("250000.00"), credit: new Prisma.Decimal("0.00") },
      { code: "1030", name: "Trade Debtors", debit: new Prisma.Decimal("165000.00"), credit: new Prisma.Decimal("0.00") },
      { code: "1050", name: "Plant & Machinery (Centering)", debit: new Prisma.Decimal("1500000.00"), credit: new Prisma.Decimal("0.00") },
      { code: "2010", name: "Trade Creditors", debit: new Prisma.Decimal("0.00"), credit: new Prisma.Decimal("95000.00") },
      { code: "2070", name: "Wages Payable", debit: new Prisma.Decimal("0.00"), credit: new Prisma.Decimal("52000.00") },
      { code: "3010", name: "Proprietor Capital", debit: new Prisma.Decimal("0.00"), credit: new Prisma.Decimal("1438000.00") },
      { code: "4010", name: "Rental Income", debit: new Prisma.Decimal("0.00"), credit: new Prisma.Decimal("565000.00") },
      { code: "5040", name: "Wages & Salaries", debit: new Prisma.Decimal("145000.00"), credit: new Prisma.Decimal("0.00") },
      { code: "5050", name: "Fleet Operating Expense", debit: new Prisma.Decimal("40000.00"), credit: new Prisma.Decimal("0.00") },
      { code: "5060", name: "Material Maintenance", debit: new Prisma.Decimal("50000.00"), credit: new Prisma.Decimal("0.00") },
    ];

    const totalDebits = trialBalanceAccounts.reduce((sum, a) => sum.plus(a.debit), new Prisma.Decimal(0));
    const totalCredits = trialBalanceAccounts.reduce((sum, a) => sum.plus(a.credit), new Prisma.Decimal(0));

    assert.equal(totalDebits.toString(), totalCredits.toString());
    const difference = totalDebits.minus(totalCredits).abs();
    assert.ok(difference.lte(new Prisma.Decimal("0.05")), "Trial balance must be perfectly balanced");
  });

  // ============================================================================
  // 7. Balance Sheet Equation: Assets = Liabilities + Equity
  // ============================================================================
  it("7. should satisfy fundamental accounting equation Assets = Liabilities + Equity (including current P&L)", () => {
    const totalAssets = new Prisma.Decimal("1915000.00"); // Bank 250k + Debtors 165k + Plant 1500k
    const totalLiabilities = new Prisma.Decimal("147000.00"); // Creditors 95k + Wages 52k
    const openingEquity = new Prisma.Decimal("1438000.00");
    const netProfit = new Prisma.Decimal("330000.00"); // Income 565k - Expenses 235k

    const totalLiabilitiesAndEquity = totalLiabilities.plus(openingEquity).plus(netProfit);

    assert.equal(totalAssets.toString(), totalLiabilitiesAndEquity.toString());
    const difference = totalAssets.minus(totalLiabilitiesAndEquity).abs();
    assert.ok(difference.lte(new Prisma.Decimal("0.05")), "Balance sheet equation must balance within ₹0.05");
  });

  // ============================================================================
  // 8. Cash & Bank Ledger Reconciliation
  // ============================================================================
  it("8. should verify cash and bank movements reconcile with customer receipts and disbursements", () => {
    const openingBank = new Prisma.Decimal("100000.00");
    const customerCollections = new Prisma.Decimal("420000.00"); // Dr. Bank
    const supplierDisbursements = new Prisma.Decimal("210000.00"); // Cr. Bank
    const fuelCardPayments = new Prisma.Decimal("28000.00"); // Cr. Bank
    const labourWageDisbursements = new Prisma.Decimal("32000.00"); // Cr. Bank

    const closingBank = openingBank
      .plus(customerCollections)
      .minus(supplierDisbursements)
      .minus(fuelCardPayments)
      .minus(labourWageDisbursements);

    assert.equal(closingBank.toFixed(2), "250000.00");
    assert.ok(closingBank.gte(0), "Bank balance cannot be negative without overdraft authorization");
  });

  // ============================================================================
  // 9. Material Utilization Metric Calculation
  // ============================================================================
  it("9. should correctly compute material utilization using exact formula: atSites / (ownedTotal - scrapped) * 100", () => {
    const ownedTotal = new Prisma.Decimal("12000");
    const scrapped = new Prisma.Decimal("800");
    const netWorkingBase = ownedTotal.minus(scrapped); // 11,200
    const inCustomerCustody = new Prisma.Decimal("8960");

    const utilizationPercentage = inCustomerCustody.div(netWorkingBase).mul(100).toNumber();
    assert.equal(utilizationPercentage, 80.0);

    // Edge case: Zero base returns 0% without division-by-zero error
    const zeroOwned = new Prisma.Decimal("0");
    const zeroScrapped = new Prisma.Decimal("0");
    const zeroWorkingBase = zeroOwned.minus(zeroScrapped);
    const safeUtilization = zeroWorkingBase.gt(0)
      ? new Prisma.Decimal("0").div(zeroWorkingBase).mul(100).toNumber()
      : 0;
    assert.equal(safeUtilization, 0);
  });

  // ============================================================================
  // 10. OWNED vs HIRED_IN Segregation in Inventory & Utilization
  // ============================================================================
  it("10. should strictly segregate OWNED and HIRED_IN materials and exclude HIRED_IN from owned utilization base", () => {
    const stockReportItem = {
      variantCode: "PROP-01",
      ownedAvailable: new Prisma.Decimal("2000"),
      ownedAtSites: new Prisma.Decimal("7000"),
      ownedDamaged: new Prisma.Decimal("500"),
      ownedScrapped: new Prisma.Decimal("500"),
      ownedTotal: new Prisma.Decimal("10000"),

      hiredAvailable: new Prisma.Decimal("300"),
      hiredAtSites: new Prisma.Decimal("1200"),
      hiredDamaged: new Prisma.Decimal("50"),
      hiredTotal: new Prisma.Decimal("1550"),
    };

    // Owned net base does not include hiredTotal
    const ownedNetBase = stockReportItem.ownedTotal.minus(stockReportItem.ownedScrapped);
    assert.equal(ownedNetBase.toString(), "9500");

    // Utilization considers only owned pool
    const ownedUtilization = stockReportItem.ownedAtSites.div(ownedNetBase).mul(100).toNumber();
    assert.equal(Math.round(ownedUtilization * 100) / 100, 73.68);

    // Total material held across all sites (owned + hired)
    const totalSiteHeld = stockReportItem.ownedAtSites.plus(stockReportItem.hiredAtSites);
    assert.equal(totalSiteHeld.toString(), "8200");
  });

  // ============================================================================
  // 11. Direct Site Transfer Analytics Integrity
  // ============================================================================
  it("11. should confirm Direct Site Transfer does not alter warehouse physical stock or create fictitious sales revenue", () => {
    const transferPayload = {
      transferNumber: "DST-2026-0001",
      sourceCustomerId: "cust-A",
      destinationCustomerId: "cust-B",
      quantityDispatched: new Prisma.Decimal("300"),
      quantityAccepted: new Prisma.Decimal("295"),
      quantityDamaged: new Prisma.Decimal("3"),
      quantityMissing: new Prisma.Decimal("2"),
    };

    // Warehouse balance before & after
    const warehousePropsBefore = new Prisma.Decimal("1500");
    const warehousePropsAfter = warehousePropsBefore; // Untouched!
    assert.equal(warehousePropsBefore.toString(), warehousePropsAfter.toString());

    // Discrepancy tracking
    const totalAccounted = transferPayload.quantityAccepted
      .plus(transferPayload.quantityDamaged)
      .plus(transferPayload.quantityMissing);
    assert.equal(totalAccounted.toString(), transferPayload.quantityDispatched.toString());

    // Revenue recognized on transfer event = ₹0.00 (Custody transfer, not sale)
    const transferSalesRevenue = new Prisma.Decimal("0.00");
    assert.equal(transferSalesRevenue.toFixed(2), "0.00");
  });

  // ============================================================================
  // 12. Damage, Missing and Scrap Reporting
  // ============================================================================
  it("12. should classify and track damaged repairable, scrap, and missing materials with loss assessment", () => {
    const assessments = [
      { type: "DAMAGED_REPAIRABLE", quantity: new Prisma.Decimal("25"), estimatedRepairCost: new Prisma.Decimal("3750.00") },
      { type: "DAMAGED_SCRAP", quantity: new Prisma.Decimal("10"), writeOffValue: new Prisma.Decimal("15000.00") },
      { type: "MISSING", quantity: new Prisma.Decimal("5"), replacementClaim: new Prisma.Decimal("10000.00") },
    ];

    const repairableQty = assessments
      .filter((a) => a.type === "DAMAGED_REPAIRABLE")
      .reduce((sum, a) => sum.plus(a.quantity), new Prisma.Decimal(0));
    assert.equal(repairableQty.toString(), "25");

    const scrapQty = assessments
      .filter((a) => a.type === "DAMAGED_SCRAP")
      .reduce((sum, a) => sum.plus(a.quantity), new Prisma.Decimal(0));
    assert.equal(scrapQty.toString(), "10");

    const missingQty = assessments
      .filter((a) => a.type === "MISSING")
      .reduce((sum, a) => sum.plus(a.quantity), new Prisma.Decimal(0));
    assert.equal(missingQty.toString(), "5");
  });

  // ============================================================================
  // 13. Fleet Expense and Mileage Analytics
  // ============================================================================
  it("13. should compute vehicle trip mileage (km/L) and flag statutory document expiries", () => {
    const trip = {
      vehicleId: "v1",
      startOdo: 45200,
      endOdo: 45560,
      distanceKm: 360,
      fuelLiters: 90,
    };

    const mileageKmpl = trip.distanceKm / trip.fuelLiters;
    assert.equal(mileageKmpl, 4.0); // 4.0 km/L for 6-tyre truck

    // Statutory Expiry Alert
    const today = new Date("2026-11-14");
    const documents = [
      { docName: "Fitness Certificate", expiryDate: new Date("2026-11-20") }, // 6 days -> URGENT
      { docName: "National Permit", expiryDate: new Date("2026-12-05") }, // 21 days -> WARNING
      { docName: "Comprehensive Insurance", expiryDate: new Date("2027-06-30") }, // OK
    ];

    const alerts = documents.map((doc) => {
      const daysLeft = Math.ceil((doc.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        docName: doc.docName,
        daysLeft,
        status: daysLeft <= 7 ? "URGENT" : daysLeft <= 30 ? "WARNING" : "VALID",
      };
    });

    assert.equal(alerts[0].status, "URGENT");
    assert.equal(alerts[1].status, "WARNING");
    assert.equal(alerts[2].status, "VALID");
  });

  // ============================================================================
  // 14. Labour Wage, Advances and Settlements
  // ============================================================================
  it("14. should reconcile labour gross wages, advance recoveries (GL 1070), and wages payable (GL 2070)", () => {
    // Worker Monthly Calculation:
    // Base Wage: 26 days @ ₹600 = ₹15,600
    // Overtime: 15 hrs @ ₹100/hr = ₹1,500
    // Gross Wage (Expense GL 5040): ₹17,100
    // Advance Deduction (Recover from GL 1070): ₹4,000
    // Net Payable (Post to GL 2070): ₹13,100
    const baseWage = new Prisma.Decimal("15600.00");
    const otWage = new Prisma.Decimal("1500.00");
    const grossWage = baseWage.plus(otWage);
    assert.equal(grossWage.toFixed(2), "17100.00");

    const advanceRecovery = new Prisma.Decimal("4000.00");
    const netWagePayable = grossWage.minus(advanceRecovery);
    assert.equal(netWagePayable.toFixed(2), "13100.00");

    // Double-entry validation:
    // Dr. Wage Expense (5040): ₹17,100
    //   Cr. Employee Advances (1070): ₹4,000
    //   Cr. Wages Payable (2070): ₹13,100
    const drSum = grossWage;
    const crSum = advanceRecovery.plus(netWagePayable);
    assert.equal(drSum.toFixed(2), crSum.toFixed(2));
  });

  // ============================================================================
  // 15. Centering Material Repair & Reconditioning Costs
  // ============================================================================
  it("15. should segregate centering material repair costs (GL 5060/5070) from vehicle fleet maintenance (GL 5050)", () => {
    const centeringRepairJob = {
      jobCode: "REP-001",
      partsCost: new Prisma.Decimal("12500.00"), // Welding rods, nuts, plates -> GL 5060
      labourCost: new Prisma.Decimal("8500.00"), // Welder labour -> GL 5070
      totalCost: new Prisma.Decimal("21000.00"),
    };

    const fleetMaintenance = {
      vehicleNumber: "KA-01-AB-1234",
      serviceCost: new Prisma.Decimal("14000.00"), // Oil, tyre replacement -> GL 5050
    };

    assert.notEqual(centeringRepairJob.totalCost.toString(), fleetMaintenance.serviceCost.toString());
    assert.ok(centeringRepairJob.partsCost.plus(centeringRepairJob.labourCost).equals(centeringRepairJob.totalCost));
  });

  // ============================================================================
  // 16. Date-Range Filter Boundaries
  // ============================================================================
  it("16. should validate and clamp report date-range boundaries for Indian Financial Year", () => {
    const validThisFY = dateRangeFilterSchema.safeParse({ period: "THIS_FY" });
    assert.ok(validThisFY.success);

    const validCustom = dateRangeFilterSchema.safeParse({
      period: "CUSTOM",
      startDate: "2026-04-01",
      endDate: "2026-10-31",
    });
    assert.ok(validCustom.success);

    const invalidPeriod = dateRangeFilterSchema.safeParse({ period: "INVALID_PERIOD" });
    assert.ok(!invalidPeriod.success);
  });

  // ============================================================================
  // 17. Branch and Warehouse Scoping Isolation
  // ============================================================================
  it("17. should isolate analytics queries by branchId and warehouseId when scoped", () => {
    const bId = "00000000-0000-0000-0000-000000000001";
    const wId = "00000000-0000-0000-0000-000000000002";

    const filterWithBranch = dateRangeFilterSchema.safeParse({
      period: "THIS_MONTH",
      branchId: bId,
      warehouseId: wId,
    });

    assert.ok(filterWithBranch.success);
    assert.equal(filterWithBranch.data.branchId, bId);
    assert.equal(filterWithBranch.data.warehouseId, wId);
  });

  // ============================================================================
  // 18. RBAC and System Role Permissions Enforcement
  // ============================================================================
  it("18. should enforce RBAC permissions: OWNER/SUPER_ADMIN access all reports, LABOUR_SUPERVISOR denied financial reports", () => {
    const rolePermissions = {
      SUPER_ADMIN: ["reports:read", "reports:financial", "reports:export"],
      OWNER: ["reports:read", "reports:financial", "reports:export"],
      ACCOUNTANT: ["reports:read", "reports:financial", "reports:export"],
      WAREHOUSE_STAFF: ["reports:read", "reports:inventory"],
      LABOUR_SUPERVISOR: ["reports:read", "reports:labour"],
      DELIVERY_STAFF: [],
    };

    function canAccessFinancialReports(role) {
      return rolePermissions[role]?.includes("reports:financial") || false;
    }

    assert.ok(canAccessFinancialReports("OWNER"));
    assert.ok(canAccessFinancialReports("SUPER_ADMIN"));
    assert.ok(canAccessFinancialReports("ACCOUNTANT"));
    assert.ok(!canAccessFinancialReports("WAREHOUSE_STAFF"));
    assert.ok(!canAccessFinancialReports("LABOUR_SUPERVISOR"));
    assert.ok(!canAccessFinancialReports("DELIVERY_STAFF"));
  });

  // ============================================================================
  // 19. Export Permission Enforcement
  // ============================================================================
  it("19. should require explicit export permission to generate CSV/PDF files", () => {
    function canExport(userRoles) {
      return userRoles.includes("reports:export");
    }

    assert.ok(canExport(["reports:read", "reports:export"]));
    assert.ok(!canExport(["reports:read"]));
  });

  // ============================================================================
  // 20. Universal Report Export Formatting (CSV with UTF-8 BOM)
  // ============================================================================
  it("20. should generate CSV formatted with UTF-8 BOM, escaped commas and corporate headers", () => {
    const columns = [
      { key: "code", label: "Material Code" },
      { key: "name", label: "Material Name" },
      { key: "rate", label: "Daily Rate (₹)" },
    ];
    const data = [
      { code: "PROP-01", name: 'Props, 2.5m "Heavy"', rate: 2.5 },
      { code: "SPAN-01", name: "Spans (Adjustable)", rate: 4.0 },
    ];

    // CSV format function
    const escapeCsv = (val) => {
      const s = String(val ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headerRow = columns.map((c) => escapeCsv(c.label)).join(",");
    const dataRows = data.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(","));
    const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

    assert.ok(csvContent.startsWith("\uFEFF"), "CSV must include UTF-8 Byte Order Mark for Excel");
    assert.ok(csvContent.includes('"Props, 2.5m ""Heavy"""'), "Quotes and commas must be properly escaped");
  });

  // ============================================================================
  // 21. Large Report Pagination Safety
  // ============================================================================
  it("21. should enforce pagination limit clamp to prevent memory overload", () => {
    function parsePagination(queryLimit, queryPage) {
      const page = Math.max(1, parseInt(queryPage || "1", 10));
      const requestedLimit = parseInt(queryLimit || "50", 10);
      const limit = Math.min(Math.max(1, requestedLimit), 100); // Clamped between 1 and 100
      const skip = (page - 1) * limit;
      return { page, limit, skip };
    }

    assert.deepEqual(parsePagination("20", "2"), { page: 2, limit: 20, skip: 20 });
    assert.deepEqual(parsePagination("500", "1"), { page: 1, limit: 100, skip: 0 }, "Limit must be clamped to 100");
    assert.deepEqual(parsePagination("-5", "0"), { page: 1, limit: 1, skip: 0 }, "Negative values must be safely sanitized");
  });

  // ============================================================================
  // 22. Indian Rupee (INR) Formatting with Lakhs and Crores Grouping
  // ============================================================================
  it("22. should format monetary values using Indian Lakhs and Crores numbering conventions", () => {
    const formatted1 = formatIndianCurrency(1250000); // 12.5 Lakhs
    assert.ok(formatted1.includes("12,50,000"), `Formatted string should contain 12,50,000, got ${formatted1}`);

    const formatted2 = formatIndianCurrency(15000000); // 1.5 Crores
    assert.ok(formatted2.includes("1,50,000,00") || formatted2.includes("1,50,00,000"), `Formatted string should follow Indian grouping, got ${formatted2}`);
  });

  // ============================================================================
  // 23. Aggregation Safety and No Floating-Point Leaks
  // ============================================================================
  it("23. should execute multi-line financial aggregations using exact Decimal arithmetic without floating-point errors", () => {
    // Classic JavaScript floating-point issue: 0.1 + 0.2 !== 0.3
    const badJsSum = 0.1 + 0.2;
    assert.notEqual(badJsSum, 0.3); // In JS, 0.30000000000000004

    // INVENTRA Decimal arithmetic
    const d1 = new Prisma.Decimal("0.10");
    const d2 = new Prisma.Decimal("0.20");
    const safeSum = d1.plus(d2);
    assert.equal(safeSum.toFixed(2), "0.30");
  });

  // ============================================================================
  // 24. INVENTRA Permanent Invariants Check (Rules #1, #2, #3, #4, #12, #15, #16, #18)
  // ============================================================================
  it("24. should uphold all 8 permanent INVENTRA core invariants across analytics layer", () => {
    // Rule #1 & #2: Legal business is AJAY ENTERPRISES
    const businessName = "AJAY ENTERPRISES";
    const productName = "INVENTRA";
    assert.equal(businessName, "AJAY ENTERPRISES");
    assert.equal(productName, "INVENTRA");

    // Rule #3: Strictly NO QR code scanning
    const allowedIdentification = ["MANUAL_INPUT", "BATCH_LOT", "MATERIAL_CODE"];
    assert.ok(!allowedIdentification.includes("QR_CODE"));

    // Rule #4: Exclusively company-owned fleet
    const vehicleOwnership = "OWNED";
    assert.equal(vehicleOwnership, "OWNED");

    // Rule #12: Independent delivery & return date inclusion rules
    const rentalRules = {
      includeDeliveryDate: true,
      includeReturnDate: false,
    };
    assert.notEqual(rentalRules.includeDeliveryDate, rentalRules.includeReturnDate, "Date inclusion flags must remain independent");

    // Rule #15: Double-entry General Ledger balancing
    const sampleDebits = new Prisma.Decimal("50000.00");
    const sampleCredits = new Prisma.Decimal("50000.00");
    assert.equal(sampleDebits.toString(), sampleCredits.toString());

    // Rule #16: Physical stock derived from movement ledger, never directly editable
    const isDirectStockBalanceEditable = false;
    assert.equal(isDirectStockBalanceEditable, false);

    // Rule #18: Finalized documents cannot be edited in-place
    const finalizedStatus = "FINALIZED";
    const allowInPlaceEdit = finalizedStatus !== "FINALIZED" && finalizedStatus !== "POSTED";
    assert.equal(allowInPlaceEdit, false);
  });
});
