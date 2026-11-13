import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { checkSiteClosureEligibility } from "@/lib/rentals/settlement";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const body = await req.json();
    const { customerSiteId } = body;
    if (!customerSiteId) {
      return NextResponse.json({ success: false, error: { message: "customerSiteId is required" } }, { status: 400 });
    }

    const audit = await checkSiteClosureEligibility(customerSiteId);

    return NextResponse.json({
      success: true,
      data: audit,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

