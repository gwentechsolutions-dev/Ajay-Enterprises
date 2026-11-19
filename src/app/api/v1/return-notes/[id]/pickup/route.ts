import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { driverConfirmPickupSchema, completeMrnPickupSchema } from "@/lib/schemas/material-return";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    // Delivery personnel have delivery_portal edit permissions
    await requirePermission(session, "delivery_portal", "edit");
    const { id } = await params;

    const mrn = await db.materialReturnNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        receivingWarehouse: true,
        vehicleTrip: true,
        items: true,
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

    // Support both enhanced driverConfirmPickupSchema (with item counts) and legacy completeMrnPickupSchema
    const isEnhanced = Array.isArray(body.items) && body.items.length > 0;
    let validatedData: any;

    if (isEnhanced) {
      const parsed = driverConfirmPickupSchema.safeParse(body);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error);
      }
      validatedData = parsed.data;
    } else {
      const parsed = completeMrnPickupSchema.safeParse(body);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error);
      }
      validatedData = parsed.data;
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const pickupTime = validatedData.pickupCompletedAt ? new Date(validatedData.pickupCompletedAt) : new Date();
    const primaryPhoto = validatedData.photoUrl;

    const updated = await db.$transaction(async (tx) => {
      // 1. Create Evidence record with photo & GPS
      const additionalPhotos: string[] = validatedData.additionalPhotoUrls || [];
      const allPhotos = [primaryPhoto, ...additionalPhotos].filter(Boolean);

      for (const pUrl of allPhotos) {
        await tx.movementEvidence.create({
          data: {
            documentType: "RETURN_NOTE",
            documentId: mrn.id,
            returnNoteId: mrn.id,
            photoUrl: pUrl,
            gpsLatitude: validatedData.gpsLatitude ? new Prisma.Decimal(validatedData.gpsLatitude) : null,
            gpsLongitude: validatedData.gpsLongitude ? new Prisma.Decimal(validatedData.gpsLongitude) : null,
            gpsAccuracy: validatedData.gpsAccuracy ? new Prisma.Decimal(validatedData.gpsAccuracy) : null,
            capturedById: actor.id,
            receiverName: validatedData.customerRepresentativeName || validatedData.receiverName,
            receiverPhone: validatedData.customerRepresentativePhone || validatedData.receiverPhone || null,
            receiverDesignation: validatedData.customerRepresentativeDesignation || validatedData.receiverDesignation || null,
            receiverSignatureUrl: validatedData.customerSignatureUrl || validatedData.receiverSignatureUrl || null,
            missingEvidenceReason: validatedData.customerSignatureExceptionReason || validatedData.missingEvidenceReason || null,
          },
        });
      }

      // 2. Update item counts if detailed driver count provided
      if (isEnhanced && Array.isArray(validatedData.items)) {
        for (const it of validatedData.items) {
          const collected = new Prisma.Decimal(it.driverCollectedQty);
          const good = new Prisma.Decimal(it.driverGoodQty || 0);
          const damaged = new Prisma.Decimal(it.driverDamagedQty || 0);
          const missing = new Prisma.Decimal(it.driverMissingQty || 0);

          await tx.materialReturnNoteItem.updateMany({
            where: {
              mrnId: mrn.id,
              materialVariantId: it.materialVariantId,
            },
            data: {
              driverCollectedQty: collected,
              driverGoodQty: good,
              driverDamagedQty: damaged,
              driverMissingQty: missing,
              driverRemarks: it.driverRemarks || null,
              returnedQty: collected.gt(0) ? collected : undefined,
            },
          });
        }
      }

      // 3. Format remarks
      const combinedRemarks = [mrn.remarks, validatedData.remarks]
        .filter(Boolean)
        .join(" | ");

      // 4. Update MRN record: Status -> PICKUP_COMPLETED / IN_TRANSIT
      const res = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          status: "PICKUP_COMPLETED",
          photoUrl: primaryPhoto,
          gpsLatitude: validatedData.gpsLatitude ? new Prisma.Decimal(validatedData.gpsLatitude) : mrn.gpsLatitude,
          gpsLongitude: validatedData.gpsLongitude ? new Prisma.Decimal(validatedData.gpsLongitude) : mrn.gpsLongitude,
          pickupCompletedAt: pickupTime,
          pickupOdometer: validatedData.pickupOdometer ? new Prisma.Decimal(validatedData.pickupOdometer) : mrn.pickupOdometer,

          // Customer Handover Sign-off
          customerRepresentativeName: validatedData.customerRepresentativeName || validatedData.receiverName,
          customerRepresentativePhone: validatedData.customerRepresentativePhone || validatedData.receiverPhone || null,
          customerRepresentativeDesignation: validatedData.customerRepresentativeDesignation || validatedData.receiverDesignation || "Site Representative",
          customerSignatureUrl: validatedData.customerSignatureUrl || validatedData.receiverSignatureUrl || null,
          handoverAt: pickupTime,

          remarks: combinedRemarks,
        },
      });

      // 5. Update linked VehicleTrip status to IN_TRANSIT if exists
      if (mrn.vehicleTripId) {
        await tx.vehicleTrip.update({
          where: { id: mrn.vehicleTripId },
          data: {
            status: "IN_TRANSIT",
          },
        });
      }

      return res;
    }, { maxWait: 15000, timeout: 30000 });

    // 6. Audit Log after transaction commits
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
        status: "PICKUP_COMPLETED",
        pickupCompletedAt: pickupTime,
        customerRepresentativeName: updated.customerRepresentativeName,
        photoUrl: primaryPhoto,
      },
      notes: `Driver ${actor.name} confirmed material pickup for MRN ${mrn.mrnNumber} at site ${mrn.customerSite.siteName}. Materials are now in transit to yard.`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Material pickup for MRN ${mrn.mrnNumber} confirmed! Materials are now loaded and in transit to yard.`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

