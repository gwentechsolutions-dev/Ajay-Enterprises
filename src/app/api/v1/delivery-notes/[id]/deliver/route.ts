import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { deliverNoteWithEvidenceSchema } from "@/lib/schemas/delivery-note";
import { validationErrorResponse } from "@/lib/api-validation";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "edit");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        contactPerson: true,
      },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    if (dn.status === "DELIVERED") {
      return NextResponse.json(
        { success: false, error: { message: `Delivery Note ${dn.dnNumber} is already marked as DELIVERED.` } },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = deliverNoteWithEvidenceSchema.safeParse(body);
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
      // 1. Create Evidence record if photo or signature provided
      if (input.photoUrl || input.receiverSignatureUrl || input.missingEvidenceReason) {
        await tx.movementEvidence.create({
          data: {
            documentType: "DELIVERY_NOTE",
            documentId: dn.id,
            deliveryNoteId: dn.id,
            photoUrl: input.photoUrl || "/placeholder-evidence.png",
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
      }

      // 2. Update Delivery Note status
      const res = await tx.deliveryNote.update({
        where: { id },
        data: {
          status: "DELIVERED",
          receiverName: input.receiverName,
          receiverPhone: input.receiverPhone || null,
          receiverDesignation: input.receiverDesignation || null,
          receiverSignatureUrl: input.receiverSignatureUrl || null,
          photoUrl: input.photoUrl || null,
          gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
          gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
          gpsAccuracy: input.gpsAccuracy ? new Prisma.Decimal(input.gpsAccuracy) : null,
          missingEvidenceReason: input.missingEvidenceReason || null,
          deliveredById: actor.id,
          deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
        },
      });

      // 3. Audit log
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "UPDATE",
        module: "DELIVERY_NOTES",
        entityType: "DeliveryNote",
        entityId: dn.id,
        notes: `Recorded site delivery acknowledgement for ${dn.dnNumber} by receiver ${input.receiverName}`,
      });

      return res;
    });

    // Notify customer site contact via WhatsApp
    const targetMobile = dn.contactPerson?.mobile || dn.customer.primaryMobile;
    const targetName = dn.contactPerson?.name || dn.customer.name;
    if (targetMobile) {
      sendWhatsAppNotification({
        recipientMobile: targetMobile,
        recipientName: targetName,
        templateName: "DN_DELIVERED",
        documentNumber: dn.dnNumber,
        documentType: "DeliveryNote",
        parameters: {
          dnNumber: dn.dnNumber,
          receiverName: input.receiverName,
          time: new Date().toLocaleTimeString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Delivery Note ${dn.dnNumber} successfully marked as DELIVERED with receiver acknowledgement.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

