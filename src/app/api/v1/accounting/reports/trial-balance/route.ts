import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getTrialBalance } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get("asOfDate") || undefined;
    const fiscalYear = searchParams.get("fiscalYear") || undefined;

    const report = await getTrialBalance(asOfDate, fiscalYear);

    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

