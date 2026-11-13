import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const materialVariantId = searchParams.get("materialVariantId") || undefined;
    const ownershipType = searchParams.get("ownershipType") || undefined;
    const status = searchParams.get("status") || "ACTIVE"; // default ACTIVE batches

    const where: Prisma.RentalBatchWhereInput = {
      customerId,
      customerSiteId,
      materialVariantId,
      ownershipType,
      ...(status === "ACTIVE" ? { currentHeldQty: { gt: 0 } } : {}),
      ...(status && status !== "ALL" && status !== "ACTIVE" ? { status } : {}),
    };

    const batches = await db.rentalBatch.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        materialVariant: {
          select: { id: true, name: true, materialCode: true, uom: true, size: true },
        },
        deliveryNote: { select: { id: true, dnNumber: true, deliveryDate: true } },
        returnAllocations: {
          include: {
            materialReturnNote: { select: { id: true, mrnNumber: true } },
          },
        },
      },
      orderBy: [{ customerSiteId: "asc" }, { deliveryDate: "desc" }],
    });

    // Material-wise summary
    const summaryMap = new Map<
      string,
      {
        materialVariantId: string;
        name: string;
        code: string;
        uom: string;
        ownershipType: string;
        totalDelivered: Prisma.Decimal;
        totalReturned: Prisma.Decimal;
        totalDamaged: Prisma.Decimal;
        totalMissing: Prisma.Decimal;
        totalHeld: Prisma.Decimal;
        dailyAccrualTotal: Prisma.Decimal;
        siteCount: Set<string>;
      }
    >();

    for (const b of batches) {
      const key = `${b.materialVariantId}:${b.ownershipType}`;
      const curr = summaryMap.get(key) || {
        materialVariantId: b.materialVariantId,
        name: b.materialVariant.name,
        code: b.materialVariant.materialCode,
        uom: b.materialVariant.uom,
        ownershipType: b.ownershipType,
        totalDelivered: new Prisma.Decimal(0),
        totalReturned: new Prisma.Decimal(0),
        totalDamaged: new Prisma.Decimal(0),
        totalMissing: new Prisma.Decimal(0),
        totalHeld: new Prisma.Decimal(0),
        dailyAccrualTotal: new Prisma.Decimal(0),
        siteCount: new Set<string>(),
      };

      curr.totalDelivered = curr.totalDelivered.plus(b.deliveredQty);
      curr.totalReturned = curr.totalReturned.plus(b.returnedQty);
      curr.totalDamaged = curr.totalDamaged.plus(b.damagedQty);
      curr.totalMissing = curr.totalMissing.plus(b.missingQty);
      curr.totalHeld = curr.totalHeld.plus(b.currentHeldQty);
      curr.dailyAccrualTotal = curr.dailyAccrualTotal.plus(
        new Prisma.Decimal(b.currentHeldQty).times(b.applicableDailyRate)
      );
      curr.siteCount.add(b.customerSiteId);
      summaryMap.set(key, curr);
    }

    const summary = Array.from(summaryMap.values()).map((s) => ({
      ...s,
      siteCount: s.siteCount.size,
      totalDelivered: s.totalDelivered.toString(),
      totalReturned: s.totalReturned.toString(),
      totalDamaged: s.totalDamaged.toString(),
      totalMissing: s.totalMissing.toString(),
      totalHeld: s.totalHeld.toString(),
      dailyAccrualTotal: s.dailyAccrualTotal.toFixed(2),
    }));

    return NextResponse.json({
      success: true,
      data: {
        batches,
        summary,
        totalBatches: batches.length,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

