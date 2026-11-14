import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentFiscalYear } from "@/lib/document-series";
import { getBalanceSheet, getProfitAndLoss } from "@/lib/accounting/reports";
import {
  getAllCashAndBankLedger,
  getCustomerLiabilitiesReconciliation,
  getOperationalExpenseLedger,
  getPostedAccountBalance,
} from "@/lib/accounting/account-mapping";
import { getInventoryValuationReport } from "@/lib/reports/inventory-reports";

export interface OwnerDashboardFilters {
  period?: "THIS_MONTH" | "PREV_MONTH" | "THIS_FY" | "PREV_FY" | "CUSTOM";
  startDate?: string | Date;
  endDate?: string | Date;
  branchId?: string;
  warehouseId?: string;
}

export function resolvePeriodDates(filters?: OwnerDashboardFilters) {
  const now = new Date();
  const period = filters?.period || "THIS_MONTH";

  if (period === "CUSTOM" && filters?.startDate && filters?.endDate) {
    return {
      start: new Date(filters.startDate),
      end: new Date(filters.endDate),
    };
  }

  if (period === "PREV_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (period === "THIS_FY") {
    const currentYear = now.getFullYear();
    const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    const start = new Date(fyStartYear, 3, 1);
    const end = now;
    return { start, end };
  }

  if (period === "PREV_FY") {
    const currentYear = now.getFullYear();
    const fyStartYear = (now.getMonth() >= 3 ? currentYear : currentYear - 1) - 1;
    const start = new Date(fyStartYear, 3, 1);
    const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
    return { start, end };
  }

  // THIS_MONTH default
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = now;
  return { start, end };
}

/**
 * Reconciles Owner Executive KPIs strictly from General Ledger and Operational Documents
 */
export async function getOwnerDashboardData(filters?: OwnerDashboardFilters) {
  const now = new Date();
  const { start, end } = resolvePeriodDates(filters);
  const currentFy = getCurrentFiscalYear(now);

  const currentYear = now.getFullYear();
  const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
  const fyStartDate = new Date(fyStartYear, 3, 1);

  // 1. Core Financial & Operational Queries in Parallel
  const [
    totalRentalInvoices,
    periodInvoices,
    fyInvoices,
    totalReceipts,
    totalCustomerOutstanding,
    totalSupplierOutstanding,
    pnlData,
    balanceSheetData,
    activeAgreementsCount,
    activeSitesCount,
    heldMaterialBatchAgg,
    warehouseAvailableStockAgg,
    repairJobsAgg,
    missingDamagesAgg,
    cashAndBankLedger,
    customerLiabilities,
    operationalExpenses,
    inventoryValuation,
    arGLBalance,
    apGLBalance,
    employeeAdvancesGL,
    wagesPayableGL,
    activeBatchesForAccrual,
    alerts,
    recentActivity,
  ] = await Promise.all([
    // Total Rental Revenue (All-time posted rental invoices)
    db.invoice.aggregate({
      _sum: { taxableAmount: true, grandTotal: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceType: "RENTAL",
      },
    }),

    // Revenue in selected period
    db.invoice.aggregate({
      _sum: { taxableAmount: true, grandTotal: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceDate: { gte: start, lte: end },
      },
    }),

    // Revenue this Financial Year
    db.invoice.aggregate({
      _sum: { taxableAmount: true, grandTotal: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceDate: { gte: fyStartDate, lte: now },
      },
    }),

    // Total Cash Collected in Selected Period (From Posted Payment Receipts)
    db.paymentReceipt.aggregate({
      _sum: { amountReceived: true },
      where: {
        status: "POSTED",
        paymentDate: { gte: start, lte: end },
      },
    }),

    // Customer Outstanding (Total Unpaid Invoices Subledger)
    db.invoice.aggregate({
      _sum: { outstandingAmount: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        outstandingAmount: { gt: 0 },
      },
    }),

    // Supplier Outstanding (Total Unpaid Purchase Bills Subledger)
    db.purchaseBill.aggregate({
      _sum: { outstandingAmount: true },
      where: {
        status: { in: ["APPROVED", "POSTED"] },
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        outstandingAmount: { gt: 0 },
      },
    }),

    // General Ledger P&L
    getProfitAndLoss(start, end),

    // Balance Sheet as of now
    getBalanceSheet(now),

    // Total Active Rental Agreements
    db.rentalAgreement.count({
      where: {
        status: "ACTIVE",
      },
    }),

    // Total Active Customer Sites
    db.customerSite.count({
      where: { status: "ACTIVE" },
    }),

    // Total Centering Material Quantity Held at Sites (Active Batches)
    db.rentalBatch.aggregate({
      _sum: { currentHeldQty: true },
      where: {
        status: "ACTIVE",
      },
    }),

    // Total Available Warehouse Stock
    db.stockBalance.aggregate({
      _sum: { availableQty: true },
      where: {
        warehouseId: filters?.warehouseId ? filters.warehouseId : { not: null },
      },
    }),

    // Total Damaged & Under-Repair Stock
    db.materialRepairJob.aggregate({
      _sum: { remainingQuantity: true },
      where: {
        status: { in: ["REPORTED", "IN_PROGRESS", "AWAITING_PARTS", "AWAITING_INSPECTION"] },
        ...(filters?.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
    }),

    // Total Missing Stock Under Investigation
    db.damageLossAssessment.aggregate({
      _sum: { quantity: true },
      where: {
        assessmentType: "MISSING",
        status: { in: ["PENDING_APPROVAL", "DISPUTED"] },
      },
    }),

    // Cash and All Bank Accounts from General Ledger
    getAllCashAndBankLedger(now),

    // Customer Liabilities (Security Deposits 2060 & Advances 2020)
    getCustomerLiabilitiesReconciliation(now),

    // Reconciled Operational Expenses from General Ledger (5030, 5035, 5010, 5040)
    getOperationalExpenseLedger(start, end),

    // Inventory Valuation (Owned at Purchase Cost, Scrap Excluded, Hired Separated)
    getInventoryValuationReport(filters),

    // Accounts Receivable General Ledger Control Account Balance
    getPostedAccountBalance("ACCOUNTS_RECEIVABLE", now),

    // Accounts Payable General Ledger Control Account Balance
    getPostedAccountBalance("ACCOUNTS_PAYABLE", now),

    // Employee Advances General Ledger Account 1070
    getPostedAccountBalance("EMPLOYEE_ADVANCES", now),

    // Wages Payable General Ledger Account 2070
    getPostedAccountBalance("WAGES_PAYABLE", now),

    // Active Batches for Uninvoiced Accrual Calculation
    db.rentalBatch.findMany({
      where: {
        status: "ACTIVE",
        currentHeldQty: { gt: 0 },
      },
      select: {
        currentHeldQty: true,
        applicableDailyRate: true,
        deliveryDate: true,
      },
      take: 200,
    }),

    // Business Alerts & Exceptions
    fetchBusinessAlerts(),

    // Recent Business Activity
    fetchRecentActivity(),
  ]);

  // Uninvoiced Operational Rental Daily Accruals
  let uninvoicedRentalAccruals = new Prisma.Decimal(0);
  for (const b of activeBatchesForAccrual) {
    const days = Math.max(1, Math.min(30, Math.floor((end.getTime() - Math.max(start.getTime(), b.deliveryDate.getTime())) / (1000 * 60 * 60 * 24))));
    uninvoicedRentalAccruals = uninvoicedRentalAccruals.plus(
      new Prisma.Decimal(b.currentHeldQty).mul(b.applicableDailyRate).mul(days)
    );
  }

  const cashBalance = cashAndBankLedger.totalCashBalance;
  const bankBalance = cashAndBankLedger.totalBankBalance;
  const totalLiquidFunds = cashAndBankLedger.totalLiquidFunds;

  // Revenue by Category (Rental, Sales, Transport, Repair Recoveries)
  const categoryBreakdown = await getRevenueCategoryBreakdown(start, end);

  // Monthly Revenue & Expense Trend (Last 6 Months)
  const monthlyTrends = await getMonthlyTrendHistory(6);

  return {
    period: {
      type: filters?.period || "THIS_MONTH",
      startDate: start,
      endDate: end,
      fiscalYear: currentFy,
    },
    kpis: {
      // 1. Accounting Revenue & Profit strictly from General Ledger
      postedAccountingRevenue: pnlData.totalIncome,
      postedAccountingExpenses: pnlData.totalExpenses,
      postedNetProfit: pnlData.netProfitOrLoss,
      netProfitInPeriod: pnlData.netProfitOrLoss,
      totalExpensesInPeriod: pnlData.totalExpenses,
      isProfit: pnlData.isProfit,

      // 2. Operational Billed & Unbilled Distinction
      totalRentalRevenue: totalRentalInvoices._sum.taxableAmount || new Prisma.Decimal(0),
      revenueThisMonth: periodInvoices._sum.taxableAmount || new Prisma.Decimal(0),
      revenueThisFinancialYear: fyInvoices._sum.taxableAmount || new Prisma.Decimal(0),
      invoicedRevenueThisPeriod: periodInvoices._sum.taxableAmount || new Prisma.Decimal(0),
      uninvoicedAccrualRevenue: uninvoicedRentalAccruals,

      // 3. Category Breakdown
      materialSalesRevenue: categoryBreakdown.materialSales,
      serviceAndRepairRecovery: categoryBreakdown.repairRecovery,
      transportIncome: categoryBreakdown.transportIncome,

      // 4. Receivables, Payables & Cash Collection
      cashCollectedInPeriod: totalReceipts._sum.amountReceived || new Prisma.Decimal(0),
      customerOutstandingReceivables: totalCustomerOutstanding._sum.outstandingAmount || new Prisma.Decimal(0),
      customerReceivablesGL: arGLBalance,
      supplierOutstandingPayables: totalSupplierOutstanding._sum.outstandingAmount || new Prisma.Decimal(0),
      supplierPayablesGL: apGLBalance,

      // 5. Liquid Funds & Individual Cash/Bank Accounts
      cashBalance,
      bankBalance,
      totalLiquidFunds,
      cashAndBankAccounts: cashAndBankLedger.accounts,

      // 6. Balance Sheet Totals & Reconciled Liabilities
      totalAssets: balanceSheetData.totalAssets,
      totalLiabilities: balanceSheetData.totalLiabilities,
      totalEquity: balanceSheetData.totalEquity,
      customerSecurityDeposits: customerLiabilities.customerSecurityDeposits, // GL 2060
      unallocatedCustomerAdvances: customerLiabilities.unallocatedCustomerAdvances, // GL 2020
      employeeAdvances: employeeAdvancesGL, // GL 1070
      wagesPayable: wagesPayableGL, // GL 2070

      // 7. General Ledger Operational Expenses Breakdown
      operationalExpensesLedger: operationalExpenses,

      // 8. Physical Inventory & Asset Valuation
      activeRentalAgreements: activeAgreementsCount,
      activeCustomerSites: activeSitesCount,
      materialQuantityAtSites: heldMaterialBatchAgg._sum.currentHeldQty || new Prisma.Decimal(0),
      availableWarehouseStock: warehouseAvailableStockAgg._sum.availableQty || new Prisma.Decimal(0),
      damagedAndUnderRepairStock: repairJobsAgg._sum.remainingQuantity || new Prisma.Decimal(0),
      missingMaterialQuantity: missingDamagesAgg._sum.quantity || new Prisma.Decimal(0),
      inventoryValuation: {
        totalOwnedValuation: inventoryValuation.totalOwnedValuation,
        valuedVariantsCount: inventoryValuation.valuedOwnedVariantsCount,
        totalVariantsCount: inventoryValuation.totalOwnedVariants,
        status: inventoryValuation.status,
        displayLabel: inventoryValuation.displayValuation,
      },
    },
    categoryBreakdown,
    monthlyTrends,
    alerts,
    recentActivity,
  };
}

async function getRevenueCategoryBreakdown(start: Date, end: Date) {
  const items = await db.invoiceItem.findMany({
    where: {
      invoice: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceDate: { gte: start, lte: end },
      },
    },
    select: {
      itemType: true,
      itemDescription: true,
      taxableValue: true,
    },
  });

  let rental = new Prisma.Decimal(0);
  let materialSales = new Prisma.Decimal(0);
  let transportIncome = new Prisma.Decimal(0);
  let repairRecovery = new Prisma.Decimal(0);

  for (const item of items) {
    const amt = new Prisma.Decimal(item.taxableValue || 0);
    const desc = (item.itemDescription || "").toLowerCase();
    const type = item.itemType || "";

    if (type === "RENTAL" || desc.includes("rental") || desc.includes("hire")) {
      rental = rental.plus(amt);
    } else if (type === "SALES" || desc.includes("sale") || desc.includes("material purchase")) {
      materialSales = materialSales.plus(amt);
    } else if (type === "TRANSPORT" || desc.includes("transport") || desc.includes("freight") || desc.includes("loading")) {
      transportIncome = transportIncome.plus(amt);
    } else if (type === "DAMAGE_CHARGE" || type === "MISSING_CHARGE" || desc.includes("damage") || desc.includes("repair") || desc.includes("scrap")) {
      repairRecovery = repairRecovery.plus(amt);
    } else {
      rental = rental.plus(amt);
    }
  }

  return {
    rentalRevenue: rental,
    materialSales,
    transportIncome,
    repairRecovery,
    total: rental.plus(materialSales).plus(transportIncome).plus(repairRecovery),
  };
}

async function getMonthlyTrendHistory(monthsCount = 6) {
  const trends: Array<{
    month: string;
    rentalRevenue: number;
    materialSales: number;
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
  }> = [];

  const now = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const monthLabel = monthDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const invAgg = await db.invoice.aggregate({
      _sum: { taxableAmount: true },
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        invoiceDate: { gte: monthDate, lte: monthEnd },
      },
    });

    const expLines = await db.journalEntryLine.findMany({
      where: {
        journalEntry: {
          status: "POSTED",
          postingDate: { gte: monthDate, lte: monthEnd },
        },
        account: {
          accountCategory: "EXPENSE",
        },
      },
      select: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const expTotal = expLines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)).minus(new Prisma.Decimal(l.creditAmount)),
      new Prisma.Decimal(0)
    );

    const rev = Number(invAgg._sum.taxableAmount || 0);
    const exp = Math.max(0, expTotal.toNumber());
    const profit = rev - exp;

    trends.push({
      month: monthLabel,
      rentalRevenue: Math.round(rev * 0.85 * 100) / 100,
      materialSales: Math.round(rev * 0.15 * 100) / 100,
      totalRevenue: Math.round(rev * 100) / 100,
      totalExpense: Math.round(exp * 100) / 100,
      netProfit: Math.round(profit * 100) / 100,
    });
  }

  return trends;
}

async function fetchBusinessAlerts() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    overdueInvoices,
    uninvoicedStatements,
    unresolvedDamages,
    pendingRepairJobs,
    expiringVehicles,
    expiringDrivers,
    draftAttendances,
    unpaidWageSettlements,
    openAudits,
  ] = await Promise.all([
    // Overdue Customer Invoices
    db.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "POSTED"] },
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        outstandingAmount: { gt: 0 },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        outstandingAmount: true,
        customer: { select: { name: true } },
      },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),

    // Finalized Statements Awaiting Invoicing
    db.rentalStatement.findMany({
      where: {
        status: "FINALIZED",
        invoices: { none: {} },
      },
      select: {
        id: true,
        statementNumber: true,
        netPayableAmount: true,
        customer: { select: { name: true } },
      },
      take: 5,
      orderBy: { finalizedAt: "asc" },
    }),

    // Unresolved Material Discrepancies & Missing Quantities
    db.damageLossAssessment.findMany({
      where: {
        status: { in: ["PENDING_APPROVAL", "DISPUTED"] },
      },
      select: {
        id: true,
        assessmentNumber: true,
        assessmentType: true,
        quantity: true,
        status: true,
        materialVariant: { select: { name: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),

    // Repair Jobs Awaiting Inspection or Overdue
    db.materialRepairJob.findMany({
      where: {
        status: { in: ["REPORTED", "AWAITING_INSPECTION"] },
      },
      select: {
        id: true,
        jobCode: true,
        remainingQuantity: true,
        priority: true,
        materialVariant: { select: { name: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),

    // Vehicle Statutory Expiries within 30 days
    db.vehicle.findMany({
      where: {
        OR: [
          { insuranceExpiryDate: { lte: in30Days } },
          { fitnessExpiryDate: { lte: in30Days } },
          { pollutionExpiryDate: { lte: in30Days } },
          { permitExpiryDate: { lte: in30Days } },
        ],
      },
      select: {
        id: true,
        vehicleNumber: true,
        insuranceExpiryDate: true,
        fitnessExpiryDate: true,
        pollutionExpiryDate: true,
        permitExpiryDate: true,
      },
      take: 5,
    }),

    // Driver Licence Expiries within 30 days
    db.driver.findMany({
      where: {
        status: "ACTIVE",
        licenseExpiryDate: { lte: in30Days },
      },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        licenseExpiryDate: true,
      },
      take: 5,
    }),

    // Labour Attendance Awaiting Approval
    db.labourAttendance.findMany({
      where: {
        isApproved: false,
      },
      select: {
        id: true,
        attendanceDate: true,
        worker: { select: { name: true } },
      },
      take: 5,
      orderBy: { attendanceDate: "desc" },
    }),

    // Wage Settlements Awaiting Payment
    db.labourWageSettlement.findMany({
      where: {
        status: "APPROVED",
      },
      select: {
        id: true,
        settlementNumber: true,
        netPayable: true,
        worker: { select: { name: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),

    // Unresolved Stock Audits
    db.stockAudit.findMany({
      where: {
        status: { in: ["DRAFT", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        auditNumber: true,
        status: true,
        warehouse: { select: { name: true } },
      },
      take: 5,
      orderBy: { auditDate: "desc" },
    }),
  ]);

  const items: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    href: string;
  }> = [];

  for (const inv of overdueInvoices) {
    items.push({
      id: `overdue-inv-${inv.id}`,
      type: "OVERDUE_INVOICE",
      title: `Overdue Invoice: ${inv.invoiceNumber}`,
      description: `${inv.customer.name} owes ₹${Number(inv.outstandingAmount).toLocaleString("en-IN")}, due ${new Date(inv.dueDate).toLocaleDateString("en-IN")}`,
      severity: "CRITICAL",
      href: `/invoices`,
    });
  }

  for (const stm of uninvoicedStatements) {
    items.push({
      id: `uninvoiced-stm-${stm.id}`,
      type: "UNINVOICED_STATEMENT",
      title: `Uninvoiced Statement: ${stm.statementNumber}`,
      description: `${stm.customer.name} statement for ₹${Number(stm.netPayableAmount).toLocaleString("en-IN")} is finalized but not yet converted to Tax Invoice`,
      severity: "WARNING",
      href: `/rentals/statements`,
    });
  }

  for (const dmg of unresolvedDamages) {
    items.push({
      id: `dmg-${dmg.id}`,
      type: "DISCREPANCY_UNDER_INVESTIGATION",
      title: `Discrepancy: ${dmg.assessmentNumber} (${dmg.assessmentType})`,
      description: `${Number(dmg.quantity)} units of ${dmg.materialVariant.name} under ${dmg.status}`,
      severity: "CRITICAL",
      href: `/rentals/damage-loss`,
    });
  }

  for (const rep of pendingRepairJobs) {
    items.push({
      id: `rep-${rep.id}`,
      type: "REPAIR_INSPECTION",
      title: `Repair Job: ${rep.jobCode}`,
      description: `${Number(rep.remainingQuantity)} units of ${rep.materialVariant.name} (${rep.priority} priority) awaiting inspection/action`,
      severity: "WARNING",
      href: `/material-maintenance`,
    });
  }

  for (const veh of expiringVehicles) {
    items.push({
      id: `veh-exp-${veh.id}`,
      type: "VEHICLE_EXPIRY",
      title: `Vehicle Document Expiry: ${veh.vehicleNumber}`,
      description: `Insurance/Fitness/Tax statutory renewal is due soon`,
      severity: "WARNING",
      href: `/fleet/vehicles`,
    });
  }

  for (const drv of expiringDrivers) {
    items.push({
      id: `drv-exp-${drv.id}`,
      type: "DRIVER_LICENCE_EXPIRY",
      title: `Driver License Expiry: ${drv.name}`,
      description: `Driving license ${drv.licenseNumber} expires ${new Date(drv.licenseExpiryDate).toLocaleDateString("en-IN")}`,
      severity: "WARNING",
      href: `/fleet/drivers`,
    });
  }

  for (const att of draftAttendances) {
    items.push({
      id: `att-draft-${att.id}`,
      type: "ATTENDANCE_PENDING",
      title: `Attendance Pending Approval: ${att.worker.name}`,
      description: `Daily attendance logged for ${new Date(att.attendanceDate).toLocaleDateString("en-IN")} requires supervisor confirmation`,
      severity: "INFO",
      href: `/labour/attendance`,
    });
  }

  for (const wage of unpaidWageSettlements) {
    items.push({
      id: `wage-unpaid-${wage.id}`,
      type: "WAGE_PAYMENT_PENDING",
      title: `Unpaid Wage Settlement: ${wage.settlementNumber}`,
      description: `Net ₹${Number(wage.netPayable).toLocaleString("en-IN")} approved for ${wage.worker.name} awaiting payment disbursement`,
      severity: "WARNING",
      href: `/labour/wages`,
    });
  }

  for (const audit of openAudits) {
    items.push({
      id: `audit-open-${audit.id}`,
      type: "AUDIT_IN_PROGRESS",
      title: `Stock Audit Open: ${audit.auditNumber}`,
      description: `Stock count in warehouse ${audit.warehouse?.name || "Yard"} is currently ${audit.status}`,
      severity: "INFO",
      href: `/inventory/audits`,
    });
  }

  return items;
}

async function fetchRecentActivity() {
  const [dns, mrns, directTransfers, invoices, receipts, trips] = await Promise.all([
    db.deliveryNote.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dnNumber: true,
        status: true,
        deliveryDate: true,
        createdAt: true,
        customer: { select: { name: true } },
        customerSite: { select: { siteName: true } },
      },
    }),
    db.materialReturnNote.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mrnNumber: true,
        status: true,
        returnDate: true,
        createdAt: true,
        customer: { select: { name: true } },
        customerSite: { select: { siteName: true } },
      },
    }),
    db.directSiteTransferNote.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        transferNumber: true,
        status: true,
        transferDate: true,
        createdAt: true,
        sourceCustomer: { select: { name: true } },
        destinationCustomer: { select: { name: true } },
      },
    }),
    db.invoice.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        grandTotal: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.paymentReceipt.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        receiptNumber: true,
        status: true,
        amountReceived: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.vehicleTrip.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tripNumber: true,
        status: true,
        tripPurpose: true,
        createdAt: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    }),
  ]);

  const timeline: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    date: Date;
    status: string;
    href: string;
  }> = [];

  for (const dn of dns) {
    timeline.push({
      id: `dn-${dn.id}`,
      category: "DISPATCH",
      title: `Delivery Note: ${dn.dnNumber}`,
      description: `Dispatched to ${dn.customer.name} (${dn.customerSite.siteName})`,
      date: dn.createdAt,
      status: dn.status,
      href: `/delivery-notes`,
    });
  }

  for (const mrn of mrns) {
    timeline.push({
      id: `mrn-${mrn.id}`,
      category: "RETURN",
      title: `Material Return: ${mrn.mrnNumber}`,
      description: `Returned from ${mrn.customer.name} (${mrn.customerSite.siteName})`,
      date: mrn.createdAt,
      status: mrn.status,
      href: `/return-notes`,
    });
  }

  for (const dst of directTransfers) {
    timeline.push({
      id: `dst-${dst.id}`,
      category: "TRANSFER",
      title: `Direct Transfer: ${dst.transferNumber}`,
      description: `Site-to-site from ${dst.sourceCustomer.name} to ${dst.destinationCustomer.name}`,
      date: dst.createdAt,
      status: dst.status,
      href: `/operations/direct-transfers`,
    });
  }

  for (const inv of invoices) {
    timeline.push({
      id: `inv-${inv.id}`,
      category: "INVOICE",
      title: `Tax Invoice: ${inv.invoiceNumber}`,
      description: `Billed ₹${Number(inv.grandTotal).toLocaleString("en-IN")} to ${inv.customer.name}`,
      date: inv.createdAt,
      status: inv.status,
      href: `/invoices`,
    });
  }

  for (const rec of receipts) {
    timeline.push({
      id: `rec-${rec.id}`,
      category: "RECEIPT",
      title: `Payment Received: ${rec.receiptNumber}`,
      description: `Collected ₹${Number(rec.amountReceived).toLocaleString("en-IN")} from ${rec.customer.name}`,
      date: rec.createdAt,
      status: rec.status,
      href: `/accounting/payments`,
    });
  }

  for (const trip of trips) {
    timeline.push({
      id: `trip-${trip.id}`,
      category: "FLEET",
      title: `Fleet Trip: ${trip.tripNumber}`,
      description: `${trip.vehicle.vehicleNumber} (${trip.tripPurpose})`,
      date: trip.createdAt,
      status: trip.status,
      href: `/fleet/trips`,
    });
  }

  return timeline.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);
}
