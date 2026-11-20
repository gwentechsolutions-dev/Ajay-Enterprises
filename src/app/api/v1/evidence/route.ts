import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { captureEvidenceSchema } from "@/lib/schemas/evidence";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "UNAUTHORIZED: Authentication required" } }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const documentId = searchParams.get("documentId");
    const documentType = searchParams.get("documentType");

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: { message: "documentId query param is required" } },
        { status: 400 }
      );
    }

    const evidences = await db.movementEvidence.findMany({
      where: {
        documentId,
        documentType: documentType ? (documentType as any) : undefined,
      },
      orderBy: { capturedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: evidences });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "UNAUTHORIZED: Authentication required" } }, { status: 401 });
    }

    const body = await req.json();
    const parsed = captureEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const actor = {
      id: session.id,
      name: session.name,
      role: session.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const evidence = await db.movementEvidence.create({
      data: {
        documentType: input.documentType,
        documentId: input.documentId,
        deliveryNoteId: input.documentType === "DELIVERY_NOTE" ? input.documentId : null,
        returnNoteId: input.documentType === "RETURN_NOTE" ? input.documentId : null,
        transferNoteId: input.documentType === "TRANSFER_NOTE" ? input.documentId : null,
        directTransferId: input.documentType === "DIRECT_TRANSFER" ? input.documentId : null,
        photoUrl: input.watermarkedPhotoUrl || input.photoUrl,
        storagePath: input.watermarkedStoragePath || input.storagePath,
        fileChecksum: input.fileChecksum,
        originalPhotoUrl: input.originalPhotoUrl || null,
        originalStoragePath: input.originalStoragePath || null,
        watermarkedPhotoUrl: input.watermarkedPhotoUrl || input.photoUrl,
        watermarkedStoragePath: input.watermarkedStoragePath || input.storagePath,
        geocodedAddress: input.geocodedAddress || null,
        geocodingStatus: input.geocodingStatus || "PENDING",
        miniMapStatus: input.miniMapStatus || "PENDING",
        evidenceCategory: input.evidenceCategory || null,
        gpsLatitude: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : null,
        gpsLongitude: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : null,
        gpsAccuracy: input.gpsAccuracy !== undefined && input.gpsAccuracy !== null ? new Prisma.Decimal(input.gpsAccuracy) : null,
        capturedAt: input.capturedAt || new Date(),
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        receiverDesignation: input.receiverDesignation,
        receiverSignatureUrl: input.receiverSignatureUrl,
        missingEvidenceReason: input.missingEvidenceReason,
        capturedById: actor.id,
      },
    });

    // Synchronize watermarked photo onto parent movement records
    const displayPhotoUrl = input.watermarkedPhotoUrl || input.photoUrl;
    if (input.documentType === "DELIVERY_NOTE") {
      await db.deliveryNote.update({
        where: { id: input.documentId },
        data: {
          photoUrl: displayPhotoUrl,
          gpsLatitude: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : undefined,
          gpsLongitude: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : undefined,
          gpsAccuracy: input.gpsAccuracy !== undefined && input.gpsAccuracy !== null ? new Prisma.Decimal(input.gpsAccuracy) : undefined,
        },
      }).catch(() => null);
    } else if (input.documentType === "RETURN_NOTE") {
      await db.materialReturnNote.update({
        where: { id: input.documentId },
        data: {
          photoUrl: displayPhotoUrl,
          gpsLatitude: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : undefined,
          gpsLongitude: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : undefined,
        },
      }).catch(() => null);
    } else if (input.documentType === "DIRECT_TRANSFER") {
      const isDest = input.evidenceCategory?.includes("DEST") || input.evidenceCategory === "DESTINATION_UNLOAD";
      await db.directSiteTransferNote.update({
        where: { id: input.documentId },
        data: isDest
          ? {
              destPhotoUrl: displayPhotoUrl,
              destGpsLat: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : undefined,
              destGpsLng: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : undefined,
            }
          : {
              sourcePhotoUrl: displayPhotoUrl,
              sourceGpsLat: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : undefined,
              sourceGpsLng: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : undefined,
            },
      }).catch(() => null);
    }

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "CREATE",
      module: "EVIDENCE",
      entityType: "MovementEvidence",
      entityId: evidence.id,
      ipAddress: actor.ipAddress,
      notes: `Captured proof for ${input.documentType} ${input.documentId}`,
    });

    return NextResponse.json({ success: true, data: evidence }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}

