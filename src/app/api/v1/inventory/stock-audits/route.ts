import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createStockAuditSchema } from "@/lib/schemas/inventory";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_audit", "view");

    const warehouseId = req.nextUrl.searchParams.get("warehouseId");
    const status = req.nextUrl.searchParams.get("status");

    const where: Prisma.StockAuditWhereInput = {
      ...(warehouseId ? { warehouseId } : {}),
      ...(status ? { status } : {}),
    };

    const audits = await db.stockAudit.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, warehouseCode: true } },
        conductedBy: { select: { id: true, name: true, userCode: true } },
        approvedBy: { select: { id: true, name: true, userCode: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: audits });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_audit", "create");

    const body = await req.json();
    const parsed = createStockAuditSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { warehouseId, title, remarks, auditDate } = parsed.data;

    // Check warehouse exists
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: { message: "Warehouse not found" } },
        { status: 404 }
      );
    }

    const auditNumber = await generateNextDocumentNumber("AUD");

    // Load expected stock balances for all active material variants in this warehouse
    const balances = await db.stockBalance.findMany({
      where: {
        warehouseId,
        locationType: "WAREHOUSE",
      },
      include: { materialVariant: true },
    });

    const audit = await db.$transaction(async (tx) => {
      const created = await tx.stockAudit.create({
        data: {
          auditNumber,
          warehouseId,
          title,
          auditDate: auditDate ? new Date(auditDate) : new Date(),
          status: "IN_PROGRESS",
          conductedById: session!.id,
          remarks: remarks || null,
        },
      });

      // Prepopulate expected quantities snapshot from current ledger
      if (balances.length > 0) {
        for (const b of balances) {
          await tx.stockAuditItem.create({
            data: {
              stockAuditId: created.id,
              materialVariantId: b.materialVariantId,
              ownershipType: b.ownershipType,
              expectedQty: b.availableQty,
              physicalQty: b.availableQty, // Initialized to expected until counted
              differenceQty: new Prisma.Decimal(0),
              condition: "GOOD",
              adjustmentStatus: "PENDING",
            },
          });
        }
      }

      return created;
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "STOCK_AUDIT",
      entityType: "StockAudit",
      entityId: audit.id,
      afterState: { auditNumber, title, warehouse: warehouse.name },
      notes: `Initiated physical stock audit ${auditNumber} for warehouse ${warehouse.name}`,
    });

    return NextResponse.json({ success: true, data: audit }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

