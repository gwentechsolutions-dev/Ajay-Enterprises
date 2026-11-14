import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getRentalReportsData, RentalReportFilters } from "@/lib/reports/rental-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    // Allow if user has view permission on reports OR rentals
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "rentals", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: RentalReportFilters = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      customerId: searchParams.get("customerId") || undefined,
      customerSiteId: searchParams.get("customerSiteId") || undefined,
      materialVariantId: searchParams.get("materialVariantId") || undefined,
      ownershipType: (searchParams.get("ownershipType") as any) || "ALL",
    };

    const data = await getRentalReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
