import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getFinancialReportsData, FinancialReportFilters } from "@/lib/reports/financial-reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "view");
    } catch {
      await requirePermission(session, "accounting", "view");
    }

    const { searchParams } = new URL(req.url);
    const filters: FinancialReportFilters = {
      asOfDate: searchParams.get("asOfDate") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      fiscalYear: searchParams.get("fiscalYear") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    };

    const data = await getFinancialReportsData(filters);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
