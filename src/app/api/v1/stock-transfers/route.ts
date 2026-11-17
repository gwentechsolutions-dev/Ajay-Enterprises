import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createStockTransferNoteSchema } from "@/lib/schemas/stock-transfer";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_transfers", "view");

    const searchParams = req.nextUrl.searchParams;
    const sourceWarehouseId = searchParams.get("sourceWarehouseId") || undefined;
    const destinationWarehouseId = searchParams.get("destinationWarehouseId") || undefined;
    const status = searchParams.get("status") || undefined;

    const transfers = await db.stockTransferNote.findMany({
      where: {
        sourceWarehouseId,
        destinationWarehouseId,
        status: status as any,
      },
      include: {
        sourceWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        destinationWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
      },
      orderBy: { transferDate: "desc" },
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_transfers", "create");

    const body = await req.json();
    const parsed = createStockTransferNoteSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TRANSFER", message: "Source and destination warehouse cannot be the same" } },
        { status: 400 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const result = await db.$transaction(async (tx) => {
      const stnNumber = input.stnNumber || (await generateNextDocumentNumber("STN"));

      const stn = await tx.stockTransferNote.create({
        data: {
          stnNumber,
          sourceWarehouseId: input.sourceWarehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          status: "DRAFT",
          vehicleNumber: input.vehicleNumber,
          driverName: input.driverName,
          driverPhone: input.driverPhone,
          notes: input.remarks,
          items: {
            create: input.items.map((item) => ({
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType || "OWNED",
              dispatchedQty: new Prisma.Decimal(item.dispatchedQty),
              remarks: item.remarks,
            })),
          },
        },
        include: {
          items: { include: { materialVariant: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "CREATE",
        module: "STOCK_TRANSFER",
        entityType: "StockTransferNote",
        entityId: stn.id,
        ipAddress: actor.ipAddress,
        notes: `Created Stock Transfer Note ${stn.stnNumber} from ${stn.sourceWarehouse.name} to ${stn.destinationWarehouse.name}`,
      });

      return stn;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

