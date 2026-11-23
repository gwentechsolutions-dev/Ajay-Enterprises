import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { calculatePincodeDistance } from "@/lib/pincode-distance";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");

    const searchParams = req.nextUrl.searchParams;
    const fromPincode = searchParams.get("fromPincode") || searchParams.get("from") || undefined;
    const toPincode = searchParams.get("toPincode") || searchParams.get("to") || undefined;

    const fromLat = searchParams.get("fromLat") ? parseFloat(searchParams.get("fromLat")!) : undefined;
    const fromLng = searchParams.get("fromLng") ? parseFloat(searchParams.get("fromLng")!) : undefined;
    const toLat = searchParams.get("toLat") ? parseFloat(searchParams.get("toLat")!) : undefined;
    const toLng = searchParams.get("toLng") ? parseFloat(searchParams.get("toLng")!) : undefined;

    const fromCoords = fromLat && fromLng && !isNaN(fromLat) && !isNaN(fromLng) ? { lat: fromLat, lng: fromLng } : undefined;
    const toCoords = toLat && toLng && !isNaN(toLat) && !isNaN(toLng) ? { lat: toLat, lng: toLng } : undefined;

    const result = calculatePincodeDistance({
      fromPincode,
      toPincode,
      fromCoords,
      toCoords,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
