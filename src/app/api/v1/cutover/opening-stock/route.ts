import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { createOpeningStockBatch } from "@/lib/cutover/opening-stock-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "cutover", "view");

    const batches = await db.openingStockBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            materialVariant: true,
            warehouse: true,
            customer: true,
            customerSite: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: batches });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "cutover", "create");

    const body = await req.json();
    const actor = {
      id: session?.id || "system",
      name: session?.name || "System User",
      role: session?.role || "OWNER",
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const batch = await createOpeningStockBatch(body, actor);
    return NextResponse.json({ success: true, data: batch }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 400);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
