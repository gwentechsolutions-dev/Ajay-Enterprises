import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getProvider } from "@/lib/ewaybill/factory";
import { EwbProviderName } from "@/lib/ewaybill/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company_profile", "read");

    let targetProvider: EwbProviderName | undefined;
    try {
      const body = await req.json();
      if (body.provider === "FYN" || body.provider === "WHITEBOOKS") {
        targetProvider = body.provider;
      }
    } catch {
      // Body is optional
    }

    const provider = getProvider(targetProvider);
    const testResult = await provider.testConnection();

    return NextResponse.json({
      success: testResult.success,
      data: testResult,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: { message: error.message },
      },
      { status }
    );
  }
}
