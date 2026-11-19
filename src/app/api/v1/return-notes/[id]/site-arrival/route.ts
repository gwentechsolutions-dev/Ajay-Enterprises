import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { driverSiteArrivalSchema } from "@/lib/schemas/material-return";
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
        customerSite: true,
        vehicleTrip: true,
      },
    });

    if (!mrn) {
      return NextResponse.json(
        { success: false, error: { message: "Material Return Note not found" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = driverSiteArrivalSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const arrivalTime = input.arrivedAt ? new Date(input.arrivedAt) : new Date();
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const updated = await db.$transaction(async (tx) => {
      // 1. Update MRN with site arrival evidence
      const res = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          status: "ARRIVED_AT_SITE",
          siteArrivedAt: arrivalTime,
          siteArrivalGpsLat: new Prisma.Decimal(input.gpsLatitude),
          siteArrivalGpsLng: new Prisma.Decimal(input.gpsLongitude),
          siteArrivalAccuracy: input.gpsAccuracy ? new Prisma.Decimal(input.gpsAccuracy) : null,
          remarks: input.exceptionReason
            ? `${mrn.remarks ? mrn.remarks + " | " : ""}[GPS Exception: ${input.exceptionReason}]`
            : mrn.remarks,
        },
      });

      // 2. If vehicle trip is in PLANNED state, transition to IN_TRANSIT
      if (mrn.vehicleTripId && mrn.vehicleTrip?.status === "PLANNED") {
        await tx.vehicleTrip.update({
          where: { id: mrn.vehicleTripId },
          data: { status: "IN_TRANSIT" },
        });
      }

      return res;
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Log Audit Event after transaction commits
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "UPDATE",
      module: "delivery_portal",
      entityType: "MaterialReturnNote",
      entityId: mrn.id,
      beforeState: { status: mrn.status },
      afterState: {
        status: "ARRIVED_AT_SITE",
        siteArrivedAt: arrivalTime,
        gpsLatitude: input.gpsLatitude,
        gpsLongitude: input.gpsLongitude,
      },
      ipAddress: actor.ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Driver site arrival recorded at ${mrn.customerSite.siteName} with verified GPS coordinates.`,
      data: {
        id: updated.id,
        status: updated.status,
        siteArrivedAt: updated.siteArrivedAt,
        siteArrivalGpsLat: updated.siteArrivalGpsLat,
        siteArrivalGpsLng: updated.siteArrivalGpsLng,
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
