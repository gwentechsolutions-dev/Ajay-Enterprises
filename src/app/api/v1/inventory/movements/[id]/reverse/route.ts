import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { reverseMovementSchema } from "@/lib/schemas/inventory";
import { reverseInventoryMovement } from "@/lib/inventory/ledger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "movement", "cancel");

    const { id } = await params;
    const body = await req.json();
    const parsed = reverseMovementSchema.safeParse({ ...body, movementId: id });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress,
    };

    const result = await reverseInventoryMovement(id, parsed.data.reversalReason, actor);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED")
      ? 401
      : error.message.startsWith("FORBIDDEN")
      ? 403
      : error.message.includes("already been reversed")
      ? 409
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
