import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getCustomerAgeing, getSupplierAgeing } from "@/lib/accounting/reports";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "customer"; // "customer" or "supplier"
    const asOfDate = searchParams.get("asOfDate") || undefined;

    if (type === "supplier") {
      const data = await getSupplierAgeing(asOfDate);
      return NextResponse.json({ success: true, data });
    }

    const data = await getCustomerAgeing(asOfDate);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

