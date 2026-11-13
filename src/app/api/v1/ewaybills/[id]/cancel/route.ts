import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { cancelEWayBillSchema } from "@/lib/schemas/ewaybill";
import { cancelFYNWayBill } from "@/lib/integrations/fyn-ewaybill";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "delete");

    const { id } = await params;
    const body = await req.json();
    const parsed = cancelEWayBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const ewb = await db.eWayBill.findUnique({
      where: { id },
    });

    if (!ewb) {
      return NextResponse.json({ success: false, error: { message: "E-Way Bill not found" } }, { status: 404 });
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const result = await cancelFYNWayBill(
      ewb.ewbNumber,
      parsed.data.cancelReason,
      actor
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

