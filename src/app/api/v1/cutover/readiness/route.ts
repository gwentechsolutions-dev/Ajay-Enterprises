import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getProductionReadinessReport } from "@/lib/cutover/readiness-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "cutover", "view");

    const report = await getProductionReadinessReport();
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
