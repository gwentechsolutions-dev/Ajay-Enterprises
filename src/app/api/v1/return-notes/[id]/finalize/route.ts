import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { allocateReturnToBatches } from "@/lib/rentals/tracking";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";
import { finalizeMrnSchema } from "@/lib/schemas/material-return";
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
        items: {
          include: {
            materialVariant: true,
          },
        },
      },
    });

    if (!mrn) {
      return NextResponse.json(
        { success: false, error: { message: "Material Return Note not found" } },
        { status: 404 }
      );
    }

    if (mrn.status === "POSTED" || mrn.status === "FINALIZED") {
      return NextResponse.json(
        {
          success: false,
          error: { message: `MRN ${mrn.mrnNumber} has already been finalized and stock movements posted.` },
        },
        { status: 400 }
      );
    }

    if (mrn.items.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot finalize MRN with zero line items." } },
        { status: 400 }
      );
    }

    let input: any = {};
    try {
      const body = await req.json();
      const parsed = finalizeMrnSchema.safeParse(body);
      if (parsed.success) {
        input = parsed.data;
      }
    } catch {
      // Empty body is acceptable; defaults will apply
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const finalizedMRN = await db.$transaction(async (tx) => {
      const includeReturnDate =
        input.includeReturnDate !== undefined
          ? input.includeReturnDate
          : mrn.includeReturnDate;

      // 1. Process inventory movements and rental batch allocations for each returned material line
      for (const item of mrn.items) {
        const returnedQty = new Prisma.Decimal(item.returnedQty);
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const damagedQty = new Prisma.Decimal(item.damagedQty || 0);
        const missingQty = new Prisma.Decimal(item.missingQty || 0);

        // Check customer site stock balance
        const siteBalance = await tx.stockBalance.findFirst({
          where: {
            warehouseId: null,
            siteId: mrn.customerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            locationType: "CUSTOMER_SITE",
          },
        });

        const availableOnSite = siteBalance?.availableQty || new Prisma.Decimal(0);
        if (availableOnSite.lt(returnedQty)) {
          throw new Error(
            `Insufficient stock on customer site ${mrn.customerSite.siteName} for '${item.materialVariant.name}'. Held on site: ${availableOnSite.toString()}, Attempting to finalize return: ${returnedQty.toString()}`
          );
        }

        // Post Inventory Movement for Accepted Stock (Added to warehouse available rental pool)
        if (acceptedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: acceptedQty.toNumber(),
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "CUSTOMER_RETURN",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: mrn.customerSiteId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: mrn.receivingWarehouseId,
              customerId: mrn.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "GOOD",
              notes: `MRN ${mrn.mrnNumber}: Accepted ${acceptedQty.toString()} good units back into ${mrn.receivingWarehouse.name} stock.`,
            },
            actor,
            tx
          );
        }

        // Post Inventory Movement for Damaged Stock (Routed to warehouse damaged holding pool)
        if (damagedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: damagedQty.toNumber(),
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "CUSTOMER_RETURN",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: mrn.customerSiteId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: mrn.receivingWarehouseId,
              customerId: mrn.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "DAMAGED",
              notes: `MRN ${mrn.mrnNumber}: Received ${damagedQty.toString()} damaged units into warehouse quarantine.`,
            },
            actor,
            tx
          );
        }

        // Post Missing Stock Movement if applicable (Deducted from site, recorded as shortage)
        if (missingQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: missingQty.toNumber(),
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "MISSING",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: mrn.customerSiteId,
              destinationLocationType: "MISSING",
              customerId: mrn.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "SCRAP",
              notes: `MRN ${mrn.mrnNumber}: Recorded site shortage of ${missingQty.toString()} missing units.`,
            },
            actor,
            tx
          );
        }

        // Update Rental Tracking Batches: Return total units (accepted + damaged + missing) to stop daily accrual
      }

      // 2. Mark MRN as POSTED / FINALIZED
      const res = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          status: "POSTED",
          includeReturnDate,
          inspectionStatus: "COMPLETED",
          postedById: actor.id,
          postedAt: new Date(),
          remarks: input.remarks
            ? `${mrn.remarks ? mrn.remarks + " | " : ""}[Finalized: ${input.remarks}]`
            : mrn.remarks,
        },
        include: {
          customer: true,
          customerSite: true,
          receivingWarehouse: true,
          vehicleTrip: true,
          items: {
            include: { materialVariant: true },
          },
        },
      });

      // 3. Allocate returns to active rental batches (FIFO)
      await allocateReturnToBatches(mrn.id, tx);

      return res;
    }, { maxWait: 15000, timeout: 30000 });

    // 4. Log Audit Event after successful transaction commit
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "POST",
      module: "material_returns",
      entityType: "MaterialReturnNote",
      entityId: mrn.id,
      beforeState: { status: mrn.status },
      afterState: { status: "POSTED", postedAt: finalizedMRN.postedAt },
      notes: `MRN ${mrn.mrnNumber} finalized by ${actor.name}. Physical stock re-credited to ${mrn.receivingWarehouse.name} and rental return billing allocated.`,
    });

    // 4. Send WhatsApp Notification to customer if configured
    const customerMobile = mrn.customer.whatsappNumber || mrn.customer.primaryMobile;
    if (customerMobile) {
      try {
        const origin = req.headers.get("origin") || "https://ajay-enterprises-gwen-tech.vercel.app";
        const pdfUrl = `${origin}/api/v1/return-notes/${mrn.id}/print`;
        await sendWhatsAppNotification({
          recipientMobile: customerMobile,
          recipientName: mrn.customer.name,
          templateName: "MRN_CONFIRMATION",
          documentNumber: mrn.mrnNumber,
          documentType: "MaterialReturnNote",
          parameters: {
            customerName: mrn.customer.name,
            mrnNumber: mrn.mrnNumber,
            siteName: mrn.customerSite.siteName,
            returnDate: new Date(mrn.returnDate).toLocaleDateString("en-IN"),
          },
          pdfUrl,
        });
      } catch (err: any) {
        console.error(`[WhatsApp Notification Error] Failed to send MRN ${mrn.mrnNumber}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: finalizedMRN,
      message: `MRN ${mrn.mrnNumber} successfully finalized! Warehouse inventory re-credited and rental return calculations applied.`,
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
