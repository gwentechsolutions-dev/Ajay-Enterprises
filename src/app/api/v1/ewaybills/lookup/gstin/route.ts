import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getProvider } from "@/lib/ewaybill/factory";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "read");

    const url = new URL(req.url);
    const gstin = url.searchParams.get("gstin");

    if (!gstin || gstin.trim().length !== 15) {
      return NextResponse.json(
        { success: false, error: { message: "A valid 15-character GSTIN is required." } },
        { status: 400 }
      );
    }

    const provider = getProvider("WHITEBOOKS");
    if (!provider.lookupGSTIN) {
      return NextResponse.json(
        { success: false, error: { message: "GSTIN lookup is not supported by active provider." } },
        { status: 501 }
      );
    }

    const result = await provider.lookupGSTIN(gstin.trim());
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
