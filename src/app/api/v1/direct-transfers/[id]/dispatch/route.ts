import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { dispatchDirectTransferSchema } from "@/lib/schemas/direct-transfer";
import {
  dispatchDirectTransfer,
  DirectTransferError,
} from "@/lib/direct-transfers/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "direct_transfers", "edit");

    const { id } = await params;
    const body = await req.json();

    const parsed = dispatchDirectTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const dispatched = await dispatchDirectTransfer(id, parsed.data, actor);

    return NextResponse.json({ success: true, data: dispatched });
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
