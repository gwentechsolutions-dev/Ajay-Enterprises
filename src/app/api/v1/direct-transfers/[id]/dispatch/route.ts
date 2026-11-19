import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { pickupDirectTransferSchema } from "@/lib/schemas/direct-transfer";
import { validationErrorResponse } from "@/lib/api-validation";
import {
  confirmSourcePickup,
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

    const parsed = pickupDirectTransferSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const dispatched = await confirmSourcePickup(id, parsed.data, actor);

    return NextResponse.json({ success: true, data: dispatched });
  } catch (error: any) {
    const status =
      error.statusCode || (error instanceof DirectTransferError ? (error.statusCode || 400) : 400);
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
