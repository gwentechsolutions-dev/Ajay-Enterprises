import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_transfers", "view");

    const { id } = await params;
    const stn = await db.stockTransferNote.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        destinationWarehouse: true,
        items: {
          include: {
            materialVariant: {
              select: {
                id: true,
                materialCode: true,
                name: true,
                size: true,
                uom: true,
              },
            },
          },
        },
        eWayBills: true,
      },
    });

    if (!stn) {
      return NextResponse.json(
        { success: false, error: { message: "Stock Transfer Note not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: stn });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

