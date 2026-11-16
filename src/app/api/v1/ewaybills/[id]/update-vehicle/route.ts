import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { updateVehicleSchema } from "@/lib/schemas/ewaybill";
import { ewayBillService } from "@/lib/ewaybill/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "update");

    const { id } = await params;
    const body = await req.json();
    const parsed = updateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const ewb = await db.eWayBill.findFirst({
      where: {
        OR: [{ id }, { ewbNumber: id }],
      },
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

    const result = await ewayBillService.updateVehicle(
      {
        ewbNumber: ewb.ewbNumber,
        newVehicleNumber: parsed.data.newVehicleNumber,
        fromPlace: parsed.data.fromPlace,
        fromStateCode: parsed.data.fromStateCode,
        reasonCode: parsed.data.reasonCode,
        reasonDescription: parsed.data.reasonDescription,
        transMode: parsed.data.transMode,
      },
      actor
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
