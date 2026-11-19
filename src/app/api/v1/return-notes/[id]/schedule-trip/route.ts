import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { scheduleReturnTripSchema } from "@/lib/schemas/material-return";
import { validateVehicleTripAssignment } from "@/lib/fleet/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_returns", "edit");
    const { id } = await params;

    const mrn = await db.materialReturnNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        receivingWarehouse: true,
      },
    });

    if (!mrn) {
      return NextResponse.json(
        { success: false, error: { message: "Material Return Note not found" } },
        { status: 404 }
      );
    }

    if (["FINALIZED", "POSTED", "CANCELLED"].includes(mrn.status)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: `Cannot schedule trip for return note in ${mrn.status} status.` },
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = scheduleReturnTripSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const result = await db.$transaction(async (tx) => {
      let linkedTripId: string | null = null;
      let vehicleRegNumber: string | null = input.vehicleNumber || null;
      let driverFullName: string | null = input.driverName || null;
      let driverContactPhone: string | null = input.driverPhone || null;

      // 1. Link to existing trip if specified
      if (input.existingTripId) {
        const existing = await tx.vehicleTrip.findUnique({
          where: { id: input.existingTripId },
          include: { vehicle: true, driver: true },
        });

        if (!existing) {
          throw new Error("Specified existing vehicle trip was not found.");
        }

        linkedTripId = existing.id;
        vehicleRegNumber = existing.vehicle.vehicleNumber;
        if (existing.driver) {
          driverFullName = existing.driver.name;
          driverContactPhone = existing.driver.mobileNumber;
        }
      } else {
        // 2. Validate no conflicting active trip for the vehicle
        await validateVehicleTripAssignment(input.vehicleId);

        // Fetch vehicle & driver master data
        const vehicle = await tx.vehicle.findUnique({
          where: { id: input.vehicleId },
        });

        if (!vehicle) {
          throw new Error("Selected company vehicle was not found in fleet records.");
        }

        vehicleRegNumber = vehicle.vehicleNumber;

        let driver = null;
        if (input.driverId) {
          driver = await tx.driver.findUnique({
            where: { id: input.driverId },
          });
          if (driver) {
            driverFullName = driver.name;
            driverContactPhone = driver.mobileNumber;
          }
        }

        // Generate trip number
        const tripNumber = await generateNextDocumentNumber("TRIP", undefined, tx);
        const startOdo =
          input.startOdometer !== undefined && input.startOdometer !== null
            ? new Prisma.Decimal(input.startOdometer)
            : vehicle.currentOdometer;

        const newTrip = await tx.vehicleTrip.create({
          data: {
            tripNumber,
            vehicleId: input.vehicleId,
            driverId: input.driverId || null,
            originWarehouseId: input.destinationWarehouseId || mrn.receivingWarehouseId,
            destinationSiteId: mrn.customerSiteId,
            destinationAddress: mrn.customerSite.fullAddress || undefined,
            tripDate: input.pickupDate ? new Date(input.pickupDate) : new Date(),
            departureTime: new Date(),
            startOdometer: startOdo,
            tripPurpose: "RETURN_PICKUP",
            status: "PLANNED",
            remarks: input.tripInstructions || `Material Return Pickup for ${mrn.mrnNumber}`,
            createdById: actor.id,
          },
        });

        linkedTripId = newTrip.id;
      }

      // 3. Update MRN record with trip link and schedule
      const updatedMRN = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          vehicleTripId: linkedTripId,
          vehicleNumber: vehicleRegNumber || mrn.vehicleNumber,
          driverName: driverFullName || mrn.driverName,
          driverPhone: driverContactPhone || mrn.driverPhone,
          status: "ASSIGNED",
          preferredPickupDate: input.pickupDate ? new Date(input.pickupDate) : mrn.preferredPickupDate,
          preferredPickupTime: input.pickupTime || mrn.preferredPickupTime,
          pickupInstructions: input.tripInstructions || mrn.pickupInstructions,
        },
        include: {
          vehicleTrip: {
            include: { vehicle: true, driver: true },
          },
        },
      });

      return updatedMRN;
    }, { maxWait: 15000, timeout: 30000 });

    // 4. Log audit event after transaction commits
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "UPDATE",
      module: "material_returns",
      entityType: "MaterialReturnNote",
      entityId: mrn.id,
      beforeState: { status: mrn.status, vehicleTripId: mrn.vehicleTripId },
      afterState: { status: result.status, vehicleTripId: result.vehicleTripId },
      ipAddress: actor.ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Return pickup ${mrn.mrnNumber} assigned to driver and scheduled on trip ${result.vehicleTrip?.tripNumber || ""}.`,
      data: result,
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
