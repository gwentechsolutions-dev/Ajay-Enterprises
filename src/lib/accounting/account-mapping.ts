import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSystemAccount, seedDefaultChartOfAccounts } from "./chart-of-accounts";

// ==============================================================================
// INVENTRA: SHARED ACCOUNT-MAPPING & LEDGER RECONCILIATION SERVICE
// Operating Business: AJAY ENTERPRISES | Base Regime: Indian GST & Double-Entry
// ==============================================================================

export type SystemAccountRole =
  | "CASH_IN_HAND"
  | "BANK_MAIN"
  | "BANK_SECONDARY"
  | "UPI_CLEARING"
  | "ACCOUNTS_RECEIVABLE"
  | "SUPPLIER_ADVANCES"
  | "GST_INPUT_CGST"
  | "GST_INPUT_SGST"
  | "GST_INPUT_IGST"
  | "EMPLOYEE_ADVANCES"
  | "ACCOUNTS_PAYABLE"
  | "CUSTOMER_ADVANCES"
  | "GST_OUTPUT_CGST"
  | "GST_OUTPUT_SGST"
  | "GST_OUTPUT_IGST"
  | "TDS_PAYABLE"
  | "CUSTOMER_SECURITY_DEPOSITS"
  | "WAGES_PAYABLE"
  | "OWNER_CAPITAL"
  | "RETAINED_EARNINGS"
  | "RENTAL_INCOME"
  | "SALES_INCOME"
  | "TRANSPORT_INCOME"
  | "DAMAGE_RECOVERY"
  | "LOST_EQUIPMENT_RECOVERY"
  | "MATERIAL_MAINTENANCE_EXPENSE"
  | "YARD_RENT_EXPENSE"
  | "FLEET_FUEL_TRANSPORT_EXPENSE"
  | "FLEET_MAINTENANCE_EXPENSE"
  | "LABOUR_WAGES_EXPENSE"
  | "MATERIAL_PURCHASE_EXPENSE"
  | "OFFICE_EXPENSE"
  | "BAD_DEBTS_EXPENSE";

export interface AccountRoleConfig {
  role: SystemAccountRole;
  primaryCode: string;
  alternateCodes?: string[];
  expectedSubcategory: string;
  expectedCategory: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  label: string;
}

export const SYSTEM_ACCOUNT_REGISTRY: Record<SystemAccountRole, AccountRoleConfig> = {
  CASH_IN_HAND: {
    role: "CASH_IN_HAND",
    primaryCode: "1010",
    expectedSubcategory: "CASH_IN_HAND",
    expectedCategory: "ASSET",
    label: "Cash in Hand",
  },
  BANK_MAIN: {
    role: "BANK_MAIN",
    primaryCode: "1020",
    expectedSubcategory: "BANK_ACCOUNT",
    expectedCategory: "ASSET",
    label: "HDFC Current Account (Main)",
  },
  BANK_SECONDARY: {
    role: "BANK_SECONDARY",
    primaryCode: "1021",
    expectedSubcategory: "BANK_ACCOUNT",
    expectedCategory: "ASSET",
    label: "SBI Current Account",
  },
  UPI_CLEARING: {
    role: "UPI_CLEARING",
    primaryCode: "1025",
    expectedSubcategory: "UPI_CLEARING",
    expectedCategory: "ASSET",
    label: "UPI & Digital Clearing Account",
  },
  ACCOUNTS_RECEIVABLE: {
    role: "ACCOUNTS_RECEIVABLE",
    primaryCode: "1030",
    expectedSubcategory: "ACCOUNTS_RECEIVABLE",
    expectedCategory: "ASSET",
    label: "Accounts Receivable (Debtors Control)",
  },
  SUPPLIER_ADVANCES: {
    role: "SUPPLIER_ADVANCES",
    primaryCode: "1050",
    expectedSubcategory: "SUPPLIER_ADVANCES",
    expectedCategory: "ASSET",
    label: "Supplier Advances",
  },
  GST_INPUT_CGST: {
    role: "GST_INPUT_CGST",
    primaryCode: "1060",
    expectedSubcategory: "GST_INPUT_TAX_CREDIT",
    expectedCategory: "ASSET",
    label: "GST Input Tax Credit - CGST",
  },
  GST_INPUT_SGST: {
    role: "GST_INPUT_SGST",
    primaryCode: "1061",
    expectedSubcategory: "GST_INPUT_TAX_CREDIT",
    expectedCategory: "ASSET",
    label: "GST Input Tax Credit - SGST",
  },
  GST_INPUT_IGST: {
    role: "GST_INPUT_IGST",
    primaryCode: "1062",
    expectedSubcategory: "GST_INPUT_TAX_CREDIT",
    expectedCategory: "ASSET",
    label: "GST Input Tax Credit - IGST",
  },
  EMPLOYEE_ADVANCES: {
    role: "EMPLOYEE_ADVANCES",
    primaryCode: "1070",
    expectedSubcategory: "EMPLOYEE_ADVANCES",
    expectedCategory: "ASSET",
    label: "Employee & Labour Advances",
  },
  ACCOUNTS_PAYABLE: {
    role: "ACCOUNTS_PAYABLE",
    primaryCode: "2010",
    expectedSubcategory: "ACCOUNTS_PAYABLE",
    expectedCategory: "LIABILITY",
    label: "Accounts Payable (Creditors Control)",
  },
  CUSTOMER_ADVANCES: {
    role: "CUSTOMER_ADVANCES",
    primaryCode: "2020",
    expectedSubcategory: "CUSTOMER_ADVANCES",
    expectedCategory: "LIABILITY",
    label: "Customer Advance Receipts",
  },
  GST_OUTPUT_CGST: {
    role: "GST_OUTPUT_CGST",
    primaryCode: "2041",
    alternateCodes: ["2030"],
    expectedSubcategory: "GST_OUTPUT_LIABILITY",
    expectedCategory: "LIABILITY",
    label: "GST Output Tax Liability - CGST",
  },
  GST_OUTPUT_SGST: {
    role: "GST_OUTPUT_SGST",
    primaryCode: "2042",
    alternateCodes: ["2031"],
    expectedSubcategory: "GST_OUTPUT_LIABILITY",
    expectedCategory: "LIABILITY",
    label: "GST Output Tax Liability - SGST",
  },
  GST_OUTPUT_IGST: {
    role: "GST_OUTPUT_IGST",
    primaryCode: "2043",
    alternateCodes: ["2032"],
    expectedSubcategory: "GST_OUTPUT_LIABILITY",
    expectedCategory: "LIABILITY",
    label: "GST Output Tax Liability - IGST",
  },
  TDS_PAYABLE: {
    role: "TDS_PAYABLE",
    primaryCode: "2050",
    expectedSubcategory: "TDS_PAYABLE",
    expectedCategory: "LIABILITY",
    label: "TDS Payable",
  },
  CUSTOMER_SECURITY_DEPOSITS: {
    role: "CUSTOMER_SECURITY_DEPOSITS",
    primaryCode: "2060",
    expectedSubcategory: "SECURITY_DEPOSIT_LIABILITY",
    expectedCategory: "LIABILITY",
    label: "Customer Security Deposits (Refundable)",
  },
  WAGES_PAYABLE: {
    role: "WAGES_PAYABLE",
    primaryCode: "2070",
    expectedSubcategory: "WAGES_PAYABLE",
    expectedCategory: "LIABILITY",
    label: "Wages & Labour Payable",
  },
  OWNER_CAPITAL: {
    role: "OWNER_CAPITAL",
    primaryCode: "3010",
    expectedSubcategory: "OTHER_INCOME",
    expectedCategory: "EQUITY",
    label: "Owner Capital - Ajay Enterprises",
  },
  RETAINED_EARNINGS: {
    role: "RETAINED_EARNINGS",
    primaryCode: "3020",
    expectedSubcategory: "OTHER_INCOME",
    expectedCategory: "EQUITY",
    label: "Retained Earnings / Accumulated Profit",
  },
  RENTAL_INCOME: {
    role: "RENTAL_INCOME",
    primaryCode: "4010",
    expectedSubcategory: "RENTAL_INCOME",
    expectedCategory: "INCOME",
    label: "Rental Income - Centering & Formwork",
  },
  SALES_INCOME: {
    role: "SALES_INCOME",
    primaryCode: "4020",
    expectedSubcategory: "SALES_INCOME",
    expectedCategory: "INCOME",
    label: "Material Sales Revenue",
  },
  TRANSPORT_INCOME: {
    role: "TRANSPORT_INCOME",
    primaryCode: "4050",
    alternateCodes: ["4030"],
    expectedSubcategory: "SERVICE_INCOME",
    expectedCategory: "INCOME",
    label: "Transportation & Freight Service Charges",
  },
  DAMAGE_RECOVERY: {
    role: "DAMAGE_RECOVERY",
    primaryCode: "4030",
    alternateCodes: ["4040"],
    expectedSubcategory: "OTHER_INCOME",
    expectedCategory: "INCOME",
    label: "Damage & Scrap Recovery Charges",
  },
  LOST_EQUIPMENT_RECOVERY: {
    role: "LOST_EQUIPMENT_RECOVERY",
    primaryCode: "4040",
    alternateCodes: ["4050"],
    expectedSubcategory: "OTHER_INCOME",
    expectedCategory: "INCOME",
    label: "Missing Material Replacement Recovery",
  },
  MATERIAL_MAINTENANCE_EXPENSE: {
    role: "MATERIAL_MAINTENANCE_EXPENSE",
    primaryCode: "5010",
    expectedSubcategory: "MATERIAL_REPAIR",
    expectedCategory: "EXPENSE",
    label: "Material Repair, Welding & Maintenance",
  },
  YARD_RENT_EXPENSE: {
    role: "YARD_RENT_EXPENSE",
    primaryCode: "5020",
    expectedSubcategory: "OFFICE_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Yard & Storage Rent",
  },
  FLEET_FUEL_TRANSPORT_EXPENSE: {
    role: "FLEET_FUEL_TRANSPORT_EXPENSE",
    primaryCode: "5030",
    expectedSubcategory: "VEHICLE_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Transport & Vehicle Fuel Costs",
  },
  FLEET_MAINTENANCE_EXPENSE: {
    role: "FLEET_MAINTENANCE_EXPENSE",
    primaryCode: "5035",
    alternateCodes: ["5030"],
    expectedSubcategory: "VEHICLE_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Vehicle Servicing & Maintenance",
  },
  LABOUR_WAGES_EXPENSE: {
    role: "LABOUR_WAGES_EXPENSE",
    primaryCode: "5040",
    expectedSubcategory: "LABOUR_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Yard Labour & Loading Wages",
  },
  MATERIAL_PURCHASE_EXPENSE: {
    role: "MATERIAL_PURCHASE_EXPENSE",
    primaryCode: "5050",
    expectedSubcategory: "PURCHASE_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Material & Equipment Purchases",
  },
  OFFICE_EXPENSE: {
    role: "OFFICE_EXPENSE",
    primaryCode: "5060",
    expectedSubcategory: "OFFICE_EXPENSE",
    expectedCategory: "EXPENSE",
    label: "Office & Administrative Expenses",
  },
  BAD_DEBTS_EXPENSE: {
    role: "BAD_DEBTS_EXPENSE",
    primaryCode: "5070",
    expectedSubcategory: "BAD_DEBTS",
    expectedCategory: "EXPENSE",
    label: "Bad Debts & Unrecoverable Dues",
  },
};

/**
 * Resolves a ChartOfAccount record for a system role dynamically.
 * Prioritizes subcategory match and primaryCode, with fallback to alternateCodes.
 */
export async function resolveAccountByRole(
  role: SystemAccountRole,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;
  const config = SYSTEM_ACCOUNT_REGISTRY[role];
  if (!config) {
    throw new Error(`UNKNOWN_ACCOUNT_ROLE: No configuration defined for role '${role}'.`);
  }

  // 1. Try exact primary code
  let acc = await runner.chartOfAccount.findUnique({
    where: { accountCode: config.primaryCode },
  });

  if (acc && acc.isActive) {
    return acc;
  }

  // 2. Try expected subcategory match
  acc = await runner.chartOfAccount.findFirst({
    where: {
      accountSubcategory: config.expectedSubcategory,
      accountCategory: config.expectedCategory,
      isActive: true,
    },
  });

  if (acc) {
    return acc;
  }

  // 3. Try alternate codes if configured
  if (config.alternateCodes && config.alternateCodes.length > 0) {
    for (const altCode of config.alternateCodes) {
      acc = await runner.chartOfAccount.findUnique({
        where: { accountCode: altCode },
      });
      if (acc && acc.isActive) {
        return acc;
      }
    }
  }

  // 4. If missing, ensure seed has run
  await seedDefaultChartOfAccounts(runner);
  return await runner.chartOfAccount.findUnique({
    where: { accountCode: config.primaryCode },
  });
}

/**
 * Queries all cash and bank accounts from the General Ledger, with individual balances.
 */
export async function getAllCashAndBankLedger(
  asOfDate?: Date | string,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();

  // Find all ASSET accounts that are cash, bank, or UPI clearing
  const accounts = await runner.chartOfAccount.findMany({
    where: {
      isActive: true,
      accountCategory: "ASSET",
      OR: [
        { accountSubcategory: { in: ["CASH_IN_HAND", "BANK_ACCOUNT", "UPI_CLEARING"] } },
        { accountCode: { in: ["1010", "1020", "1021", "1025"] } },
      ],
    },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            status: "POSTED",
            postingDate: { lte: targetDate },
          },
        },
        select: {
          debitAmount: true,
          creditAmount: true,
        },
      },
    },
    orderBy: { accountCode: "asc" },
  });

  let totalCash = new Prisma.Decimal(0);
  let totalBank = new Prisma.Decimal(0);

  const individualAccounts = accounts.map((acc) => {
    const totalDebits = acc.journalLines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)),
      new Prisma.Decimal(0)
    );
    const totalCredits = acc.journalLines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.creditAmount)),
      new Prisma.Decimal(0)
    );
    const closingBalance = totalDebits.minus(totalCredits);

    const isCash = acc.accountSubcategory === "CASH_IN_HAND" || acc.accountCode === "1010";
    if (isCash) {
      totalCash = totalCash.plus(closingBalance);
    } else {
      totalBank = totalBank.plus(closingBalance);
    }

    return {
      accountId: acc.id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountSubcategory: acc.accountSubcategory,
      isCash,
      totalDebits,
      totalCredits,
      closingBalance,
    };
  });

  return {
    asOfDate: targetDate,
    accounts: individualAccounts,
    totalCashBalance: totalCash,
    totalBankBalance: totalBank,
    totalLiquidFunds: totalCash.plus(totalBank),
  };
}

/**
 * Calculates current posted balance for a specific system role.
 */
export async function getPostedAccountBalance(
  role: SystemAccountRole,
  asOfDate?: Date | string,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;
  const targetDate = asOfDate ? new Date(asOfDate) : new Date();
  const acc = await resolveAccountByRole(role, runner);
  if (!acc) return new Prisma.Decimal(0);

  const lines = await runner.journalEntryLine.findMany({
    where: {
      accountId: acc.id,
      journalEntry: {
        status: "POSTED",
        postingDate: { lte: targetDate },
      },
    },
    select: {
      debitAmount: true,
      creditAmount: true,
    },
  });

  const totalDebits = lines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)), new Prisma.Decimal(0));
  const totalCredits = lines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.creditAmount)), new Prisma.Decimal(0));

  if (acc.accountCategory === "ASSET" || acc.accountCategory === "EXPENSE") {
    return totalDebits.minus(totalCredits);
  }
  return totalCredits.minus(totalDebits);
}

/**
 * Returns reconciled liabilities for Customer Deposits (2060) and Customer Advances (2020).
 */
export async function getCustomerLiabilitiesReconciliation(
  asOfDate?: Date | string,
  tx?: Prisma.TransactionClient
) {
  const [securityDeposits, customerAdvances] = await Promise.all([
    getPostedAccountBalance("CUSTOMER_SECURITY_DEPOSITS", asOfDate, tx),
    getPostedAccountBalance("CUSTOMER_ADVANCES", asOfDate, tx),
  ]);

  return {
    customerSecurityDeposits: securityDeposits, // GL 2060
    unallocatedCustomerAdvances: customerAdvances, // GL 2020
    totalCustomerLiabilities: securityDeposits.plus(customerAdvances),
  };
}

/**
 * Returns operational expenses reconciled from General Ledger for a specific period.
 */
export async function getOperationalExpenseLedger(
  startDate: Date,
  endDate: Date,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;

  const [fuelAcc, vehicleMaintAcc, materialRepairAcc, labourWageAcc] = await Promise.all([
    resolveAccountByRole("FLEET_FUEL_TRANSPORT_EXPENSE", runner),
    resolveAccountByRole("FLEET_MAINTENANCE_EXPENSE", runner),
    resolveAccountByRole("MATERIAL_MAINTENANCE_EXPENSE", runner),
    resolveAccountByRole("LABOUR_WAGES_EXPENSE", runner),
  ]);

  const targetAccountIds = [
    fuelAcc?.id,
    vehicleMaintAcc?.id,
    materialRepairAcc?.id,
    labourWageAcc?.id,
  ].filter(Boolean) as string[];

  const lines = await runner.journalEntryLine.findMany({
    where: {
      accountId: { in: targetAccountIds },
      journalEntry: {
        status: "POSTED",
        postingDate: { gte: startDate, lte: endDate },
      },
    },
    select: {
      accountId: true,
      debitAmount: true,
      creditAmount: true,
    },
  });

  const sumForAccount = (accId?: string) => {
    if (!accId) return new Prisma.Decimal(0);
    return lines
      .filter((l) => l.accountId === accId)
      .reduce(
        (sum, l) => sum.plus(new Prisma.Decimal(l.debitAmount)).minus(new Prisma.Decimal(l.creditAmount)),
        new Prisma.Decimal(0)
      );
  };

  const fleetFuelExpense = sumForAccount(fuelAcc?.id);
  const fleetMaintenanceExpense = sumForAccount(vehicleMaintAcc?.id);
  const materialRepairExpense = sumForAccount(materialRepairAcc?.id);
  const labourWagesExpense = sumForAccount(labourWageAcc?.id);

  return {
    fleetFuelExpense, // GL 5030
    fleetMaintenanceExpense, // GL 5035
    totalFleetOperatingCost: fleetFuelExpense.plus(fleetMaintenanceExpense),
    materialRepairExpense, // GL 5010
    labourWagesExpense, // GL 5040
    totalCoreOperationsCost: fleetFuelExpense
      .plus(fleetMaintenanceExpense)
      .plus(materialRepairExpense)
      .plus(labourWagesExpense),
  };
}
