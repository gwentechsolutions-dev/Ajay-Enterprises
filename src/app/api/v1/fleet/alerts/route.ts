import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getFleetComplianceAlerts } from "@/lib/fleet/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const daysThreshold = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 30;

    const alerts = await getFleetComplianceAlerts(daysThreshold);

    return NextResponse.json({ success: true, data: alerts });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

