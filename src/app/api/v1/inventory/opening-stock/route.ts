import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { validationErrorResponse } from "@/lib/api-validation";

const openingStockBatchSchema = z.object({
  warehouseId: z.string().uuid("Warehouse is required"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  items: z.array(
    z.object({
      materialVariantId: z.string().uuid("Material variant is required"),
      quantity: z.coerce.number().positive("Quantity must be greater than zero"),
      condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
      unitCost: z.coerce.number().min(0).optional().nullable(),
      replacementValue: z.coerce.number().min(0).optional().nullable(),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, "At least one material item is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "create");

    const body = await req.json();
    const parsed = openingStockBatchSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { warehouseId, ownershipType, items } = parsed.data;

    // Check warehouse exists
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: { message: "Warehouse not found" } },
        { status: 404 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress,
    };

    const results = [];
    for (const item of items) {
      // Check if opening stock was already posted for this variant in this warehouse
      const existing = await db.inventoryMovement.findFirst({
        where: {
          movementType: "OPENING_STOCK",
          materialVariantId: item.materialVariantId,
          destinationWarehouseId: warehouseId,
          ownershipType,
          status: "POSTED",
        },
      });

      if (existing) {
        throw new Error(
          `Opening stock has already been posted for variant '${item.materialVariantId}' at warehouse '${warehouse.name}' (Ref: ${existing.movementNumber}). Duplicate opening stock is prevented.`
        );
      }

      const postRes = await postInventoryMovement(
        {
          materialVariantId: item.materialVariantId,
          quantity: item.quantity,
          uom: "Nos.",
          ownershipType,
          movementType: "OPENING_STOCK",
          sourceLocationType: "NONE",
          destinationLocationType: "WAREHOUSE",
          destinationWarehouseId: warehouseId,
          referenceDocumentType: "OPENING_STOCK",
          condition: item.condition,
          unitCost: item.unitCost,
          replacementValue: item.replacementValue,
          notes: item.remarks ? `Opening Stock: ${item.remarks}` : "Initial physical inventory opening stock entry",
        },
        actor
      );

      results.push(postRes);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully posted ${results.length} opening stock items for ${warehouse.name}.`,
      data: results,
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED")
      ? 401
      : error.message.startsWith("FORBIDDEN")
      ? 403
      : error.message.includes("already been posted")
      ? 409
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

