import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getOwnerDashboardData, OwnerDashboardFilters } from "@/lib/reports/dashboard-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "dashboard", "view");

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") as any) || "THIS_MONTH";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const filters: OwnerDashboardFilters = {
      period,
      startDate,
      endDate,
      branchId,
      warehouseId,
    };

    const data = await getOwnerDashboardData(filters);

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
