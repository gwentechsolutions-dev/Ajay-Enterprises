import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reverseGeocodeGps } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "UNAUTHORIZED: Authentication required" } },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const latStr = searchParams.get("lat") || searchParams.get("latitude");
    const lngStr = searchParams.get("lng") || searchParams.get("longitude");

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { success: false, error: { message: "Both 'lat' and 'lng' query parameters are required" } },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: { message: "Coordinates out of bounds (-90 to 90, -180 to 180)" } },
        { status: 400 }
      );
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const requestReferer =
      req.headers.get("origin") ||
      (host ? `${proto}://${host}/` : undefined);

    const result = await reverseGeocodeGps(lat, lng, requestReferer);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to reverse geocode" } },
      { status: 500 }
    );
  }
}
