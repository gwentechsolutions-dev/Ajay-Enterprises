import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentFiscalYear } from "@/lib/document-series";

// ==============================================================================
// INVENTRA: FINANCIAL REPORTING & STATUTORY GST ENGINE
// Operating Business: AJAY ENTERPRISES | Base State: Tamil Nadu (33)
// ==============================================================================

/**
 * 1. Trial Balance Report
 * Reconciles closing debit and credit balances for all Chart of Accounts.
 */
export async function getTrialBalance(asOfDate?: Date | string, fiscalYear?: string) {
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();
  const fy = fiscalYear || getCurrentFiscalYear(targetDate);

  const accounts = await db.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { accountCode: "asc" },
  });

  const lines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        postingDate: { lte: targetDate },
        fiscalYear: fy,
      },
    },
  });

  let totalDebitSum = new Prisma.Decimal(0);
  let totalCreditSum = new Prisma.Decimal(0);

  const reportItems = accounts.map((acc) => {
    const accLines = lines.filter((l) => l.accountId === acc.id);
    const lineDebits = accLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)), new Prisma.Decimal(0));
    const lineCredits = accLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.creditAmount)), new Prisma.Decimal(0));

    // Calculate closing balance
    let closingDebit = new Prisma.Decimal(0);
    let closingCredit = new Prisma.Decimal(0);

    if (acc.accountCategory === "ASSET" || acc.accountCategory === "EXPENSE") {
      const net = lineDebits.minus(lineCredits);
      if (net.gte(0)) {
        closingDebit = net;
      } else {
        closingCredit = net.abs();
      }
    } else {
      const net = lineCredits.minus(lineDebits);
      if (net.gte(0)) {
        closingCredit = net;
      } else {
        closingDebit = net.abs();
      }
    }

    totalDebitSum = totalDebitSum.plus(closingDebit);
    totalCreditSum = totalCreditSum.plus(closingCredit);

    return {
      accountId: acc.id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountCategory: acc.accountCategory,
      totalDebits: lineDebits,
      totalCredits: lineCredits,
      closingDebit,
      closingCredit,
    };
  });

  const difference = totalDebitSum.minus(totalCreditSum).abs();
  const isBalanced = difference.lte(new Prisma.Decimal("0.05"));

  return {
    asOfDate: targetDate,
    fiscalYear: fy,
    items: reportItems,
    totalDebitSum,
    totalCreditSum,
    difference,
    isBalanced,
  };
}

/**
 * 2. Profit & Loss Statement (Income Statement)
 */
export async function getProfitAndLoss(startDate?: Date | string, endDate?: Date | string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 3, 1); // 1st April
  const end = endDate ? new Date(endDate) : new Date();

  const lines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        postingDate: { gte: start, lte: end },
      },
      account: {
        accountCategory: { in: ["INCOME", "EXPENSE"] },
      },
    },
    include: {
      account: true,
    },
  });

  const incomeMap: Record<string, { code: string; name: string; amount: Prisma.Decimal }> = {};
  const expenseMap: Record<string, { code: string; name: string; amount: Prisma.Decimal }> = {};

  let totalIncome = new Prisma.Decimal(0);
  let totalExpenses = new Prisma.Decimal(0);

  for (const l of lines) {
    const acc = l.account;
    if (acc.accountCategory === "INCOME") {
      // Income increases on Credit
      const net = new Prisma.Decimal(l.creditAmount).minus(new Prisma.Decimal(l.debitAmount));
      if (!incomeMap[acc.id]) {
        incomeMap[acc.id] = { code: acc.accountCode, name: acc.accountName, amount: new Prisma.Decimal(0) };
      }
      incomeMap[acc.id].amount = incomeMap[acc.id].amount.plus(net);
      totalIncome = totalIncome.plus(net);
    } else if (acc.accountCategory === "EXPENSE") {
      // Expense increases on Debit
      const net = new Prisma.Decimal(l.debitAmount).minus(new Prisma.Decimal(l.creditAmount));
      if (!expenseMap[acc.id]) {
        expenseMap[acc.id] = { code: acc.accountCode, name: acc.accountName, amount: new Prisma.Decimal(0) };
      }
      expenseMap[acc.id].amount = expenseMap[acc.id].amount.plus(net);
      totalExpenses = totalExpenses.plus(net);
    }
  }

  const netProfitOrLoss = totalIncome.minus(totalExpenses);

  return {
    periodStart: start,
    periodEnd: end,
    incomeAccounts: Object.values(incomeMap),
    expenseAccounts: Object.values(expenseMap),
    totalIncome,
    totalExpenses,
    netProfitOrLoss,
    isProfit: netProfitOrLoss.gte(0),
  };
}

/**
 * 3. Balance Sheet
 * Assets = Liabilities + Equity (including current period Net Profit)
 */
export async function getBalanceSheet(asOfDate?: Date | string) {
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();
  const trial = await getTrialBalance(targetDate);
  const pnl = await getProfitAndLoss(undefined, targetDate);

  const assetItems = trial.items.filter((i) => i.accountCategory === "ASSET");
  const liabilityItems = trial.items.filter((i) => i.accountCategory === "LIABILITY");
  const equityItems = trial.items.filter((i) => i.accountCategory === "EQUITY");

  const totalAssets = assetItems.reduce((acc, i) => acc.plus(i.closingDebit).minus(i.closingCredit), new Prisma.Decimal(0));
  const totalLiabilities = liabilityItems.reduce((acc, i) => acc.plus(i.closingCredit).minus(i.closingDebit), new Prisma.Decimal(0));
  const baseEquity = equityItems.reduce((acc, i) => acc.plus(i.closingCredit).minus(i.closingDebit), new Prisma.Decimal(0));

  const totalEquity = baseEquity.plus(pnl.netProfitOrLoss);
  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const difference = totalAssets.minus(totalLiabilitiesAndEquity).abs();
  const isBalanced = difference.lte(new Prisma.Decimal("0.05"));

  return {
    asOfDate: targetDate,
    assets: assetItems,
    liabilities: liabilityItems,
    equity: equityItems,
    currentPeriodProfit: pnl.netProfitOrLoss,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
    difference,
  };
}

/**
 * 4. Customer Outstanding Ageing (0-30, 31-60, 61-90, 90+ days)
 */
export async function getCustomerAgeing(asOfDate?: Date | string) {
  const now = asOfDate ? new Date(asOfDate) : new Date();

  const unpaidInvoices = await db.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "POSTED"] },
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      outstandingAmount: { gt: 0 },
    },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, primaryMobile: true } },
      customerSite: { select: { id: true, siteName: true, siteCode: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const customerMap: Record<string, any> = {};

  for (const inv of unpaidInvoices) {
    const custId = inv.customerId;
    if (!customerMap[custId]) {
      customerMap[custId] = {
        customerId: custId,
        customerName: inv.customer.name,
        customerCode: inv.customer.customerCode,
        mobile: inv.customer.primaryMobile,
        totalOutstanding: new Prisma.Decimal(0),
        bucket0_30: new Prisma.Decimal(0),
        bucket31_60: new Prisma.Decimal(0),
        bucket61_90: new Prisma.Decimal(0),
        bucket90Plus: new Prisma.Decimal(0),
        invoices: [],
      };
    }

    const due = new Date(inv.dueDate);
    const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const out = new Prisma.Decimal(inv.outstandingAmount);

    customerMap[custId].totalOutstanding = customerMap[custId].totalOutstanding.plus(out);

    if (diffDays <= 30) {
      customerMap[custId].bucket0_30 = customerMap[custId].bucket0_30.plus(out);
    } else if (diffDays <= 60) {
      customerMap[custId].bucket31_60 = customerMap[custId].bucket31_60.plus(out);
    } else if (diffDays <= 90) {
      customerMap[custId].bucket61_90 = customerMap[custId].bucket61_90.plus(out);
    } else {
      customerMap[custId].bucket90Plus = customerMap[custId].bucket90Plus.plus(out);
    }

    customerMap[custId].invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      grandTotal: inv.grandTotal,
      outstandingAmount: inv.outstandingAmount,
      daysOverdue: Math.max(0, diffDays),
    });
  }

  return Object.values(customerMap);
}

/**
 * 5. Supplier Outstanding Ageing
 */
export async function getSupplierAgeing(asOfDate?: Date | string) {
  const now = asOfDate ? new Date(asOfDate) : new Date();

  const unpaidBills = await db.purchaseBill.findMany({
    where: {
      status: { in: ["APPROVED", "POSTED"] },
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      outstandingAmount: { gt: 0 },
    },
    include: {
      supplier: { select: { id: true, name: true, supplierCode: true, primaryMobile: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const supplierMap: Record<string, any> = {};

  for (const bill of unpaidBills) {
    const supId = bill.supplierId;
    if (!supplierMap[supId]) {
      supplierMap[supId] = {
        supplierId: supId,
        supplierName: bill.supplier.name,
        supplierCode: bill.supplier.supplierCode,
        mobile: bill.supplier.primaryMobile,
        totalOutstanding: new Prisma.Decimal(0),
        bucket0_30: new Prisma.Decimal(0),
        bucket31_60: new Prisma.Decimal(0),
        bucket61_90: new Prisma.Decimal(0),
        bucket90Plus: new Prisma.Decimal(0),
        bills: [],
      };
    }

    const due = new Date(bill.dueDate);
    const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const out = new Prisma.Decimal(bill.outstandingAmount);

    supplierMap[supId].totalOutstanding = supplierMap[supId].totalOutstanding.plus(out);

    if (diffDays <= 30) {
      supplierMap[supId].bucket0_30 = supplierMap[supId].bucket0_30.plus(out);
    } else if (diffDays <= 60) {
      supplierMap[supId].bucket31_60 = supplierMap[supId].bucket31_60.plus(out);
    } else if (diffDays <= 90) {
      supplierMap[supId].bucket61_90 = supplierMap[supId].bucket61_90.plus(out);
    } else {
      supplierMap[supId].bucket90Plus = supplierMap[supId].bucket90Plus.plus(out);
    }

    supplierMap[supId].bills.push({
      id: bill.id,
      billNumber: bill.billNumber,
      supplierInvoiceNumber: bill.supplierInvoiceNumber,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      grandTotal: bill.grandTotal,
      outstandingAmount: bill.outstandingAmount,
      daysOverdue: Math.max(0, diffDays),
    });
  }

  return Object.values(supplierMap);
}

/**
 * 6. GSTR-1 Outward Supply Summary (Tax liability on sales & rentals)
 */
export async function getGstr1Summary(startDate?: Date | string, endDate?: Date | string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "POSTED"] },
      invoiceDate: { gte: start, lte: end },
    },
    include: {
      customer: true,
      items: true,
    },
    orderBy: { invoiceDate: "asc" },
  });

  const b2bInvoices: any[] = [];
  const b2cInvoices: any[] = [];
  const hsnSummaryMap: Record<string, any> = {};

  let totalTaxable = new Prisma.Decimal(0);
  let totalCgst = new Prisma.Decimal(0);
  let totalSgst = new Prisma.Decimal(0);
  let totalIgst = new Prisma.Decimal(0);
  let grandTotal = new Prisma.Decimal(0);

  for (const inv of invoices) {
    totalTaxable = totalTaxable.plus(inv.taxableAmount);
    totalCgst = totalCgst.plus(inv.cgstAmount);
    totalSgst = totalSgst.plus(inv.sgstAmount);
    totalIgst = totalIgst.plus(inv.igstAmount);
    grandTotal = grandTotal.plus(inv.grandTotal);

    const isB2B = !!inv.customerGstin && inv.customerGstin.trim().length === 15;

    if (isB2B) {
      b2bInvoices.push({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.name,
        customerGstin: inv.customerGstin,
        placeOfSupply: inv.placeOfSupply,
        isInterState: inv.isInterState,
        taxableValue: inv.taxableAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        invoiceTotal: inv.grandTotal,
      });
    } else {
      b2cInvoices.push({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.name,
        placeOfSupply: inv.placeOfSupply,
        taxableValue: inv.taxableAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        invoiceTotal: inv.grandTotal,
      });
    }

    for (const it of inv.items) {
      const code = it.hsnSacCode;
      if (!hsnSummaryMap[code]) {
        hsnSummaryMap[code] = {
          hsnSac: code,
          description: it.itemDescription,
          uom: it.uom,
          totalQty: new Prisma.Decimal(0),
          taxableValue: new Prisma.Decimal(0),
          cgstAmount: new Prisma.Decimal(0),
          sgstAmount: new Prisma.Decimal(0),
          igstAmount: new Prisma.Decimal(0),
          totalTax: new Prisma.Decimal(0),
        };
      }
      hsnSummaryMap[code].totalQty = hsnSummaryMap[code].totalQty.plus(it.quantity);
      hsnSummaryMap[code].taxableValue = hsnSummaryMap[code].taxableValue.plus(it.taxableValue);
      hsnSummaryMap[code].cgstAmount = hsnSummaryMap[code].cgstAmount.plus(it.cgstAmount);
      hsnSummaryMap[code].sgstAmount = hsnSummaryMap[code].sgstAmount.plus(it.sgstAmount);
      hsnSummaryMap[code].igstAmount = hsnSummaryMap[code].igstAmount.plus(it.igstAmount);
      hsnSummaryMap[code].totalTax = hsnSummaryMap[code].totalTax.plus(it.cgstAmount).plus(it.sgstAmount).plus(it.igstAmount);
    }
  }

  return {
    periodStart: start,
    periodEnd: end,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    grandTotal,
    b2bCount: b2bInvoices.length,
    b2cCount: b2cInvoices.length,
    b2bInvoices,
    b2cInvoices,
    hsnSummary: Object.values(hsnSummaryMap),
  };
}

/**
 * 7. GSTR-3B Summary (Net Outward Liability vs Inward ITC Available)
 */
export async function getGstr3bSummary(startDate?: Date | string, endDate?: Date | string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();

  // Outward Supplies (Invoices)
  const outward = await db.invoice.aggregate({
    where: {
      status: { in: ["ISSUED", "POSTED"] },
      invoiceDate: { gte: start, lte: end },
    },
    _sum: {
      taxableAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      grandTotal: true,
    },
  });

  // Inward Supplies & Eligible ITC (Purchase Bills)
  const inward = await db.purchaseBill.aggregate({
    where: {
      status: { in: ["APPROVED", "POSTED"] },
      billDate: { gte: start, lte: end },
      itcEligibility: { in: ["INPUT_GOODS", "INPUT_SERVICES", "CAPITAL_GOODS"] },
    },
    _sum: {
      taxableAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      grandTotal: true,
    },
  });

  const outCgst = outward._sum.cgstAmount || new Prisma.Decimal(0);
  const outSgst = outward._sum.sgstAmount || new Prisma.Decimal(0);
  const outIgst = outward._sum.igstAmount || new Prisma.Decimal(0);

  const inCgst = inward._sum.cgstAmount || new Prisma.Decimal(0);
  const inSgst = inward._sum.sgstAmount || new Prisma.Decimal(0);
  const inIgst = inward._sum.igstAmount || new Prisma.Decimal(0);

  // Net Tax Payable
  const netCgstPayable = outCgst.minus(inCgst);
  const netSgstPayable = outSgst.minus(inSgst);
  const netIgstPayable = outIgst.minus(inIgst);
  const totalNetPayable = netCgstPayable.plus(netSgstPayable).plus(netIgstPayable);

  return {
    periodStart: start,
    periodEnd: end,
    outwardSupplies: {
      taxableValue: outward._sum.taxableAmount || new Prisma.Decimal(0),
      cgstAmount: outCgst,
      sgstAmount: outSgst,
      igstAmount: outIgst,
      totalAmount: outward._sum.grandTotal || new Prisma.Decimal(0),
    },
    eligibleItc: {
      taxableValue: inward._sum.taxableAmount || new Prisma.Decimal(0),
      cgstAmount: inCgst,
      sgstAmount: inSgst,
      igstAmount: inIgst,
      totalAmount: inward._sum.grandTotal || new Prisma.Decimal(0),
    },
    netPayable: {
      cgst: netCgstPayable.lt(0) ? new Prisma.Decimal(0) : netCgstPayable,
      sgst: netSgstPayable.lt(0) ? new Prisma.Decimal(0) : netSgstPayable,
      igst: netIgstPayable.lt(0) ? new Prisma.Decimal(0) : netIgstPayable,
      total: totalNetPayable.lt(0) ? new Prisma.Decimal(0) : totalNetPayable,
    },
    itcCarriedForward: {
      cgst: netCgstPayable.lt(0) ? netCgstPayable.abs() : new Prisma.Decimal(0),
      sgst: netSgstPayable.lt(0) ? netSgstPayable.abs() : new Prisma.Decimal(0),
      igst: netIgstPayable.lt(0) ? netIgstPayable.abs() : new Prisma.Decimal(0),
    },
  };
}

