import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { ewayBillService } from "@/lib/ewaybill/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "read");

    const { id } = await params;
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const ewb = await db.eWayBill.findFirst({
      where: {
        OR: [{ id }, { ewbNumber: id }],
      },
      include: {
        deliveryNote: {
          select: {
            id: true,
            dnNumber: true,
            deliveryDate: true,
            customer: { select: { name: true, gstin: true } },
            customerSite: { select: { siteName: true, city: true, pinCode: true } },
          },
        },
        transferNote: {
          select: {
            id: true,
            stnNumber: true,
            transferDate: true,
            sourceWarehouse: { select: { name: true, city: true } },
            destinationWarehouse: { select: { name: true, city: true } },
          },
        },
        operations: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!ewb) {
      return NextResponse.json({ success: false, error: { message: "E-Way Bill not found" } }, { status: 404 });
    }

    if (refresh && ewb.status === "ACTIVE") {
      try {
        const liveDetails = await ewayBillService.getEWayBillDetails(ewb.ewbNumber);
        return NextResponse.json({
          success: true,
          data: {
            ...ewb,
            liveDetails,
          },
        });
      } catch (err: any) {
        // Fall back to stored record if live refresh fails
      }
    }

    return NextResponse.json({ success: true, data: ewb });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
