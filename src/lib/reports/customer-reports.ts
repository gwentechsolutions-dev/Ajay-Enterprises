import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCustomerAgeing } from "@/lib/accounting/reports";

export interface CustomerReportFilters {
  customerId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  isActive?: boolean;
  status?: string;
  isGstRegistered?: boolean;
}

export async function getCustomerReportsData(filters?: CustomerReportFilters) {
  const now = new Date();
  const start = filters?.startDate ? new Date(filters.startDate) : new Date(now.getFullYear(), 0, 1);
  const end = filters?.endDate ? new Date(filters.endDate) : now;

  const [
    masterSummary,
    customerPerformance,
    ageingBuckets,
    heldStockByCustomer,
    creditDebitNotes,
    profitability,
  ] = await Promise.all([
    getCustomerMasterSummary(),
    getCustomerPerformance(start, end, filters?.customerId),
    getCustomerAgeing(now),
    getHeldStockByCustomer(filters?.customerId),
    getCreditDebitNotesSummary(start, end, filters?.customerId),
    getCustomerProfitability(start, end, filters?.customerId),
  ]);

  return {
    masterSummary,
    customerPerformance,
    ageingBuckets,
    heldStockByCustomer,
    creditDebitNotes,
    profitability,
  };
}

async function getCustomerMasterSummary() {
  const [total, active, inactive, gstRegistered, nonGst] = await Promise.all([
    db.customer.count(),
    db.customer.count({ where: { isActive: true } }),
    db.customer.count({ where: { isActive: false } }),
    db.customer.count({ where: { gstin: { not: null } } }),
    db.customer.count({ where: { gstin: null } }),
  ]);

  return {
    totalCustomers: total,
    activeCustomers: active,
    inactiveCustomers: inactive,
    gstRegistered,
    nonGst,
  };
}

async function getCustomerPerformance(start: Date, end: Date, customerId?: string) {
  const customers = await db.customer.findMany({
    where: {
      ...(customerId ? { id: customerId } : {}),
    },
    include: {
      invoices: {
        where: {
          status: { in: ["ISSUED", "POSTED"] },
          invoiceDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          grandTotal: true,
          outstandingAmount: true,
          paidAmount: true,
          dueDate: true,
          status: true,
        },
      },
      paymentReceipts: {
        where: {
          status: "POSTED",
          paymentDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          amountReceived: true,
        },
      },
      sites: {
        select: { id: true, siteName: true },
      },
    },
    take: 50,
  });

  const now = new Date();

  return customers.map((c) => {
    const totalBilled = c.invoices.reduce((sum, inv) => sum.plus(new Prisma.Decimal(inv.grandTotal)), new Prisma.Decimal(0));
    const totalOutstanding = c.invoices.reduce((sum, inv) => sum.plus(new Prisma.Decimal(inv.outstandingAmount)), new Prisma.Decimal(0));
    const totalCollected = c.paymentReceipts.reduce((sum, rec) => sum.plus(new Prisma.Decimal(rec.amountReceived)), new Prisma.Decimal(0));

    const overdueInvoices = c.invoices.filter((inv) => new Date(inv.dueDate) < now && Number(inv.outstandingAmount) > 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum.plus(new Prisma.Decimal(inv.outstandingAmount)), new Prisma.Decimal(0));

    return {
      customerId: c.id,
      customerName: c.name,
      customerCode: c.customerCode,
      mobile: c.primaryMobile,
      gstin: c.gstin || "Unregistered",
      status: c.isActive ? "ACTIVE" : "INACTIVE",
      sitesCount: c.sites.length,
      invoicesCount: c.invoices.length,
      totalBilled,
      totalCollected,
      totalOutstanding,
      overdueAmount,
      overdueCount: overdueInvoices.length,
    };
  }).sort((a, b) => b.totalOutstanding.minus(a.totalOutstanding).toNumber());
}

async function getHeldStockByCustomer(customerId?: string) {
  const batches = await db.rentalBatch.findMany({
    where: {
      status: "ACTIVE",
      currentHeldQty: { gt: 0 },
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: { select: { name: true, customerCode: true } },
      customerSite: { select: { siteName: true } },
      materialVariant: { select: { name: true, materialCode: true } },
    },
  });

  const map: Record<string, { customerId: string; customerName: string; customerCode: string; totalHeldQty: Prisma.Decimal; totalDailyAccrual: Prisma.Decimal; batchesCount: number }> = {};

  for (const b of batches) {
    const id = b.customerId;
    if (!map[id]) {
      map[id] = {
        customerId: id,
        customerName: b.customer.name,
        customerCode: b.customer.customerCode,
        totalHeldQty: new Prisma.Decimal(0),
        totalDailyAccrual: new Prisma.Decimal(0),
        batchesCount: 0,
      };
    }
    const qty = new Prisma.Decimal(b.currentHeldQty);
    const rate = new Prisma.Decimal(b.applicableDailyRate);
    map[id].totalHeldQty = map[id].totalHeldQty.plus(qty);
    map[id].totalDailyAccrual = map[id].totalDailyAccrual.plus(qty.times(rate));
    map[id].batchesCount += 1;
  }

  return Object.values(map).sort((a, b) => b.totalHeldQty.minus(a.totalHeldQty).toNumber());
}

async function getCreditDebitNotesSummary(start: Date, end: Date, customerId?: string) {
  const notes = await db.creditDebitNote.findMany({
    where: {
      status: "POSTED",
      noteDate: { gte: start, lte: end },
      ...(customerId ? { customerId } : {}),
    },
    select: {
      id: true,
      noteNumber: true,
      noteType: true,
      noteDate: true,
      reason: true,
      taxableAmount: true,
      totalAmount: true,
      customer: { select: { name: true } },
    },
    take: 20,
    orderBy: { noteDate: "desc" },
  });

  let totalCredit = new Prisma.Decimal(0);
  let totalDebit = new Prisma.Decimal(0);

  for (const n of notes) {
    if (n.noteType === "CREDIT_NOTE") {
      totalCredit = totalCredit.plus(new Prisma.Decimal(n.totalAmount));
    } else {
      totalDebit = totalDebit.plus(new Prisma.Decimal(n.totalAmount));
    }
  }

  return {
    totalCreditNotes: totalCredit,
    totalDebitNotes: totalDebit,
    count: notes.length,
    recentNotes: notes,
  };
}

/**
 * Customer Site-wise Profitability
 */
async function getCustomerProfitability(start: Date, end: Date, customerId?: string) {
  const customers = await db.customer.findMany({
    where: {
      ...(customerId ? { id: customerId } : {}),
    },
    include: {
      sites: {
        include: {
          invoices: {
            where: {
              status: { in: ["ISSUED", "POSTED"] },
              invoiceDate: { gte: start, lte: end },
            },
            select: { taxableAmount: true },
          },
          damageAssessments: {
            where: {
              createdAt: { gte: start, lte: end },
            },
            select: { approvedChargeAmount: true },
          },
        },
      },
    },
    take: 30,
  });

  const report: Array<{
    customerId: string;
    customerName: string;
    siteId: string;
    siteName: string;
    attributedRevenue: Prisma.Decimal;
    attributedCosts: Prisma.Decimal;
    netMargin: Prisma.Decimal;
    marginPct: number;
    isEstimate: boolean;
  }> = [];

  for (const c of customers) {
    for (const s of c.sites) {
      const revenue = s.invoices.reduce(
        (sum, inv) => sum.plus(new Prisma.Decimal(inv.taxableAmount)),
        new Prisma.Decimal(0)
      );

      const costs = s.damageAssessments.reduce(
        (sum, dmg) => sum.plus(new Prisma.Decimal(dmg.approvedChargeAmount || 0)),
        new Prisma.Decimal(0)
      );

      const margin = revenue.minus(costs);
      const marginPct = revenue.gt(0) ? Math.round(margin.dividedBy(revenue).times(100).toNumber() * 100) / 100 : 0;

      if (revenue.gt(0) || costs.gt(0)) {
        report.push({
          customerId: c.id,
          customerName: c.name,
          siteId: s.id,
          siteName: s.siteName,
          attributedRevenue: revenue,
          attributedCosts: costs,
          netMargin: margin,
          marginPct,
          isEstimate: false,
        });
      }
    }
  }

  return report.sort((a, b) => b.netMargin.minus(a.netMargin).toNumber());
}
