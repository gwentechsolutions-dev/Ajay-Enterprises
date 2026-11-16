import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { cancelEWayBillSchema } from "@/lib/schemas/ewaybill";
import { ewayBillService } from "@/lib/ewaybill/service";

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

    // ID can be E-Way Bill UUID or ewbNumber (e.g. 12-digit number)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const ewb = await db.eWayBill.findFirst({
      where: isUuid
        ? { OR: [{ id }, { ewbNumber: id }] }
        : { ewbNumber: id },
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

    const result = await ewayBillService.cancelEWayBill(
      {
        ewbNumber: ewb.ewbNumber,
        cancelReasonCode: parsed.data.cancelReasonCode,
        cancelRemarks: parsed.data.cancelReason,
      },
      actor
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
