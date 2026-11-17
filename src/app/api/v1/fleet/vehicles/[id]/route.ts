import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { updateVehicleSchema } from "@/lib/schemas/fleet";
import { calculateVehicleMileage } from "@/lib/fleet/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { id } = await params;
    const vehicle = await db.vehicle.findUnique({
      where: { id },
      include: {
        defaultDriver: true,
        branch: true,
        driverAssignments: {
          include: { driver: true },
          orderBy: { assignedFrom: "desc" },
          take: 10,
        },
        trips: {
          orderBy: { tripDate: "desc" },
          take: 15,
        },
        fuelLogs: {
          orderBy: { fuelDate: "desc" },
          take: 15,
        },
        maintenanceRecords: {
          orderBy: { serviceDate: "desc" },
          take: 10,
        },
        expenses: {
          orderBy: { expenseDate: "desc" },
          take: 15,
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ success: false, error: { message: "Vehicle not found" } }, { status: 404 });
    }

    const mileageStats = await calculateVehicleMileage(vehicle.id);

    return NextResponse.json({ success: true, data: { vehicle, mileageStats } });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "edit");

    const { id } = await params;
    const existing = await db.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Vehicle not found" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const updated = await db.vehicle.update({
      where: { id },
      data: {
        category: input.category || undefined,
        make: input.make || undefined,
        model: input.model || undefined,
        variant: input.variant !== undefined ? input.variant : undefined,
        fuelType: input.fuelType || undefined,
        chassisNumber: input.chassisNumber !== undefined ? input.chassisNumber : undefined,
        engineNumber: input.engineNumber !== undefined ? input.engineNumber : undefined,
        insuranceProvider: input.insuranceProvider !== undefined ? input.insuranceProvider : undefined,
        insurancePolicyNumber: input.insurancePolicyNumber !== undefined ? input.insurancePolicyNumber : undefined,
        insuranceExpiryDate: input.insuranceExpiryDate ? new Date(input.insuranceExpiryDate) : undefined,
        fitnessExpiryDate: input.fitnessExpiryDate ? new Date(input.fitnessExpiryDate) : undefined,
        pollutionExpiryDate: input.pollutionExpiryDate ? new Date(input.pollutionExpiryDate) : undefined,
        permitExpiryDate: input.permitExpiryDate ? new Date(input.permitExpiryDate) : undefined,
        rcDocumentUrl: input.rcDocumentUrl !== undefined ? input.rcDocumentUrl : undefined,
        insuranceDocumentUrl: input.insuranceDocumentUrl !== undefined ? input.insuranceDocumentUrl : undefined,
        permitDocumentUrl: input.permitDocumentUrl !== undefined ? input.permitDocumentUrl : undefined,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : undefined,
        branchId: input.branchId !== undefined ? input.branchId || null : undefined,
        defaultDriverId: input.defaultDriverId !== undefined ? input.defaultDriverId || null : undefined,
        currentOdometer: input.currentOdometer !== undefined ? input.currentOdometer : undefined,
        status: input.status || undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "UPDATE",
      module: "fleet",
      entityType: "Vehicle",
      entityId: updated.id,
      beforeState: existing,
      afterState: updated,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: updated, message: `Vehicle ${updated.vehicleNumber} updated.` });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

