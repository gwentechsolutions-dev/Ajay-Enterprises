import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getProvider } from "@/lib/ewaybill/factory";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "read");

    const url = new URL(req.url);
    const hsn = url.searchParams.get("hsn");

    if (!hsn || hsn.trim().length < 4) {
      return NextResponse.json(
        { success: false, error: { message: "A valid HSN code (at least 4 digits) is required." } },
        { status: 400 }
      );
    }

    const provider = getProvider("WHITEBOOKS");
    if (!provider.lookupHSN) {
      return NextResponse.json(
        { success: false, error: { message: "HSN lookup is not supported by active provider." } },
        { status: 501 }
      );
    }

    const result = await provider.lookupHSN(hsn.trim());
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
