import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { driverYardArrivalSchema } from "@/lib/schemas/material-return";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_portal", "edit");
    const { id } = await params;

    const mrn = await db.materialReturnNote.findUnique({
      where: { id },
      include: {
        receivingWarehouse: true,
        vehicleTrip: {
          include: { vehicle: true },
        },
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
          error: { message: `MRN ${mrn.mrnNumber} is already in ${mrn.status} status and cannot be modified.` },
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = driverYardArrivalSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const yardTime = input.yardArrivedAt ? new Date(input.yardArrivedAt) : new Date();
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      // 1. Update MRN record: Status -> AWAITING_INSPECTION
      const res = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          status: "AWAITING_INSPECTION",
          yardArrivedAt: yardTime,
          yardArrivalGpsLat: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
          yardArrivalGpsLng: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
          yardOdometer: input.yardOdometer ? new Prisma.Decimal(input.yardOdometer) : null,
          receiverName: input.receiverName,
          receiverDesignation: input.receiverDesignation || "Yard In-Charge",
          receiverPhone: input.receiverPhone || null,
          receivedAt: yardTime,
          inspectionStatus: "PENDING",
          remarks: input.remarks
            ? `${mrn.remarks ? mrn.remarks + " | " : ""}[Yard Arrival: ${input.remarks}]`
            : mrn.remarks,
        },
      });

      // 2. Complete the linked vehicle trip if odometer provided
      if (mrn.vehicleTripId && mrn.vehicleTrip) {
        const startOdo = new Prisma.Decimal(mrn.vehicleTrip.startOdometer);
        const endOdo = input.yardOdometer
          ? new Prisma.Decimal(input.yardOdometer)
          : startOdo;
        const distanceKm = endOdo.gte(startOdo) ? endOdo.minus(startOdo) : new Prisma.Decimal(0);

        await tx.vehicleTrip.update({
          where: { id: mrn.vehicleTripId },
          data: {
            status: "COMPLETED",
            arrivalTime: yardTime,
            endOdometer: endOdo,
            distanceKm,
          },
        });

        // Update vehicle current odometer
        if (input.yardOdometer && mrn.vehicleTrip.vehicleId) {
          await tx.vehicle.update({
            where: { id: mrn.vehicleTrip.vehicleId },
            data: {
              currentOdometer: endOdo,
            },
          });
        }
      }

      return res;
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Log Audit Event after transaction commits
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "UPDATE",
      module: "delivery_portal",
      entityType: "MaterialReturnNote",
      entityId: mrn.id,
      beforeState: { status: mrn.status },
      afterState: {
        status: "AWAITING_INSPECTION",
        yardArrivedAt: yardTime,
        receiverName: input.receiverName,
      },
      notes: `Driver ${actor.name} returned to ${mrn.receivingWarehouse.name} and handed over materials to ${input.receiverName}. MRN ${mrn.mrnNumber} is awaiting warehouse physical QC inspection.`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Yard arrival and material handover to ${input.receiverName} recorded! MRN is now awaiting warehouse QC inspection.`,
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
