import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getInventoryReportsData, InventoryReportFilters } from "@/lib/reports/inventory-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "inventory", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: InventoryReportFilters = {
      warehouseId: searchParams.get("warehouseId") || undefined,
      materialVariantId: searchParams.get("materialVariantId") || undefined,
      ownershipType: (searchParams.get("ownershipType") as any) || "ALL",
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const data = await getInventoryReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
