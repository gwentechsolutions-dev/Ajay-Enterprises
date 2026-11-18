import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { recordMrnInspectionSchema } from "@/lib/schemas/material-return";
import { validationErrorResponse } from "@/lib/api-validation";
import { postInventoryMovement } from "@/lib/inventory/ledger";

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
        items: true,
      },
    });

    if (!mrn) {
      return NextResponse.json(
        { success: false, error: { message: "Material Return Note not found" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = recordMrnInspectionSchema.safeParse(body);
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

    const updatedMRN = await db.$transaction(async (tx) => {
      // 1. Process each item inspection update while strictly preserving customer handover details
      for (const inspectedItem of input.items) {
        const existingItem = mrn.items.find(
          (it) => it.materialVariantId === inspectedItem.materialVariantId
        );

        if (!existingItem) {
          throw new Error(
            `Material variant '${inspectedItem.materialVariantId}' is not part of MRN ${mrn.mrnNumber}.`
          );
        }

        const returnedQty = new Prisma.Decimal(existingItem.returnedQty);
        const acceptedQty = new Prisma.Decimal(inspectedItem.acceptedQty);
        const damagedQty = new Prisma.Decimal(inspectedItem.damagedQty || 0);
        const missingQty = new Prisma.Decimal(inspectedItem.missingQty || 0);
        const rejectedQty = new Prisma.Decimal(inspectedItem.rejectedQty || 0);
        const receivedQty = acceptedQty.plus(damagedQty).plus(rejectedQty);

        if (acceptedQty.plus(damagedQty).plus(missingQty).plus(rejectedQty).gt(returnedQty)) {
          throw new Error(
            `Sum of accepted (${acceptedQty}), damaged (${damagedQty}), missing (${missingQty}), and rejected (${rejectedQty}) cannot exceed declared returned quantity (${returnedQty}) for item ${existingItem.id}.`
          );
        }

        // Check if there are newly classified damaged or missing units from previous pending state
        const prevAccepted = new Prisma.Decimal(existingItem.acceptedQty);
        const prevDamaged = new Prisma.Decimal(existingItem.damagedQty || 0);
        const prevMissing = new Prisma.Decimal(existingItem.missingQty || 0);

        // If previously all were placed into GOOD stock pending inspection, reclassify newly found damaged units
        const newlyDamaged = damagedQty.minus(prevDamaged);
        const newlyMissing = missingQty.minus(prevMissing);

        if (newlyDamaged.gt(0) && mrn.inspectionStatus === "PENDING") {
          // Reclassify from WAREHOUSE available to damaged pool
          await postInventoryMovement(
            {
              materialVariantId: existingItem.materialVariantId,
              quantity: newlyDamaged.toNumber(),
              uom: "Nos.",
              ownershipType: existingItem.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "DAMAGE",
              sourceLocationType: "WAREHOUSE",
              sourceWarehouseId: mrn.receivingWarehouseId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: mrn.receivingWarehouseId,
              customerId: mrn.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "DAMAGED",
              notes: `MRN ${mrn.mrnNumber} Inspection: Reclassified ${newlyDamaged.toString()} units to damaged holding.`,
            },
            actor,
            tx
          );
        }

        if (newlyMissing.gt(0) && mrn.inspectionStatus === "PENDING") {
          // Reclassify missing units out of warehouse stock
          await postInventoryMovement(
            {
              materialVariantId: existingItem.materialVariantId,
              quantity: newlyMissing.toNumber(),
              uom: "Nos.",
              ownershipType: existingItem.ownershipType as "OWNED" | "HIRED_IN",
              movementType: "MISSING",
              sourceLocationType: "WAREHOUSE",
              sourceWarehouseId: mrn.receivingWarehouseId,
              destinationLocationType: "MISSING",
              customerId: mrn.customerId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: mrn.id,
              condition: "SCRAP",
              notes: `MRN ${mrn.mrnNumber} Inspection: Verified shortage of ${newlyMissing.toString()} missing units.`,
            },
            actor,
            tx
          );
        }

        // Update item inspection fields
        await tx.materialReturnNoteItem.update({
          where: { id: existingItem.id },
          data: {
            acceptedQty,
            damagedQty,
            missingQty,
            rejectedQty,
            receivedQty,
            condition: inspectedItem.condition || "GOOD",
            inspectionRemarks: inspectedItem.inspectionRemarks || null,
          },
        });
      }

      // 2. Update MRN Header inspection fields (strictly preserving original customer handover details)
      const res = await tx.materialReturnNote.update({
        where: { id: mrn.id },
        data: {
          status: mrn.status === "POSTED" ? "POSTED" : "INSPECTION_COMPLETED",
          inspectionStatus: "COMPLETED",
          inspectedById: actor.id,
          inspectorName: input.inspectorName,
          inspectorDesignation: input.inspectorDesignation || null,
          inspectedAt: input.inspectedAt ? new Date(input.inspectedAt) : new Date(),
          inspectionRemarks: input.inspectionRemarks || null,
          customerAgreedDamage: input.customerAgreedDamage || false,
        },
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

      // 3. Audit Log
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
          inspectionStatus: "COMPLETED",
          inspectorName: input.inspectorName,
          customerAgreedDamage: input.customerAgreedDamage,
        },
        notes: `Recorded material inspection for MRN ${mrn.mrnNumber} by ${input.inspectorName}. Customer handover details preserved.`,
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updatedMRN,
      message: `Inspection for MRN ${mrn.mrnNumber} successfully recorded and verified.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
