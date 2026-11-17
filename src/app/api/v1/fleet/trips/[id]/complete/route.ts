import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { completeVehicleTripSchema } from "@/lib/schemas/fleet";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "edit");

    const { id } = await params;
    const trip = await db.vehicleTrip.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!trip) {
      return NextResponse.json({ success: false, error: { message: "Trip not found" } }, { status: 404 });
    }

    if (trip.status === "COMPLETED") {
      return NextResponse.json({ success: false, error: { message: "Trip is already completed" } }, { status: 400 });
    }

    const body = await req.json();
    const parsed = completeVehicleTripSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const startOdo = new Prisma.Decimal(trip.startOdometer);
    const endOdo = new Prisma.Decimal(input.endOdometer);

    // Rule: Ending odometer cannot be lower than starting odometer
    if (endOdo.lt(startOdo)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ODOMETER",
            message: `Ending odometer (${endOdo.toString()}) cannot be lower than start odometer (${startOdo.toString()}).`,
          },
        },
        { status: 422 }
      );
    }

    const distanceKm = endOdo.minus(startOdo);

    const completedTrip = await db.$transaction(async (tx) => {
      const updated = await tx.vehicleTrip.update({
        where: { id },
        data: {
          endOdometer: endOdo,
          distanceKm,
          arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : new Date(),
          fuelUsedLitres: input.fuelUsedLitres != null ? input.fuelUsedLitres : null,
          tripExpenses: input.tripExpenses,
          status: "COMPLETED",
          remarks: input.remarks || trip.remarks,
        },
      });

      // Update vehicle current odometer
      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: {
          currentOdometer: endOdo,
        },
      });

      return updated;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "UPDATE",
      module: "fleet",
      entityType: "VehicleTrip",
      entityId: completedTrip.id,
      beforeState: trip,
      afterState: completedTrip,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: completedTrip,
      message: `Trip ${completedTrip.tripNumber} completed. Distance: ${distanceKm.toString()} km.`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

