import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const warehouseId = req.nextUrl.searchParams.get("warehouseId");
    const siteId = req.nextUrl.searchParams.get("siteId");
    const materialVariantId = req.nextUrl.searchParams.get("materialVariantId");
    const locationType = req.nextUrl.searchParams.get("locationType");
    const ownershipType = req.nextUrl.searchParams.get("ownershipType");

    const where: Prisma.StockBalanceWhereInput = {
      ...(warehouseId ? { warehouseId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(materialVariantId ? { materialVariantId } : {}),
      ...(locationType ? { locationType } : {}),
      ...(ownershipType ? { ownershipType } : {}),
    };

    const balances = await db.stockBalance.findMany({
      where,
      include: {
        materialVariant: {
          include: { materialType: { include: { category: true } } },
        },
        warehouse: { select: { id: true, name: true, warehouseCode: true } },
        site: {
          select: {
            id: true,
            siteName: true,
            siteCode: true,
            customer: { select: { id: true, name: true, customerCode: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: balances });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
