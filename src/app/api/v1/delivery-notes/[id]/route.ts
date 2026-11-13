import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        sourceWarehouse: true,
        contactPerson: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
        evidences: true,
        eWayBills: true,
        returnNotes: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: dn });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

