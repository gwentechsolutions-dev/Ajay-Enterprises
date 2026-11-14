import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  getDirectTransferById,
  cancelDirectTransfer,
  DirectTransferError,
} from "@/lib/direct-transfers/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "direct_transfers", "view");

    const { id } = await params;
    const transfer = await getDirectTransferById(id);

    return NextResponse.json({ success: true, data: transfer });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : error.code === "NOT_FOUND" ? 404 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;
    const body = await req.json();

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    if (body.action === "CANCEL") {
      await requirePermission(session, "direct_transfers", "cancel");
      const cancelled = await cancelDirectTransfer(id, body.reason || "User requested cancellation", actor);
      return NextResponse.json({ success: true, data: cancelled });
    }

    return NextResponse.json(
      { success: false, error: { message: "Unknown action" } },
      { status: 400 }
    );
  } catch (error: any) {
    const status = error.statusCode || (error instanceof DirectTransferError ? (error.statusCode || 400) : 400);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || "DIRECT_TRANSFER_ERROR",
          message: error.message,
        },
      },
      { status }
    );
  }
}
