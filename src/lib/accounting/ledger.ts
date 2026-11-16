import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber, getCurrentFiscalYear } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { seedDefaultChartOfAccounts, getSystemAccount } from "./chart-of-accounts";

export { getSystemAccount };

// ==============================================================================
// INVENTRA: DOUBLE-ENTRY GENERAL LEDGER POSTING ENGINE
// Rule 15: Strict Double-Entry Ledger (SUM(debits) == SUM(credits))
// Rule 18: Immutability of Finalised Financial Documents
// ==============================================================================

export interface JournalLineSpec {
  accountId: string;
  description?: string | null;
  debitAmount: number | Prisma.Decimal;
  creditAmount: number | Prisma.Decimal;
  customerId?: string | null;
  customerSiteId?: string | null;
  supplierId?: string | null;
}

export interface PostJournalInput {
  journalNumber?: string;
  journalType?: "GENERAL" | "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "CONTRA" | "ADJUSTMENT" | "REVERSAL" | "YEAR_END_CLOSING";
  postingDate?: Date | string;
  fiscalYear?: string;
  narration: string;
  referenceDocumentType?: string | null;
  referenceDocumentId?: string | null;
  referenceNumber?: string | null;
  supportingDocUrl?: string | null;
  lines: JournalLineSpec[];
}

export interface ActorContext {
  id: string;
  name: string;
  role: string;
  ipAddress?: string;
}

/**
 * Updates running account balance based on double-entry accounting equation.
 */
function updateAccountBalanceFormula(
  category: string,
  current: Prisma.Decimal,
  debit: Prisma.Decimal,
  credit: Prisma.Decimal
): Prisma.Decimal {
  // ASSETS and EXPENSES: Debit increases, Credit decreases
  if (category === "ASSET" || category === "EXPENSE") {
    return current.plus(debit).minus(credit);
  }
  // LIABILITIES, EQUITY, and INCOME: Credit increases, Debit decreases
  return current.plus(credit).minus(debit);
}

/**
 * Posts an immutable, balanced Double-Entry Journal Entry to the General Ledger.
 */
export async function postJournalEntry(
  input: PostJournalInput,
  actor: ActorContext,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;

  // 1. Ensure default accounts are present
  await seedDefaultChartOfAccounts(runner);

  const postingDate = input.postingDate ? new Date(input.postingDate) : new Date();
  const fiscalYear = getCurrentFiscalYear(postingDate);

  // 2. Check for closed / locked accounting period
  const lockedPeriod = await runner.accountingPeriod.findFirst({
    where: {
      fiscalYear,
      isLocked: true,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  });

  if (lockedPeriod) {
    throw new Error(
      `ACCOUNTING_PERIOD_LOCKED: Posting date falls within locked period '${lockedPeriod.periodName}' (${fiscalYear}). Financial postings are forbidden.`
    );
  }

  // 3. Verify Double-Entry Equilibrium: Total Debits == Total Credits
  let totalDebit = new Prisma.Decimal(0);
  let totalCredit = new Prisma.Decimal(0);

  const parsedLines = input.lines.map((l, idx) => {
    const dr = new Prisma.Decimal(l.debitAmount || 0);
    const cr = new Prisma.Decimal(l.creditAmount || 0);

    if (dr.lt(0) || cr.lt(0)) {
      throw new Error(`Line ${idx + 1}: Debit and credit amounts cannot be negative.`);
    }
    if (dr.gt(0) && cr.gt(0)) {
      throw new Error(`Line ${idx + 1}: Line cannot specify both debit and credit.`);
    }
    if (dr.isZero() && cr.isZero()) {
      throw new Error(`Line ${idx + 1}: Line must have either debit or credit amount.`);
    }

    totalDebit = totalDebit.plus(dr);
    totalCredit = totalCredit.plus(cr);

    return {
      accountId: l.accountId,
      lineOrder: idx + 1,
      description: l.description || null,
      debitAmount: dr,
      creditAmount: cr,
      customerId: l.customerId || null,
      customerSiteId: l.customerSiteId || null,
      supplierId: l.supplierId || null,
    };
  });

  const diff = totalDebit.minus(totalCredit).abs();
  if (diff.gt(new Prisma.Decimal("0.001"))) {
    throw new Error(
      `UNBALANCED_JOURNAL: Total debits (₹${totalDebit.toFixed(2)}) must equal total credits (₹${totalCredit.toFixed(2)}). Difference: ₹${diff.toFixed(2)}.`
    );
  }

  // 4. Generate Document Series Number if not provided
  const journalNumber = input.journalNumber || (await generateNextDocumentNumber("JOURNAL", fiscalYear, tx));

  // 5. Insert Journal Header and Lines atomically
  const journal = await runner.journalEntry.create({
    data: {
      journalNumber,
      journalType: input.journalType || "GENERAL",
      postingDate,
      fiscalYear,
      narration: input.narration,
      referenceDocumentType: input.referenceDocumentType || null,
      referenceDocumentId: input.referenceDocumentId || null,
      referenceNumber: input.referenceNumber || null,
      totalDebit,
      totalCredit,
      isBalanced: true,
      status: "POSTED",
      postedById: actor.id,
      postedAt: new Date(),
      supportingDocUrl: input.supportingDocUrl || null,
      lines: {
        create: parsedLines,
      },
    },
    include: {
      lines: {
        include: { account: true },
      },
    },
  });

  // 6. Update running account balances
  for (const line of parsedLines) {
    const acc = await runner.chartOfAccount.findUnique({
      where: { id: line.accountId },
    });
    if (acc) {
      const newBal = updateAccountBalanceFormula(
        acc.accountCategory,
        new Prisma.Decimal(acc.currentBalance),
        line.debitAmount,
        line.creditAmount
      );
      await runner.chartOfAccount.update({
        where: { id: acc.id },
        data: { currentBalance: newBal },
      });
    }
  }

  // 7. Audit Log
  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "POST",
    module: "ACCOUNTING",
    entityType: "JournalEntry",
    entityId: journal.id,
    notes: `Posted Journal ${journalNumber} (${input.journalType || "GENERAL"}). Amount: ₹${totalDebit.toFixed(2)}. ${input.narration}`,
  });

  return journal;
}

/**
 * Reverses a posted journal entry by creating an opposite balanced journal.
 */
export async function reverseJournalEntry(
  journalId: string,
  reason: string,
  actor: ActorContext,
  tx?: Prisma.TransactionClient
) {
  const runner = tx || db;

  const original = await runner.journalEntry.findUnique({
    where: { id: journalId },
    include: { lines: true },
  });

  if (!original) {
    throw new Error("Journal entry not found.");
  }
  if (original.status === "REVERSED") {
    throw new Error("Journal entry has already been reversed.");
  }

  const reversalLines: JournalLineSpec[] = original.lines.map((l) => ({
    accountId: l.accountId,
    description: `Reversal of ${original.journalNumber}: ${l.description || ""}`,
    debitAmount: l.creditAmount, // Swap debit and credit
    creditAmount: l.debitAmount,
    customerId: l.customerId,
    customerSiteId: l.customerSiteId,
    supplierId: l.supplierId,
  }));

  const reversal = await postJournalEntry(
    {
      journalType: "REVERSAL",
      narration: `Reversal of ${original.journalNumber}. Reason: ${reason}`,
      referenceDocumentType: "JOURNAL",
      referenceDocumentId: original.id,
      referenceNumber: original.journalNumber,
      lines: reversalLines,
    },
    actor,
    runner
  );

  await runner.journalEntry.update({
    where: { id: original.id },
    data: {
      status: "REVERSED",
      reversedById: actor.id,
      reversedAt: new Date(),
      reversalJournalId: reversal.id,
      reversalReason: reason,
    },
  });

  return reversal;
}

