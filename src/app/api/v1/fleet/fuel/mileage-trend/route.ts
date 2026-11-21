import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getMileageTrendData } from "@/lib/fleet/fuel-calculations";

// ==============================================================================
// INVENTRA: FLEET MILEAGE TREND API
// GET /api/v1/fleet/fuel/mileage-trend?vehicleId=...&startDate=...&endDate=...
// ==============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const startDateRaw = searchParams.get("startDate");
    const endDateRaw = searchParams.get("endDate");

    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    const trendData = await getMileageTrendData({
      vehicleId,
      startDate,
      endDate,
    });

    return NextResponse.json({ success: true, data: trendData });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
