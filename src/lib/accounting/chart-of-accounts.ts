import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ==============================================================================
// INVENTRA: CHART OF ACCOUNTS MASTER DEFINITION & SYSTEM SEEDER
// Operating Business: AJAY ENTERPRISES | Domain: Construction Centering ERP
// ==============================================================================

export interface DefaultAccountSpec {
  accountCode: string;
  accountName: string;
  accountCategory: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  accountSubcategory: string;
  openingBalanceType: "DEBIT" | "CREDIT";
  isControlAccount: boolean;
  isSystemProtected: boolean;
  notes?: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountSpec[] = [
  // ----------------------------------------------------------------------------
  // 1. ASSETS (1000 - 1999)
  // ----------------------------------------------------------------------------
  {
    accountCode: "1010",
    accountName: "Cash in Hand",
    accountCategory: "ASSET",
    accountSubcategory: "CASH_IN_HAND",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Main cash box for yard operations and petty cash",
  },
  {
    accountCode: "1020",
    accountName: "HDFC Current Account (Main)",
    accountCategory: "ASSET",
    accountSubcategory: "BANK_ACCOUNT",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Primary business operating bank account",
  },
  {
    accountCode: "1025",
    accountName: "UPI & Digital Clearing Account",
    accountCategory: "ASSET",
    accountSubcategory: "UPI_CLEARING",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Clearing account for UPI and online collections",
  },
  {
    accountCode: "1030",
    accountName: "Accounts Receivable (Debtors Control)",
    accountCategory: "ASSET",
    accountSubcategory: "ACCOUNTS_RECEIVABLE",
    openingBalanceType: "DEBIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Control account for all customer site receivables and rental billings",
  },
  {
    accountCode: "1041",
    accountName: "GST Input Tax Credit - CGST",
    accountCategory: "ASSET",
    accountSubcategory: "GST_INPUT_TAX_CREDIT",
    openingBalanceType: "DEBIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Central GST input tax credit on purchases and expenses",
  },
  {
    accountCode: "1042",
    accountName: "GST Input Tax Credit - SGST",
    accountCategory: "ASSET",
    accountSubcategory: "GST_INPUT_TAX_CREDIT",
    openingBalanceType: "DEBIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "State GST input tax credit on purchases and expenses",
  },
  {
    accountCode: "1043",
    accountName: "GST Input Tax Credit - IGST",
    accountCategory: "ASSET",
    accountSubcategory: "GST_INPUT_TAX_CREDIT",
    openingBalanceType: "DEBIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Integrated GST input tax credit on inter-state purchases",
  },
  {
    accountCode: "1050",
    accountName: "Supplier Advances",
    accountCategory: "ASSET",
    accountSubcategory: "SUPPLIER_ADVANCES",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Pre-payments and advances disbursed to suppliers",
  },
  {
    accountCode: "1060",
    accountName: "Employee & Labour Advances",
    accountCategory: "ASSET",
    accountSubcategory: "EMPLOYEE_ADVANCES",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Short-term recoverable advances issued to yard workers and labour staff",
  },
  {
    accountCode: "1200",
    accountName: "Centering & Formwork Equipment (Capital Asset)",
    accountCategory: "ASSET",
    accountSubcategory: "DEPRECIATION",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Gross capital asset value of owned steel props, sheets, and column boxes",
  },

  // ----------------------------------------------------------------------------
  // 2. LIABILITIES (2000 - 2999)
  // ----------------------------------------------------------------------------
  {
    accountCode: "2010",
    accountName: "Accounts Payable (Creditors Control)",
    accountCategory: "LIABILITY",
    accountSubcategory: "ACCOUNTS_PAYABLE",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Control account for all vendor, supplier, and contractor payables",
  },
  {
    accountCode: "2020",
    accountName: "Customer Advance Receipts",
    accountCategory: "LIABILITY",
    accountSubcategory: "CUSTOMER_ADVANCES",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Advance funds received from customers prior to invoice generation",
  },
  {
    accountCode: "2030",
    accountName: "Customer Security Deposits (Refundable)",
    accountCategory: "LIABILITY",
    accountSubcategory: "SECURITY_DEPOSIT_LIABILITY",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Security deposits held against rental equipment agreements",
  },
  {
    accountCode: "2041",
    accountName: "GST Output Tax Liability - CGST",
    accountCategory: "LIABILITY",
    accountSubcategory: "GST_OUTPUT_LIABILITY",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Central GST collected on rental, sales, and service invoices",
  },
  {
    accountCode: "2042",
    accountName: "GST Output Tax Liability - SGST",
    accountCategory: "LIABILITY",
    accountSubcategory: "GST_OUTPUT_LIABILITY",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "State GST collected on rental, sales, and service invoices",
  },
  {
    accountCode: "2043",
    accountName: "GST Output Tax Liability - IGST",
    accountCategory: "LIABILITY",
    accountSubcategory: "GST_OUTPUT_LIABILITY",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Integrated GST collected on inter-state outward supplies",
  },
  {
    accountCode: "2050",
    accountName: "TDS Payable",
    accountCategory: "LIABILITY",
    accountSubcategory: "TDS_PAYABLE",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Tax deducted at source on supplier and contractor payments",
  },
  {
    accountCode: "2060",
    accountName: "Wages & Labour Payable",
    accountCategory: "LIABILITY",
    accountSubcategory: "WAGES_PAYABLE",
    openingBalanceType: "CREDIT",
    isControlAccount: true,
    isSystemProtected: true,
    notes: "Accrued payroll and net wages liability pending disbursement to workers",
  },

  // ----------------------------------------------------------------------------
  // 3. EQUITY (3000 - 3999)
  // ----------------------------------------------------------------------------
  {
    accountCode: "3010",
    accountName: "Owner Capital - Ajay Enterprises",
    accountCategory: "EQUITY",
    accountSubcategory: "OTHER_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Owner equity investment in the business",
  },
  {
    accountCode: "3020",
    accountName: "Retained Earnings / Accumulated Profit",
    accountCategory: "EQUITY",
    accountSubcategory: "OTHER_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Accumulated net profit/loss carried forward across financial years",
  },

  // ----------------------------------------------------------------------------
  // 4. INCOME (4000 - 4999)
  // ----------------------------------------------------------------------------
  {
    accountCode: "4010",
    accountName: "Rental Income - Centering & Formwork",
    accountCategory: "INCOME",
    accountSubcategory: "RENTAL_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Core monthly equipment hire revenue from construction sites (SAC 9973)",
  },
  {
    accountCode: "4020",
    accountName: "Material Sales Revenue",
    accountCategory: "INCOME",
    accountSubcategory: "SALES_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Direct sale of centering materials and steel accessories",
  },
  {
    accountCode: "4030",
    accountName: "Damage & Scrap Recovery Charges",
    accountCategory: "INCOME",
    accountSubcategory: "OTHER_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Billed damage assessments and scrap compensation from customers",
  },
  {
    accountCode: "4040",
    accountName: "Missing Material Replacement Recovery",
    accountCategory: "INCOME",
    accountSubcategory: "OTHER_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Replacement value recoveries for unreturned and lost materials",
  },
  {
    accountCode: "4050",
    accountName: "Transportation & Freight Service Charges",
    accountCategory: "INCOME",
    accountSubcategory: "SERVICE_INCOME",
    openingBalanceType: "CREDIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Delivery and return haulage charged to customer accounts",
  },

  // ----------------------------------------------------------------------------
  // 5. EXPENSES (5000 - 5999)
  // ----------------------------------------------------------------------------
  {
    accountCode: "5010",
    accountName: "Material Repair, Welding & Maintenance",
    accountCategory: "EXPENSE",
    accountSubcategory: "MATERIAL_REPAIR",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Centering equipment repair, props straightening, welding, and reconditioning",
  },
  {
    accountCode: "5020",
    accountName: "Yard & Storage Rent",
    accountCategory: "EXPENSE",
    accountSubcategory: "OFFICE_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Lease rental for storage yards, warehouses, and branch facilities",
  },
  {
    accountCode: "5030",
    accountName: "Transport & Vehicle Fuel Costs",
    accountCategory: "EXPENSE",
    accountSubcategory: "VEHICLE_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Diesel, tolls, road tax, and logistics transport running costs",
  },
  {
    accountCode: "5035",
    accountName: "Vehicle Servicing & Maintenance",
    accountCategory: "EXPENSE",
    accountSubcategory: "VEHICLE_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Workshop repairs, tyre replacement, and periodic servicing for company fleet",
  },
  {
    accountCode: "5040",
    accountName: "Yard Labour & Loading Wages",
    accountCategory: "EXPENSE",
    accountSubcategory: "LABOUR_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Direct labour wages, daily earnings, and overtime compensation",
  },
  {
    accountCode: "5050",
    accountName: "Material & Equipment Purchases",
    accountCategory: "EXPENSE",
    accountSubcategory: "PURCHASE_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: true,
    notes: "Direct raw material and formwork stock procurement",
  },
  {
    accountCode: "5060",
    accountName: "Office & Administrative Expenses",
    accountCategory: "EXPENSE",
    accountSubcategory: "OFFICE_EXPENSE",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Electricity, internet, printing, and general overheads",
  },
  {
    accountCode: "5070",
    accountName: "Bad Debts & Unrecoverable Dues",
    accountCategory: "EXPENSE",
    accountSubcategory: "BAD_DEBTS",
    openingBalanceType: "DEBIT",
    isControlAccount: false,
    isSystemProtected: false,
    notes: "Authorized write-offs of uncollectible customer balances",
  },
];

/**
 * Seeds or synchronizes the default Chart of Accounts idempotently.
 */
export async function seedDefaultChartOfAccounts(tx?: Prisma.TransactionClient) {
  const runner = tx || db;
  const created: string[] = [];

  for (const item of DEFAULT_CHART_OF_ACCOUNTS) {
    const existing = await runner.chartOfAccount.findUnique({
      where: { accountCode: item.accountCode },
    });

    if (!existing) {
      await runner.chartOfAccount.create({
        data: {
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountCategory: item.accountCategory,
          accountSubcategory: item.accountSubcategory,
          openingBalanceType: item.openingBalanceType,
          openingBalance: new Prisma.Decimal(0),
          currentBalance: new Prisma.Decimal(0),
          isControlAccount: item.isControlAccount,
          isSystemProtected: item.isSystemProtected,
          notes: item.notes,
        },
      });
      created.push(item.accountCode);
    } else if (
      existing.accountName !== item.accountName ||
      existing.accountSubcategory !== item.accountSubcategory
    ) {
      await runner.chartOfAccount.update({
        where: { id: existing.id },
        data: {
          accountName: item.accountName,
          accountSubcategory: item.accountSubcategory,
          accountCategory: item.accountCategory,
          notes: item.notes,
        },
      });
    }
  }

  return { seededCount: created.length, createdCodes: created };
}

/**
 * Finds a system control account by code or subcategory.
 */
export async function getSystemAccount(code: string, tx?: Prisma.TransactionClient) {
  const runner = tx || db;
  const acc = await runner.chartOfAccount.findUnique({
    where: { accountCode: code },
  });
  if (!acc) {
    // If missing, seed immediately
    await seedDefaultChartOfAccounts(tx);
    return await runner.chartOfAccount.findUnique({
      where: { accountCode: code },
    });
  }
  return acc;
}

