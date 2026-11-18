import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { completeMrnPickupSchema } from "@/lib/schemas/material-return";
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
      },
    });

    if (!mrn) {
      return NextResponse.json(
        { success: false, error: { message: "Material Return Note not found" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = completeMrnPickupSchema.safeParse(body);
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

    const updated = await db.$transaction(async (tx) => {
      // 1. Create Evidence record with photo & GPS
      await tx.movementEvidence.create({
        data: {
          documentType: "RETURN_NOTE",
          documentId: mrn.id,
          returnNoteId: mrn.id,
          photoUrl: input.photoUrl,
          gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
          gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
          gpsAccuracy: input.gpsAccuracy ? new Prisma.Decimal(input.gpsAccuracy) : null,
          capturedById: actor.id,
          receiverName: input.receiverName,
          receiverPhone: input.receiverPhone || null,
          receiverDesignation: input.receiverDesignation || null,
          receiverSignatureUrl: input.receiverSignatureUrl || null,
          missingEvidenceReason: input.missingEvidenceReason || null,
        },
      });

      // 2. Format remarks to record destination info (Yard or Direct Transfer)
      const destinationNote =
        input.destinationType === "SITE_TRANSFER" && input.destinationSiteName
          ? `[Direct Site Transfer to ${input.destinationSiteName}]`
          : `[Returned to ${mrn.receivingWarehouse.name}]`;

      const combinedRemarks = [mrn.remarks, destinationNote, input.remarks]
        .filter(Boolean)
        .join(" | ");

      // 3. Update MRN record
      const res = await tx.materialReturnNote.update({
        where: { id },
        data: {
          status: "POSTED",
          photoUrl: input.photoUrl,
          gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
          gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
          receiverName: input.receiverName,
          receiverPhone: input.receiverPhone || null,
          receiverSignatureUrl: input.receiverSignatureUrl || null,
          missingEvidenceReason: input.missingEvidenceReason || null,
          postedById: mrn.postedById || actor.id,
          postedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
          remarks: combinedRemarks,
        },
      });

      // 4. Audit Log
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "UPDATE",
        module: "MATERIAL_RETURNS",
        entityType: "MaterialReturnNote",
        entityId: mrn.id,
        afterState: {
          mrnNumber: mrn.mrnNumber,
          receiverName: input.receiverName,
          photoUrl: input.photoUrl,
          gpsLatitude: input.gpsLatitude,
          gpsLongitude: input.gpsLongitude,
          destinationType: input.destinationType,
        },
        notes: `Driver ${actor.name} completed material pickup and return for MRN ${mrn.mrnNumber} at ${mrn.customerSite.siteName} with GPS photo proof.`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Material pickup and return for MRN ${mrn.mrnNumber} confirmed with GPS photo evidence!`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
