import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_portal", "view");

    // Filter by assigned driver phone or name if user is DELIVERY_PERSONNEL
    const isDriverOnly = session?.role === "DELIVERY_PERSONNEL";
    const driverFilter = isDriverOnly
      ? {
          OR: [
            { driverName: { contains: session?.name || "", mode: "insensitive" as any } },
            { driverPhone: session?.mobile || undefined },
          ],
        }
      : {};

    // 1. Active Dispatched Deliveries (Awaiting Delivery & Receiver Sign-off)
    const activeDeliveries = await db.deliveryNote.findMany({
      where: {
        status: "DISPATCHED",
        ...driverFilter,
      },
      include: {
        customer: { select: { id: true, name: true, primaryMobile: true } },
        customerSite: { select: { id: true, siteName: true, fullAddress: true, siteContactDetails: true, siteInCharge: true } },
        sourceWarehouse: { select: { id: true, name: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, uom: true } },
          },
        },
        evidences: true,
      },
      orderBy: { deliveryDate: "asc" },
    });

    // 2. Deliveries Completed Today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completedToday = await db.deliveryNote.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: { gte: startOfToday },
        ...driverFilter,
      },
      include: {
        customer: { select: { id: true, name: true } },
        customerSite: { select: { id: true, siteName: true } },
      },
      orderBy: { deliveredAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        activeDeliveries,
        completedToday,
        summary: {
          pendingCount: activeDeliveries.length,
          completedTodayCount: completedToday.length,
        },
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

