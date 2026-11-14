import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCustomerAgeing,
  getSupplierAgeing,
  getGstr1Summary,
  getGstr3bSummary,
} from "@/lib/accounting/reports";
import { getCurrentFiscalYear } from "@/lib/document-series";
import { getAllCashAndBankLedger } from "@/lib/accounting/account-mapping";

export interface FinancialReportFilters {
  reportType?: string;
  asOfDate?: string | Date;
  startDate?: string | Date;
  endDate?: string | Date;
  fiscalYear?: string;
  accountId?: string;
  branchId?: string;
}

export async function getFinancialReportsData(filters?: FinancialReportFilters) {
  const now = new Date();
  const targetDate = filters?.asOfDate ? new Date(filters.asOfDate) : now;
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 3, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;
  const fy = filters?.fiscalYear || getCurrentFiscalYear(targetDate);

  const [
    trialBalance,
    profitAndLoss,
    balanceSheet,
    customerAgeing,
    supplierAgeing,
    gstr1Summary,
    gstr3bSummary,
    cashAndBankSummary,
    creditDebitNotes,
    receiptsRegister,
    paymentsRegister,
    expenseBreakdown,
  ] = await Promise.all([
    getTrialBalance(targetDate, fy),
    getProfitAndLoss(start, end),
    getBalanceSheet(targetDate),
    getCustomerAgeing(targetDate),
    getSupplierAgeing(targetDate),
    getGstr1Summary(start, end),
    getGstr3bSummary(start, end),
    getCashAndBankSummary(targetDate),
    getCreditDebitNotesRegister(start, end),
    getCustomerReceiptsRegister(start, end),
    getSupplierPaymentsRegister(start, end),
    getExpenseAnalysis(start, end),
  ]);

  const trialBalanced = trialBalance.isBalanced;
  const balanceSheetBalanced = balanceSheet.isBalanced;

  return {
    period: {
      asOfDate: targetDate,
      startDate: start,
      endDate: end,
      fiscalYear: fy,
    },
    integrity: {
      trialBalanced,
      trialDebitSum: trialBalance.totalDebitSum,
      trialCreditSum: trialBalance.totalCreditSum,
      trialDifference: trialBalance.difference,
      balanceSheetBalanced,
      totalAssets: balanceSheet.totalAssets,
      totalLiabilitiesAndEquity: balanceSheet.totalLiabilitiesAndEquity,
      balanceSheetDifference: balanceSheet.difference,
    },
    trialBalance,
    profitAndLoss,
    balanceSheet,
    customerAgeing,
    supplierAgeing,
    gstr1Summary,
    gstr3bSummary,
    gstSummary: {
      totalOutwardTax: gstr1Summary.netTotalTax,
      totalInwardItc: gstr3bSummary.eligibleItc.cgstAmount.plus(gstr3bSummary.eligibleItc.sgstAmount).plus(gstr3bSummary.eligibleItc.igstAmount),
      netTaxPayable: gstr3bSummary.netPayable.total,
    },
    cashAndBankSummary,
    creditDebitNotes,
    receiptsRegister,
    paymentsRegister,
    expenseBreakdown,
  };
}

async function getCashAndBankSummary(asOfDate: Date) {
  const ledger = await getAllCashAndBankLedger(asOfDate);
  return ledger.accounts;
}

async function getCreditDebitNotesRegister(start: Date, end: Date) {
  const notes = await db.creditDebitNote.findMany({
    where: {
      status: "POSTED",
      noteDate: { gte: start, lte: end },
    },
    include: {
      customer: { select: { name: true, customerCode: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    take: 30,
    orderBy: { noteDate: "desc" },
  });

  return notes.map((n) => ({
    id: n.id,
    noteNumber: n.noteNumber,
    noteType: n.noteType,
    noteDate: n.noteDate,
    customerName: n.customer.name,
    originalInvoice: n.invoice?.invoiceNumber || "N/A",
    reason: n.reason,
    totalTaxableAmount: n.taxableAmount,
    grandTotal: n.totalAmount,
  }));
}

async function getCustomerReceiptsRegister(start: Date, end: Date) {
  const receipts = await db.paymentReceipt.findMany({
    where: {
      status: "POSTED",
      paymentDate: { gte: start, lte: end },
    },
    include: {
      customer: { select: { name: true, customerCode: true } },
      depositAccount: { select: { accountCode: true, accountName: true } },
    },
    take: 30,
    orderBy: { paymentDate: "desc" },
  });

  return receipts.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    receiptDate: r.paymentDate,
    customerName: r.customer.name,
    amount: r.amountReceived,
    paymentMode: r.paymentMethod,
    referenceNumber: r.transactionReference,
    depositedTo: `${r.depositAccount.accountCode} - ${r.depositAccount.accountName}`,
  }));
}

async function getSupplierPaymentsRegister(start: Date, end: Date) {
  const payments = await db.supplierPayment.findMany({
    where: {
      status: "POSTED",
      paymentDate: { gte: start, lte: end },
    },
    include: {
      supplier: { select: { name: true, supplierCode: true } },
      disbursingAccount: { select: { accountCode: true, accountName: true } },
    },
    take: 30,
    orderBy: { paymentDate: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    paymentDate: p.paymentDate,
    supplierName: p.supplier.name,
    amount: p.amountPaid,
    paymentMode: p.paymentMethod,
    referenceNumber: p.transactionReference,
    paidFrom: `${p.disbursingAccount.accountCode} - ${p.disbursingAccount.accountName}`,
  }));
}

async function getExpenseAnalysis(start: Date, end: Date) {
  const lines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        postingDate: { gte: start, lte: end },
      },
      account: {
        accountCategory: "EXPENSE",
      },
    },
    include: {
      account: { select: { id: true, accountCode: true, accountName: true } },
    },
  });

  const map: Record<string, { accountId: string; accountCode: string; accountName: string; totalExpense: Prisma.Decimal }> = {};

  for (const l of lines) {
    const acc = l.account;
    if (!map[acc.id]) {
      map[acc.id] = {
        accountId: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        totalExpense: new Prisma.Decimal(0),
      };
    }
    const net = new Prisma.Decimal(l.debitAmount).minus(new Prisma.Decimal(l.creditAmount));
    map[acc.id].totalExpense = map[acc.id].totalExpense.plus(net);
  }

  return Object.values(map).sort((a, b) => b.totalExpense.minus(a.totalExpense).toNumber());
}
