import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { previewOpeningStockCsv } from "@/lib/cutover/opening-stock-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "cutover", "create");

    const body = await req.json();
    const rows = Array.isArray(body) ? body : body.rows || [];

    const preview = await previewOpeningStockCsv(rows);
    return NextResponse.json({ success: true, data: preview });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 400);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
