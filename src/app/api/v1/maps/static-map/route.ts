import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchStaticMapThumbnail } from "@/lib/google-maps";

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

    const zoom = Math.max(12, Math.min(20, parseInt(searchParams.get("zoom") || "17", 10)));
    const width = Math.max(100, Math.min(640, parseInt(searchParams.get("width") || "320", 10)));
    const height = Math.max(80, Math.min(640, parseInt(searchParams.get("height") || "240", 10)));
    const format = searchParams.get("format");

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const requestReferer =
      req.headers.get("origin") ||
      (host ? `${proto}://${host}/` : undefined);

    const { buffer, contentType, isConfigured, isFallback, errorMessage } = await fetchStaticMapThumbnail({
      latitude: lat,
      longitude: lng,
      zoom,
      width,
      height,
      referer: requestReferer,
    });

    if (format === "base64" || format === "json") {
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      return NextResponse.json(
        {
          success: true,
          data: {
            dataUrl,
            isConfigured,
            isFallback,
            contentType,
            errorMessage,
          },
        },
        {
          headers: {
            "Cache-Control": isFallback ? "private, no-store" : "private, max-age=3600",
          },
        }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isFallback ? "private, no-store" : "private, max-age=3600",
        "X-Inventra-Map-Configured": isConfigured ? "true" : "false",
        "X-Inventra-Map-Fallback": isFallback ? "true" : "false",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to generate static map" } },
      { status: 500 }
    );
  }
}
