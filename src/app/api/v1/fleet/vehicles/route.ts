import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleSchema } from "@/lib/schemas/fleet";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    // Allow either fleet view or delivery_notes view so staff creating delivery notes / EWBs can list vehicles
    try {
      await requirePermission(session, "fleet", "view");
    } catch {
      await requirePermission(session, "delivery_notes", "view");
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const vehicles = await db.vehicle.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        defaultDriver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
        branch: { select: { id: true, name: true, branchCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: vehicles });
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
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // Check duplicate vehicle registration
    const existing = await db.vehicle.findUnique({
      where: { vehicleNumber: input.vehicleNumber },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_VEHICLE", message: `Vehicle with registration '${input.vehicleNumber}' already exists.` } },
        { status: 409 }
      );
    }

    const vehicle = await db.vehicle.create({
      data: {
        vehicleNumber: input.vehicleNumber,
        category: input.category,
        make: input.make,
        model: input.model,
        variant: input.variant || null,
        fuelType: input.fuelType,
        chassisNumber: input.chassisNumber || null,
        engineNumber: input.engineNumber || null,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        purchaseValue: input.purchaseValue != null ? input.purchaseValue : null,
        insuranceProvider: input.insuranceProvider || null,
        insurancePolicyNumber: input.insurancePolicyNumber || null,
        insuranceStartDate: input.insuranceStartDate ? new Date(input.insuranceStartDate) : null,
        insuranceExpiryDate: input.insuranceExpiryDate ? new Date(input.insuranceExpiryDate) : null,
        fitnessExpiryDate: input.fitnessExpiryDate ? new Date(input.fitnessExpiryDate) : null,
        pollutionExpiryDate: input.pollutionExpiryDate ? new Date(input.pollutionExpiryDate) : null,
        permitExpiryDate: input.permitExpiryDate ? new Date(input.permitExpiryDate) : null,
        rcDocumentUrl: input.rcDocumentUrl || null,
        insuranceDocumentUrl: input.insuranceDocumentUrl || null,
        permitDocumentUrl: input.permitDocumentUrl || null,
        photoUrl: input.photoUrl || null,
        branchId: input.branchId || null,
        defaultDriverId: input.defaultDriverId || null,
        currentOdometer: input.currentOdometer,
        status: input.status,
        notes: input.notes || null,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "Vehicle",
      entityId: vehicle.id,
      afterState: vehicle,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: vehicle, message: `Vehicle ${vehicle.vehicleNumber} successfully registered.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

