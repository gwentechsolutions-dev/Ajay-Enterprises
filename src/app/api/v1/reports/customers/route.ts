import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getCustomerReportsData, CustomerReportFilters } from "@/lib/reports/customer-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "customers", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: CustomerReportFilters = {
      customerId: searchParams.get("customerId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const data = await getCustomerReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
