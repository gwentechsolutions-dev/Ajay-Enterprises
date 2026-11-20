import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "warehouse_portal", "view");

    const searchParams = req.nextUrl.searchParams;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    // 1. Pending POs awaiting receipt
    const pendingPOs = await db.purchaseOrder.findMany({
      where: {
        deliveryWarehouseId: warehouseId,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        items: { include: { materialVariant: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 10,
    });

    // 2. Pending Delivery Notes (Dispatches to prepare / load)
    const pendingDispatches = await db.deliveryNote.findMany({
      where: {
        sourceWarehouseId: warehouseId,
        status: { in: ["DRAFT", "DISPATCHED"] },
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true } },
        items: { include: { materialVariant: true } },
      },
      orderBy: [{ createdAt: "desc" }, { deliveryDate: "desc" }],
      take: 10,
    });

    // 3. Incoming Returns recently received or needing inspection
    const recentReturns = await db.materialReturnNote.findMany({
      where: {
        receivingWarehouseId: warehouseId,
      },
      include: {
        customer: { select: { id: true, name: true } },
        customerSite: { select: { id: true, siteName: true } },
        items: { include: { materialVariant: true } },
      },
      orderBy: [{ createdAt: "desc" }, { returnDate: "desc" }],
      take: 10,
    });

    // 4. Inter-Warehouse Transfers in transit
    const incomingTransfers = await db.stockTransferNote.findMany({
      where: {
        destinationWarehouseId: warehouseId,
        status: "DISPATCHED",
      },
      include: {
        sourceWarehouse: { select: { id: true, name: true } },
        items: { include: { materialVariant: true } },
      },
      orderBy: { transferDate: "desc" },
    });

    // 5. Damaged Stock items in this warehouse
    const damagedStockBalances = await db.stockBalance.findMany({
      where: {
        warehouseId: warehouseId || undefined,
        damagedQty: { gt: 0 },
      },
      include: {
        materialVariant: { select: { id: true, name: true, materialCode: true, size: true, uom: true } },
        warehouse: { select: { id: true, name: true } },
      },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        pendingPOs,
        pendingDispatches,
        recentReturns,
        incomingTransfers,
        damagedStockBalances,
        summary: {
          pendingPOCount: pendingPOs.length,
          pendingDispatchCount: pendingDispatches.length,
          recentReturnCount: recentReturns.length,
          incomingTransferCount: incomingTransfers.length,
          damagedStockCount: damagedStockBalances.length,
        },
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

