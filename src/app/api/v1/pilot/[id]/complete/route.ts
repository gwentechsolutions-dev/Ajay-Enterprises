import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { completePilotProgram } from "@/lib/pilot/pilot-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "pilot", "approve");

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const actor = {
      id: session?.id || "system",
      name: session?.name || "System User",
      role: session?.role || "OWNER",
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const pilot = await completePilotProgram(
      id,
      body.completionReview || "Pilot operations completed and verified by Owner.",
      actor
    );
    return NextResponse.json({ success: true, data: pilot });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 400);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
