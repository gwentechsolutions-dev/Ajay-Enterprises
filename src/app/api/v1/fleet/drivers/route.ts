import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createDriverSchema } from "@/lib/schemas/fleet";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "fleet", "view");
    } catch {
      await requirePermission(session, "delivery_notes", "view");
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    const drivers = await db.driver.findMany({
      where: status ? { status } : undefined,
      include: {
        defaultForVehicles: { select: { id: true, vehicleNumber: true, make: true, model: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: drivers });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "create");

    const body = await req.json();
    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;

    // Check duplicate license
    const existing = await db.driver.findUnique({
      where: { licenseNumber: input.licenseNumber },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_LICENSE", message: `Driver with license number '${input.licenseNumber}' already exists.` } },
        { status: 409 }
      );
    }

    const driverCode = input.driverCode || (await generateNextDocumentNumber("DRV"));

    const driver = await db.driver.create({
      data: {
        driverCode,
        name: input.name,
        mobileNumber: input.mobileNumber,
        address: input.address || null,
        emergencyContact: input.emergencyContact || null,
        licenseNumber: input.licenseNumber,
        licenseClass: input.licenseClass || null,
        licenseExpiryDate: new Date(input.licenseExpiryDate),
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
        assignedVehicleId: input.assignedVehicleId || null,
        salaryType: input.salaryType,
        salaryAmount: input.salaryAmount,
        status: input.status,
        licenseDocumentUrl: input.licenseDocumentUrl || null,
        idDocumentUrl: input.idDocumentUrl || null,
        notes: input.notes || null,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "Driver",
      entityId: driver.id,
      afterState: driver,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: driver, message: `Driver ${driver.name} (${driver.driverCode}) created.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

