import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createMaterialReturnNoteSchema } from "@/lib/schemas/material-return";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";
import { allocateReturnToBatches } from "@/lib/rentals/tracking";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_returns", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const siteId = searchParams.get("customerSiteId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const returnNotes = await db.materialReturnNote.findMany({
      where: {
        customerId,
        customerSiteId: siteId,
        receivingWarehouseId: warehouseId,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true } },
        receivingWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        referenceDeliveryNote: { select: { id: true, dnNumber: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
        _count: { select: { evidences: true } },
      },
      orderBy: { returnDate: "desc" },
    });

    return NextResponse.json({ success: true, data: returnNotes });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_returns", "create");

    const body = await req.json();
    const parsed = createMaterialReturnNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const result = await db.$transaction(
      async (tx) => {
        const mrnNumber = input.mrnNumber || (await generateNextDocumentNumber("MRN", undefined, tx));

        // 1. Create MRN Header
      const mrn = await tx.materialReturnNote.create({
        data: {
          mrnNumber,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId,
          receivingWarehouseId: input.receivingWarehouseId,
          referenceDeliveryNoteId: input.referenceDeliveryNoteId || null,
          returnDate: input.returnDate ? new Date(input.returnDate) : new Date(),
          status: "POSTED",
          driverName: input.driverName,
          driverPhone: input.driverPhone,
          vehicleNumber: input.vehicleNumber,
          receiverName: input.receiverName,
          receiverPhone: input.receiverPhone,
          receiverSignatureUrl: input.receiverSignatureUrl,
          gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
          gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
          photoUrl: input.photoUrl,
          missingEvidenceReason: input.missingEvidenceReason,
          postedById: actor.id,
          postedAt: new Date(),
          remarks: input.remarks,
        },
      });

      // 2. Process each returned material line
      for (const item of input.items) {
        const returnedQty = new Prisma.Decimal(item.returnedQty);
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const damagedQty = new Prisma.Decimal(item.damagedQty || 0);
        const missingQty = new Prisma.Decimal(item.missingQty || 0);

        if (acceptedQty.plus(damagedQty).plus(missingQty).gt(returnedQty)) {
          throw new Error(
            `Sum of accepted (${acceptedQty}), damaged (${damagedQty}), and missing (${missingQty}) cannot exceed returned quantity (${returnedQty}).`
          );
        }

        // Check customer site stock balance
        const siteBalance = await tx.stockBalance.findFirst({
          where: {
            warehouseId: null,
            siteId: input.customerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            locationType: "CUSTOMER_SITE",
          },
        });

        const availableOnSite = siteBalance?.availableQty || new Prisma.Decimal(0);
        if (availableOnSite.lt(returnedQty)) {
          throw new Error(
            `Insufficient stock on customer site to process return. Available on site: ${availableOnSite.toString()}, Requested return: ${returnedQty.toString()}`
          );
        }

        // Create Item line
        await tx.materialReturnNoteItem.create({
          data: {
            mrnId: mrn.id,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            returnedQty,
            acceptedQty,
            damagedQty,
            missingQty,
            condition: item.condition,
            remarks: item.remarks,
          },
        });

        // 3. Post Inventory Movement for Accepted Stock (Added to warehouse available pool)
        if (acceptedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: acceptedQty.toNumber(),
              uom: "Nos.",
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "CUSTOMER_RETURN",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: input.customerSiteId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: input.receivingWarehouseId,
              customerId: input.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "GOOD",
              notes: `MRN ${mrnNumber}: Accepted ${acceptedQty.toString()} good units into warehouse.`,
            },
            actor,
            tx
          );
        }

        // 4. Post Inventory Movement for Damaged Stock (Routed to warehouse damaged pool, NOT available for rental)
        if (damagedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: damagedQty.toNumber(),
              uom: "Nos.",
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "CUSTOMER_RETURN",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: input.customerSiteId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: input.receivingWarehouseId,
              customerId: input.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "DAMAGED",
              notes: `MRN ${mrnNumber}: Received ${damagedQty.toString()} damaged units from customer site.`,
            },
            actor,
            tx
          );
        }

        // 5. Post Missing Stock Movement if applicable (Deducted from site, recorded as MISSING)
        if (missingQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: missingQty.toNumber(),
              uom: "Nos.",
              ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "MISSING",
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: input.customerSiteId,
              destinationLocationType: "MISSING",
              customerId: input.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "SCRAP",
              notes: `MRN ${mrnNumber}: Shortage/Missing ${missingQty.toString()} units on customer return.`,
            },
            actor,
            tx
          );
        }
      }

      // 6. Record Movement Evidence if photo provided
      if (input.photoUrl || input.receiverSignatureUrl || input.missingEvidenceReason) {
        await tx.movementEvidence.create({
          data: {
            documentType: "RETURN_NOTE",
            documentId: mrn.id,
            returnNoteId: mrn.id,
            photoUrl: input.photoUrl || "/placeholder-evidence.png",
            gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
            gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
            capturedById: actor.id,
            receiverName: input.receiverName,
            receiverPhone: input.receiverPhone,
            receiverSignatureUrl: input.receiverSignatureUrl,
            missingEvidenceReason: input.missingEvidenceReason,
          },
        });
      }

      // 7. Allocate returns to active rental batches (FIFO)
      await allocateReturnToBatches(mrn.id, tx);

      // 8. Audit log
      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "POST",
          module: "MATERIAL_RETURNS",
          entityType: "MaterialReturnNote",
          entityId: mrn.id,
          notes: `Posted Material Return Note ${mrnNumber} from customer site.`,
        },
        tx
      );

      return mrn;
    },
    { maxWait: 15000, timeout: 30000 }
  );

    // Notify customer via WhatsApp
    const customer = await db.customer.findUnique({ where: { id: input.customerId } });
    if (customer?.primaryMobile) {
      sendWhatsAppNotification({
        recipientMobile: customer.primaryMobile,
        recipientName: customer.name,
        templateName: "MRN_CONFIRMATION",
        documentNumber: result.mrnNumber,
        documentType: "MaterialReturnNote",
        parameters: {
          mrnNumber: result.mrnNumber,
          date: result.returnDate.toLocaleDateString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Material Return Note ${result.mrnNumber} posted successfully. Stock balances updated.`,
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

