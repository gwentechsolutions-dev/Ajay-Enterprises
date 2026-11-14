import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveGoogleMapsCoordinates } from "@/lib/geo/google-maps";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized. Please sign in." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const url = body?.url;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Please provide a Google Maps URL" } },
        { status: 400 }
      );
    }

    const result = await resolveGoogleMapsCoordinates(url);

    if (!result.success || !result.coordinates) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_MAPS_LINK",
            message: result.error || "Could not extract GPS coordinates from this link",
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.coordinates,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to resolve Google Maps link" } },
      { status: 500 }
    );
  }
}
