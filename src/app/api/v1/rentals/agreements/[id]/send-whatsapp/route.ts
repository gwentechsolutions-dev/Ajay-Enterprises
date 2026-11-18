import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { dispatchAgreementWhatsApp } from "@/lib/rentals/agreement-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const { id } = await params;
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
    };

    const result = await dispatchAgreementWhatsApp(id, origin, actor);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success
        ? "Rental Agreement queued for WhatsApp delivery."
        : `WhatsApp delivery not completed: ${result.error || "Integration unconfigured or invalid phone number"}`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
