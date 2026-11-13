import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "view");
    const { id } = await params;

    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        deliveryWarehouse: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
        grns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!po) {
      return NextResponse.json({ success: false, error: { message: "Purchase Order not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: po });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

