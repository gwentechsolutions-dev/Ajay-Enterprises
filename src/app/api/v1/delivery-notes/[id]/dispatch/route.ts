import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "approve");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        items: { include: { materialVariant: true } },
        customer: true,
        customerSite: true,
        contactPerson: true,
      },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    if (dn.status === "DISPATCHED" || dn.status === "DELIVERED") {
      return NextResponse.json(
        { success: false, error: { message: `Delivery Note ${dn.dnNumber} has already been dispatched.` } },
        { status: 400 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    // Execute atomic dispatch posting
    const updated = await db.$transaction(async (tx) => {
      // 1. Post inventory movements for each line item (which strictly checks availability per ownership pool)
      for (const item of dn.items) {
        await postInventoryMovement(
          {
            materialVariantId: item.materialVariantId,
            quantity: item.quantity.toNumber(),
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
            movementType: "DELIVERY_TO_CUSTOMER",
            sourceLocationType: "WAREHOUSE",
            sourceWarehouseId: dn.sourceWarehouseId,
            destinationLocationType: "CUSTOMER_SITE",
            destinationSiteId: dn.customerSiteId,
            customerId: dn.customerId,
            referenceDocumentType: "DELIVERY_NOTE",
            referenceDocumentId: dn.id,
            condition: (item.condition as "GOOD" | "FAIR" | "DAMAGED" | "REPAIRABLE" | "SCRAP") || "GOOD",
            notes: `Delivery Note ${dn.dnNumber} dispatched to ${dn.customerSite.siteName}`,
          },
          actor
        );
      }

      // 2. Mark Delivery Note as DISPATCHED
      const result = await tx.deliveryNote.update({
        where: { id },
        data: {
          status: "DISPATCHED",
          dispatchedById: actor.id,
          dispatchedAt: new Date(),
        },
      });

      // 3. Audit Logging
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "DELIVERY_NOTES",
        entityType: "DeliveryNote",
        entityId: dn.id,
        notes: `Dispatched Delivery Note ${dn.dnNumber} to ${dn.customerSite.siteName} (${dn.items.length} material lines).`,
      });

      return result;
    });

    // Notify customer site contact via WhatsApp (non-blocking)
    const targetMobile = dn.contactPerson?.mobile || dn.customer.primaryMobile;
    const targetName = dn.contactPerson?.name || dn.customer.name;
    if (targetMobile) {
      sendWhatsAppNotification({
        recipientMobile: targetMobile,
        recipientName: targetName,
        templateName: "DN_DISPATCHED",
        documentNumber: dn.dnNumber,
        documentType: "DeliveryNote",
        parameters: {
          dnNumber: dn.dnNumber,
          siteName: dn.customerSite.siteName,
          vehicleNumber: dn.vehicleNumber || "Company Vehicle",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Delivery Note ${dn.dnNumber} successfully dispatched. Warehouse stock deducted and customer site stock credited.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

