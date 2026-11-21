import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";

// ==============================================================================
// INVENTRA: VEHICLE LAST ODOMETER & FUEL CONTEXT API
// GET /api/v1/fleet/vehicles/[id]/last-odometer
// ==============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { id: vehicleId } = await params;

    const vehicle = await db.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        defaultDriver: { select: { id: true, name: true, driverCode: true } },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: { message: "Vehicle not found" } },
        { status: 404 }
      );
    }

    // Get latest fuel log
    const lastFuelLog = await db.vehicleFuelLog.findFirst({
      where: { vehicleId },
      orderBy: { fuelDate: "desc" },
    });

    // Get latest maintenance record
    const lastMaintenance = await db.vehicleMaintenanceRecord.findFirst({
      where: { vehicleId },
      orderBy: { serviceDate: "desc" },
    });

    // Get latest trip
    const lastTrip = await db.vehicleTrip.findFirst({
      where: { vehicleId, endOdometer: { not: null } },
      orderBy: { tripDate: "desc" },
    });

    const odoCandidates: number[] = [Number(vehicle.currentOdometer)];
    if (lastFuelLog) odoCandidates.push(Number(lastFuelLog.odometerReading));
    if (lastMaintenance) odoCandidates.push(Number(lastMaintenance.odometerReading));
    if (lastTrip && lastTrip.endOdometer) odoCandidates.push(Number(lastTrip.endOdometer));

    const maxOdometer = Math.max(...odoCandidates, 0);

    return NextResponse.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        fuelType: vehicle.fuelType,
        category: vehicle.category,
        make: vehicle.make,
        model: vehicle.model,
        defaultDriver: vehicle.defaultDriver,
        lastOdometerKm: maxOdometer,
        lastFuelLog: lastFuelLog
          ? {
              logNumber: lastFuelLog.logNumber,
              fuelDate: lastFuelLog.fuelDate.toISOString(),
              odometerReading: Number(lastFuelLog.odometerReading),
              quantityLitres: Number(lastFuelLog.quantityLitres),
              pricePerUnit: Number(lastFuelLog.pricePerUnit),
              totalCost: Number(lastFuelLog.totalCost),
              isFullTank: lastFuelLog.isFullTank,
            }
          : null,
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
