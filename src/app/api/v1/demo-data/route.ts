import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemoDataStatus } from "@/lib/demo/demo-status-service";
import { generateComprehensiveDemoData } from "@/lib/demo/demo-generator-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized. Please log in." } }, { status: 401 });
    }

    const statusData = await getDemoDataStatus();
    return NextResponse.json({
      success: true,
      data: {
        ...statusData,
        isOwner: session.role === "OWNER",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to fetch demo data status" } },
      { status: 500 }
    );
  }
}

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
          error: { message: "Access denied. Only the business OWNER is authorized to generate demo datasets." },
        },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    const result = await generateComprehensiveDemoData({
      id: session.id,
      name: session.name || "Owner",
      role: session.role,
      ipAddress,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const statusCode = error.message?.includes("already loaded") ? 400 : 500;
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to generate demo dataset" } },
      { status: statusCode }
    );
  }
}
