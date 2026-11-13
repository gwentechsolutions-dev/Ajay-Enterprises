import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const [
      activeAgreementsCount,
      activeSitesCount,
      activeBatches,
      pendingAssessments,
      recentStatements,
      deposits,
    ] = await Promise.all([
      db.rentalAgreement.count({ where: { status: "ACTIVE" } }),
      db.customerSite.count({ where: { status: "ACTIVE" } }),
      db.rentalBatch.findMany({
        where: { currentHeldQty: { gt: 0 } },
        include: {
          materialVariant: { select: { id: true, name: true, materialCode: true } },
          customerSite: { select: { id: true, siteName: true, siteCode: true, customerId: true } },
          customer: { select: { id: true, name: true } },
        },
      }),
      db.damageLossAssessment.findMany({
        where: { status: "PENDING_APPROVAL" },
        select: { approvedChargeAmount: true },
      }),
      db.rentalStatement.findMany({
        take: 5,
        orderBy: { periodStartDate: "desc" },
        include: {
          customer: { select: { name: true, customerCode: true } },
          customerSite: { select: { siteName: true } },
        },
      }),
      db.rentalDepositTransaction.findMany({
        select: { transactionType: true, amount: true },
      }),
    ]);

    let totalHeldQty = new Prisma.Decimal(0);
    let dailyAccrualRunRate = new Prisma.Decimal(0);
    const siteAccrualMap = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        customerName: string;
        heldQty: Prisma.Decimal;
        dailyAccrual: Prisma.Decimal;
      }
    >();

    for (const b of activeBatches) {
      totalHeldQty = totalHeldQty.plus(b.currentHeldQty);
      const dayAmount = new Prisma.Decimal(b.currentHeldQty).times(b.applicableDailyRate);
      dailyAccrualRunRate = dailyAccrualRunRate.plus(dayAmount);

      const s = siteAccrualMap.get(b.customerSiteId) || {
        siteId: b.customerSiteId,
        siteName: b.customerSite.siteName,
        customerName: b.customer.name,
        heldQty: new Prisma.Decimal(0),
        dailyAccrual: new Prisma.Decimal(0),
      };
      s.heldQty = s.heldQty.plus(b.currentHeldQty);
      s.dailyAccrual = s.dailyAccrual.plus(dayAmount);
      siteAccrualMap.set(b.customerSiteId, s);
    }

    const topSites = Array.from(siteAccrualMap.values())
      .sort((a, b) => (b.dailyAccrual.gt(a.dailyAccrual) ? 1 : -1))
      .slice(0, 5)
      .map((s) => ({
        ...s,
        heldQty: s.heldQty.toString(),
        dailyAccrual: s.dailyAccrual.toFixed(2),
      }));

    // Deposits total
    let totalDepositsHeld = new Prisma.Decimal(0);
    for (const dep of deposits) {
      if (dep.transactionType === "DEPOSIT_RECEIVED") {
        totalDepositsHeld = totalDepositsHeld.plus(dep.amount);
      } else if (dep.transactionType === "DEPOSIT_REFUND") {
        totalDepositsHeld = totalDepositsHeld.minus(dep.amount);
      }
    }

    // Pending damage assessments total
    let pendingDamageAmount = new Prisma.Decimal(0);
    for (const pa of pendingAssessments) {
      pendingDamageAmount = pendingDamageAmount.plus(pa.approvedChargeAmount);
    }

    const monthlyProjected = dailyAccrualRunRate.times(30);

    return NextResponse.json({
      success: true,
      data: {
        activeAgreementsCount,
        activeSitesCount,
        totalHeldQty: totalHeldQty.toString(),
        dailyAccrualRunRate: dailyAccrualRunRate.toFixed(2),
        monthlyProjectedRevenue: monthlyProjected.toFixed(2),
        totalDepositsHeld: totalDepositsHeld.toFixed(2),
        pendingAssessmentsCount: pendingAssessments.length,
        pendingDamageAmount: pendingDamageAmount.toFixed(2),
        topSites,
        recentStatements,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

