import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getRoleTrainingCurriculum,
  markTrainingModuleCompleted,
} from "@/lib/training/training-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "training", "view");

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;

    const curricula = await getRoleTrainingCurriculum(role);
    return NextResponse.json({ success: true, data: curricula });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "training", "edit");

    const body = await req.json();
    const actor = {
      id: session?.id || "system",
      name: session?.name || "System User",
      role: session?.role || "OWNER",
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const record = await markTrainingModuleCompleted(body.moduleCode, body.role, actor);
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 400);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
