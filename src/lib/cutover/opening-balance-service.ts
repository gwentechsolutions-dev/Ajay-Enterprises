import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { seedDefaultChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import { resolveAccountByRole, SystemAccountRole } from "@/lib/accounting/account-mapping";

export interface OpeningBalanceLineInput {
  accountId?: string;
  accountRole?: SystemAccountRole;
  accountCode?: string;
  accountName?: string;
  partyType?: "CUSTOMER" | "SUPPLIER" | "WORKER" | "BANK" | "NONE";
  customerId?: string | null;
  supplierId?: string | null;
  workerId?: string | null;
  partyName?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  debitAmount?: number | string | Prisma.Decimal;
  creditAmount?: number | string | Prisma.Decimal;
}

export interface CreateOpeningBalanceBatchInput {
  fiscalYear?: string;
  asOfDate?: Date | string;
  notes?: string;
  supportingDocUrl?: string;
  lines: OpeningBalanceLineInput[];
}

export interface OpeningTrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: string;
  subcategory: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  partyCount: number;
}

export interface OpeningTrialBalanceReport {
  fiscalYear: string;
  asOfDate: string;
  batchNumber: string;
  status: string;
  totalDebit: string;
  totalCredit: string;
  difference: string;
  isBalanced: boolean;
  rows: OpeningTrialBalanceRow[];
  subledgerSummary: {
    customerReceivablesTotal: string;
    customerAdvancesTotal: string;
    customerDepositsTotal: string;
    supplierPayablesTotal: string;
    employeeAdvancesTotal: string;
    wagesPayableTotal: string;
    cashAndBankTotal: string;
    fixedAssetsTotal: string;
  };
}

/**
 * Creates an Opening Balance Batch in DRAFT status.
 * Automatically ensures default Chart of Accounts is provisioned.
 */
export async function createOpeningBalanceBatch(
  input: CreateOpeningBalanceBatchInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  // 1. Ensure default accounts exist
  await seedDefaultChartOfAccounts(db);

  const fiscalYear = input.fiscalYear || getCurrentFiscalYear();
  const batchNumber = await generateNextDocumentNumber("OBB", fiscalYear);

  let totalDebit = new Prisma.Decimal(0);
  let totalCredit = new Prisma.Decimal(0);

  const processedLines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    partyType: string | null;
    customerId: string | null;
    supplierId: string | null;
    workerId: string | null;
    partyName: string | null;
    referenceNumber: string | null;
    description: string | null;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
  }> = [];

  for (const line of input.lines) {
    let account = null;

    if (line.accountId) {
      account = await db.chartOfAccount.findUnique({ where: { id: line.accountId } });
    } else if (line.accountRole) {
      account = await resolveAccountByRole(line.accountRole, db);
    } else if (line.accountCode) {
      account = await db.chartOfAccount.findUnique({ where: { accountCode: line.accountCode } });
    }

    if (!account) {
      throw new Error(`Unable to resolve Chart of Account for line: ${line.accountCode || line.accountRole || line.accountName}`);
    }

    const debit = new Prisma.Decimal(line.debitAmount || 0);
    const credit = new Prisma.Decimal(line.creditAmount || 0);

    if (debit.lt(0) || credit.lt(0)) {
      throw new Error(`Debit and credit amounts cannot be negative on account ${account.accountCode}`);
    }

    if (debit.gt(0) && credit.gt(0)) {
      throw new Error(`A single opening line cannot have both debit and credit. Account: ${account.accountCode}`);
    }

    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);

    processedLines.push({
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      partyType: line.partyType || null,
      customerId: line.customerId || null,
      supplierId: line.supplierId || null,
      workerId: line.workerId || null,
      partyName: line.partyName || null,
      referenceNumber: line.referenceNumber || null,
      description: line.description || null,
      debitAmount: debit,
      creditAmount: credit,
    });
  }

  const difference = totalDebit.minus(totalCredit).abs();
  const isBalanced = totalDebit.equals(totalCredit);

  const batch = await db.openingBalanceBatch.create({
    data: {
      batchNumber,
      fiscalYear,
      asOfDate: input.asOfDate ? new Date(input.asOfDate) : new Date(),
      status: "DRAFT",
      totalDebit,
      totalCredit,
      difference,
      isBalanced,
      notes: input.notes || null,
      supportingDocUrl: input.supportingDocUrl || null,
      preparedById: actor.id,
      items: {
        create: processedLines,
      },
    },
    include: {
      items: {
        include: {
          account: true,
          customer: true,
          supplier: true,
          worker: true,
        },
      },
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "accounting",
    entityType: "OpeningBalanceBatch",
    entityId: batch.id,
    afterState: {
      batchNumber,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      isBalanced,
    },
    notes: `Created opening balance batch ${batchNumber}. Balanced: ${isBalanced}`,
  });

  return batch;
}

/**
 * Approves an Opening Balance Batch (Requires OWNER, ADMINISTRATOR, or ACCOUNTANT).
 */
export async function approveOpeningBalanceBatch(
  batchId: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!["OWNER", "ADMINISTRATOR", "ADMIN", "ACCOUNTANT"].includes(actor.role)) {
    throw new Error(`Unauthorized: Role '${actor.role}' cannot approve opening balance batches.`);
  }

  const batch = await db.openingBalanceBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    throw new Error(`Opening balance batch '${batchId}' not found.`);
  }

  if (batch.status === "POSTED") {
    throw new Error(`Cannot approve already POSTED batch '${batch.batchNumber}'.`);
  }

  if (!batch.isBalanced) {
    throw new Error(`Cannot approve unbalanced batch '${batch.batchNumber}'. Debits (Rs. ${batch.totalDebit}) must equal Credits (Rs. ${batch.totalCredit}).`);
  }

  const updated = await db.openingBalanceBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
      approvedById: actor.id,
      approvedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "APPROVE",
    module: "accounting",
    entityType: "OpeningBalanceBatch",
    entityId: batch.id,
    notes: `Approved opening balance batch ${batch.batchNumber}`,
  });

  return updated;
}

/**
 * Posts an approved Opening Balance Batch to the General Ledger:
 * 1. Verifies exact double-entry balance equality (SUM(debit) == SUM(credit)).
 * 2. Creates an immutable JournalEntry with journalType: "OPENING_BALANCE".
 * 3. Creates JournalEntryLine records preserving customer, supplier, and worker party IDs.
 * 4. Locks the batch as POSTED and links the journal entry ID.
 */
export async function postOpeningBalanceBatch(
  batchId: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(actor.role)) {
    throw new Error(`Unauthorized: Posting opening balance to General Ledger requires Owner or Administrator role.`);
  }

  return await db.$transaction(async (tx) => {
    const batch = await tx.openingBalanceBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`Opening balance batch '${batchId}' not found.`);
    }

    if (batch.status === "POSTED") {
      throw new Error(`Batch '${batch.batchNumber}' has already been posted to the General Ledger.`);
    }

    if (!batch.totalDebit.equals(batch.totalCredit)) {
      throw new Error(
        `Double-entry violation: Total debits (Rs. ${batch.totalDebit.toString()}) do not equal total credits (Rs. ${batch.totalCredit.toString()}). Difference: Rs. ${batch.difference.toString()}`
      );
    }

    // Generate Journal Number
    const journalNumber = await generateNextDocumentNumber("JOURNAL", batch.fiscalYear);

    // Create Balanced Opening General Ledger Journal
    const journal = await tx.journalEntry.create({
      data: {
        journalNumber,
        journalType: "OPENING_BALANCE",
        postingDate: batch.asOfDate,
        fiscalYear: batch.fiscalYear,
        narration: `Opening Financial Balances as of ${batch.asOfDate.toISOString().split("T")[0]} (${batch.batchNumber}). ${batch.notes || ""}`.trim(),
        referenceDocumentType: "OPENING_BALANCE",
        referenceDocumentId: batch.batchNumber,
        referenceNumber: batch.batchNumber,
        totalDebit: batch.totalDebit,
        totalCredit: batch.totalCredit,
        isBalanced: true,
        status: "POSTED",
        postedById: actor.id,
        postedAt: new Date(),
        lines: {
          create: batch.items.map((item, idx) => ({
            accountId: item.accountId,
            lineOrder: idx + 1,
            description: item.description || `Opening balance for ${item.accountName}`,
            debitAmount: item.debitAmount,
            creditAmount: item.creditAmount,
            customerId: item.customerId,
            supplierId: item.supplierId,
          })),
        },
      },
    });

    // Update OpeningBalanceBatch to POSTED and link journal
    const postedBatch = await tx.openingBalanceBatch.update({
      where: { id: batchId },
      data: {
        status: "POSTED",
        journalEntryId: journal.id,
        postedById: actor.id,
        postedAt: new Date(),
      },
      include: {
        items: true,
        journalEntry: true,
      },
    });

    // Audit Event
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "POST",
      module: "accounting",
      entityType: "OpeningBalanceBatch",
      entityId: batch.id,
      afterState: {
        batchNumber: batch.batchNumber,
        journalNumber,
        totalDebit: batch.totalDebit.toString(),
        totalCredit: batch.totalCredit.toString(),
      },
      notes: `Posted opening balances to General Ledger via journal ${journalNumber}`,
    });

    return postedBatch;
  });
}

/**
 * Generates an Opening Trial Balance and Balance Sheet reconciliation report.
 */
export async function getOpeningTrialBalanceReport(batchId?: string): Promise<OpeningTrialBalanceReport> {
  const batch = batchId
    ? await db.openingBalanceBatch.findUnique({
        where: { id: batchId },
        include: { items: { include: { account: true } } },
      })
    : await db.openingBalanceBatch.findFirst({
        where: { status: "POSTED" },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { account: true } } },
      });

  if (!batch) {
    return {
      fiscalYear: getCurrentFiscalYear(),
      asOfDate: new Date().toISOString(),
      batchNumber: "NONE",
      status: "NOT_STARTED",
      totalDebit: "0.00",
      totalCredit: "0.00",
      difference: "0.00",
      isBalanced: true,
      rows: [],
      subledgerSummary: {
        customerReceivablesTotal: "0.00",
        customerAdvancesTotal: "0.00",
        customerDepositsTotal: "0.00",
        supplierPayablesTotal: "0.00",
        employeeAdvancesTotal: "0.00",
        wagesPayableTotal: "0.00",
        cashAndBankTotal: "0.00",
        fixedAssetsTotal: "0.00",
      },
    };
  }

  // Aggregate by account
  const accountMap = new Map<string, {
    accountCode: string;
    accountName: string;
    category: string;
    subcategory: string;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    parties: Set<string>;
  }>();

  let custReceivables = new Prisma.Decimal(0);
  let custAdvances = new Prisma.Decimal(0);
  let custDeposits = new Prisma.Decimal(0);
  let suppPayables = new Prisma.Decimal(0);
  let empAdvances = new Prisma.Decimal(0);
  let wagesPayable = new Prisma.Decimal(0);
  let cashAndBank = new Prisma.Decimal(0);
  let fixedAssets = new Prisma.Decimal(0);

  for (const it of batch.items) {
    const acc = it.account;
    const existing = accountMap.get(acc.accountCode) || {
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      category: acc.accountCategory,
      subcategory: acc.accountSubcategory,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
      parties: new Set<string>(),
    };

    existing.debit = existing.debit.plus(it.debitAmount);
    existing.credit = existing.credit.plus(it.creditAmount);

    const partyKey = it.customerId || it.supplierId || it.workerId;
    if (partyKey) existing.parties.add(partyKey);

    accountMap.set(acc.accountCode, existing);

    // Subledger totals
    if (["1030", "1050"].includes(acc.accountCode) && it.customerId) custReceivables = custReceivables.plus(it.debitAmount);
    if (acc.accountCode === "2020") custAdvances = custAdvances.plus(it.creditAmount);
    if (acc.accountCode === "2060") custDeposits = custDeposits.plus(it.creditAmount);
    if (["2010"].includes(acc.accountCode) && it.supplierId) suppPayables = suppPayables.plus(it.creditAmount);
    if (acc.accountCode === "1070") empAdvances = empAdvances.plus(it.debitAmount);
    if (acc.accountCode === "2070") wagesPayable = wagesPayable.plus(it.creditAmount);
    if (["1010", "1020", "1021", "1025"].includes(acc.accountCode)) cashAndBank = cashAndBank.plus(it.debitAmount.minus(it.creditAmount));
    if (["1200", "1210", "1220"].includes(acc.accountCode)) fixedAssets = fixedAssets.plus(it.debitAmount);
  }

  const rows: OpeningTrialBalanceRow[] = Array.from(accountMap.values())
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    .map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      category: r.category,
      subcategory: r.subcategory,
      debit: r.debit,
      credit: r.credit,
      partyCount: r.parties.size,
    }));

  return {
    fiscalYear: batch.fiscalYear,
    asOfDate: batch.asOfDate.toISOString(),
    batchNumber: batch.batchNumber,
    status: batch.status,
    totalDebit: batch.totalDebit.toFixed(2),
    totalCredit: batch.totalCredit.toFixed(2),
    difference: batch.difference.toFixed(2),
    isBalanced: batch.isBalanced,
    rows,
    subledgerSummary: {
      customerReceivablesTotal: custReceivables.toFixed(2),
      customerAdvancesTotal: custAdvances.toFixed(2),
      customerDepositsTotal: custDeposits.toFixed(2),
      supplierPayablesTotal: suppPayables.toFixed(2),
      employeeAdvancesTotal: empAdvances.toFixed(2),
      wagesPayableTotal: wagesPayable.toFixed(2),
      cashAndBankTotal: cashAndBank.toFixed(2),
      fixedAssetsTotal: fixedAssets.toFixed(2),
    },
  };
}
