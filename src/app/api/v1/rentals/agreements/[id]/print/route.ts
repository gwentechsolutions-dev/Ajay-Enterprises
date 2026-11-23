import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateAgreementHTML } from "@/lib/rentals/agreement-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (session) {
      await requirePermission(session, "rentals", "view");
    }

    const { id } = await params;
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const html = await generateAgreementHTML(id, origin);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "all, index, follow, max-image-preview:large",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return NextResponse.json({ success: false, error: { message: "Rental Agreement not found" } }, { status: 404 });
    }
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
