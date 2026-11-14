import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getLabourReportsData, LabourReportFilters } from "@/lib/reports/labour-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "labour", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: LabourReportFilters = {
      workerId: searchParams.get("workerId") || undefined,
      category: searchParams.get("category") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const data = await getLabourReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
