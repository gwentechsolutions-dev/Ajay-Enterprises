import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { captureEvidenceSchema } from "@/lib/schemas/evidence";

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
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
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
        photoUrl: input.photoUrl,
        storagePath: input.storagePath,
        fileChecksum: input.fileChecksum,
        gpsLatitude: input.gpsLatitude !== undefined && input.gpsLatitude !== null ? new Prisma.Decimal(input.gpsLatitude) : null,
        gpsLongitude: input.gpsLongitude !== undefined && input.gpsLongitude !== null ? new Prisma.Decimal(input.gpsLongitude) : null,
        gpsAccuracy: input.gpsAccuracy !== undefined && input.gpsAccuracy !== null ? new Prisma.Decimal(input.gpsAccuracy) : null,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        receiverDesignation: input.receiverDesignation,
        receiverSignatureUrl: input.receiverSignatureUrl,
        missingEvidenceReason: input.missingEvidenceReason,
        capturedById: actor.id,
      },
    });

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

