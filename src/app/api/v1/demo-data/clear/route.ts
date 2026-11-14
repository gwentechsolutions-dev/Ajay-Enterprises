import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clearAllDemoData } from "@/lib/demo/demo-cleanup-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized. Please log in." } }, { status: 401 });
    }

    if (session.role !== "OWNER") {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Access denied. Only the business OWNER is authorized to clear demo datasets." },
        },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    const result = await clearAllDemoData({
      id: session.id,
      name: session.name || "Owner",
      role: session.role,
      ipAddress,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const statusCode = error.message?.includes("No active demo dataset") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to clear demo dataset" } },
      { status: statusCode }
    );
  }
}
