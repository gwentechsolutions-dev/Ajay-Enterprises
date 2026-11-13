import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getGstr1Summary, getGstr3bSummary } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "gstr1"; // "gstr1" or "gstr3b"
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    if (reportType === "gstr3b") {
      const data = await getGstr3bSummary(startDate, endDate);
      return NextResponse.json({ success: true, data });
    }

    const data = await getGstr1Summary(startDate, endDate);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

