import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getFleetReportsData, FleetReportFilters } from "@/lib/reports/fleet-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "fleet", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: FleetReportFilters = {
      vehicleId: searchParams.get("vehicleId") || undefined,
      driverId: searchParams.get("driverId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const data = await getFleetReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
