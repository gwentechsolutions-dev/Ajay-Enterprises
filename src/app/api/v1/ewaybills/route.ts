import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");

    const searchParams = req.nextUrl.searchParams;
    const documentType = searchParams.get("documentType") || undefined;
    const documentId = searchParams.get("documentId") || undefined;

    const ewbs = await db.eWayBill.findMany({
      where: {
        documentType: documentType ? (documentType as any) : undefined,
        documentId: documentId || undefined,
      },
      include: {
        deliveryNote: { select: { id: true, dnNumber: true } },
        transferNote: { select: { id: true, stnNumber: true } },
      },
      orderBy: { generatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: ewbs });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

