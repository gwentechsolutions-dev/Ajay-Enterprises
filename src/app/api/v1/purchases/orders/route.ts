import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createPurchaseOrderSchema } from "@/lib/schemas/purchase";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "view");

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const orders = await db.purchaseOrder.findMany({
      where: {
        status,
        supplierId,
        deliveryWarehouseId: warehouseId,
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true, primaryMobile: true } },
        branch: { select: { id: true, name: true, branchCode: true } },
        deliveryWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
        _count: { select: { grns: true } },
      },
      orderBy: { orderDate: "desc" },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "create");

    const body = await req.json();
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const poNumber = input.poNumber || (await generateNextDocumentNumber("PO"));

    // Calculate itemized totals safely using Prisma Decimal
    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);

    const calculatedItems = input.items.map((it) => {
      const qty = new Prisma.Decimal(it.quantity);
      const rate = new Prisma.Decimal(it.unitRate);
      const baseAmount = qty.times(rate);

      const discPct = new Prisma.Decimal(it.discountPercent || 0);
      const discAmt = baseAmount.times(discPct).dividedBy(100);
      const taxable = baseAmount.minus(discAmt);

      const taxPct = new Prisma.Decimal(it.taxPercent || 18);
      const taxAmt = taxable.times(taxPct).dividedBy(100);
      const lineTotal = taxable.plus(taxAmt);

      subtotal = subtotal.plus(taxable);
      taxTotal = taxTotal.plus(taxAmt);
      discountTotal = discountTotal.plus(discAmt);

      return {
        materialVariantId: it.materialVariantId,
        quantity: qty,
        unitRate: rate,
        discountPercent: discPct,
        discountAmount: discAmt,
        taxPercent: taxPct,
        taxAmount: taxAmt,
        totalAmount: lineTotal,
      };
    });

    const grandTotal = subtotal.plus(taxTotal);

    const po = await db.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: input.supplierId,
        branchId: input.branchId,
        deliveryWarehouseId: input.deliveryWarehouseId,
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
        status: "DRAFT",
        subtotal,
        taxAmount: taxTotal,
        discountAmount: discountTotal,
        grandTotal,
        notes: input.notes,
        termsAndConditions: input.termsAndConditions,
        createdById: session!.id,
        items: {
          create: calculatedItems,
        },
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      action: "CREATE",
      module: "PURCHASES",
      entityType: "PurchaseOrder",
      entityId: po.id,
      afterState: { poNumber, grandTotal: grandTotal.toString(), supplierId: input.supplierId },
      notes: `Created Purchase Order ${poNumber} for ₹${grandTotal.toFixed(2)}`,
    });

    return NextResponse.json({ success: true, data: po }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

