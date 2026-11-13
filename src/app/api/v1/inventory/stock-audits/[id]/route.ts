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
    await requirePermission(session, "stock_audit", "view");

    const { id } = await params;
    const audit = await db.stockAudit.findUnique({
      where: { id },
      include: {
        warehouse: true,
        conductedBy: { select: { id: true, name: true, userCode: true, role: true } },
        approvedBy: { select: { id: true, name: true, userCode: true, role: true } },
        items: {
          include: {
            materialVariant: {
              include: { materialType: { include: { category: true } } },
            },
          },
          orderBy: { materialVariant: { materialCode: "asc" } },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { success: false, error: { message: "Stock audit not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

