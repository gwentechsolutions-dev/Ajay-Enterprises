import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getAvailableSourceBatches } from "@/lib/direct-transfers/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "direct_transfers", "view");

    const { searchParams } = new URL(req.url);
    const customerSiteId = searchParams.get("customerSiteId");

    if (!customerSiteId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "customerSiteId query parameter is required" },
        },
        { status: 400 }
      );
    }

    const available = await getAvailableSourceBatches(customerSiteId);

    return NextResponse.json({ success: true, data: available });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
