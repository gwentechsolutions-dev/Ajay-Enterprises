import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createVehicleTripSchema } from "@/lib/schemas/fleet";
import { validateVehicleTripAssignment } from "@/lib/fleet/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "view");

    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId") || undefined;
    const driverId = searchParams.get("driverId") || undefined;
    const status = searchParams.get("status") || undefined;

    const trips = await db.vehicleTrip.findMany({
      where: {
        ...(vehicleId ? { vehicleId } : {}),
        ...(driverId ? { driverId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
        driver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
        originWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        destinationSite: { select: { id: true, siteName: true, siteCode: true } },
        deliveryNotes: {
          include: {
            deliveryNote: { select: { id: true, dnNumber: true, customerSite: { select: { siteName: true } } } },
          },
        },
        returnNotes: {
          select: {
            id: true,
            mrnNumber: true,
            status: true,
            customer: { select: { id: true, name: true } },
            customerSite: { select: { id: true, siteName: true } },
          },
        },
      },
      orderBy: { tripDate: "desc" },
    });

    return NextResponse.json({ success: true, data: trips });
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
    const parsed = createVehicleTripSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;

    // Concurrency check: Ensure vehicle is not already IN_TRANSIT
    await validateVehicleTripAssignment(input.vehicleId);

    const tripNumber = input.tripNumber || (await generateNextDocumentNumber("TRIP"));

    const trip = await db.$transaction(async (tx) => {
      const created = await tx.vehicleTrip.create({
        data: {
          tripNumber,
          vehicleId: input.vehicleId,
          driverId: input.driverId || null,
          originWarehouseId: input.originWarehouseId || null,
          originAddress: input.originAddress || null,
          destinationSiteId: input.destinationSiteId || null,
          destinationAddress: input.destinationAddress || null,
          tripDate: input.tripDate ? new Date(input.tripDate) : new Date(),
          departureTime: input.departureTime ? new Date(input.departureTime) : new Date(),
          startOdometer: input.startOdometer,
          tripPurpose: input.tripPurpose,
          status: "IN_TRANSIT",
          remarks: input.remarks || null,
          createdById: session!.id,
          deliveryNotes: {
            create: (input.deliveryNoteIds || []).map((dnId) => ({
              deliveryNoteId: dnId,
            })),
          },
        },
        include: {
          deliveryNotes: true,
        },
      });

      // Link any Return Notes to this trip
      if (input.returnNoteIds && input.returnNoteIds.length > 0) {
        await tx.materialReturnNote.updateMany({
          where: { id: { in: input.returnNoteIds } },
          data: {
            vehicleTripId: created.id,
            status: "ASSIGNED",
          },
        });
      }

      // Update vehicle status
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: {
          currentOdometer: input.startOdometer,
        },
      });

      return created;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "fleet",
      entityType: "VehicleTrip",
      entityId: trip.id,
      afterState: trip,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: trip, message: `Trip ${trip.tripNumber} initiated.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : error.message?.includes("active trip")
      ? 409
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

