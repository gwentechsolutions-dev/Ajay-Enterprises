import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createMovementSchema } from "@/lib/schemas/inventory";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "movement", "view");

    const search = req.nextUrl.searchParams.get("search");
    const movementType = req.nextUrl.searchParams.get("movementType");
    const materialVariantId = req.nextUrl.searchParams.get("materialVariantId");
    const ownershipType = req.nextUrl.searchParams.get("ownershipType");
    const warehouseId = req.nextUrl.searchParams.get("warehouseId");
    const siteId = req.nextUrl.searchParams.get("siteId");
    const status = req.nextUrl.searchParams.get("status");
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    const where: Prisma.InventoryMovementWhereInput = {
      ...(movementType ? { movementType } : {}),
      ...(materialVariantId ? { materialVariantId } : {}),
      ...(ownershipType ? { ownershipType } : {}),
      ...(status ? { status } : {}),
      ...(warehouseId
        ? {
            OR: [
              { sourceWarehouseId: warehouseId },
              { destinationWarehouseId: warehouseId },
            ],
          }
        : {}),
      ...(siteId
        ? {
            OR: [{ sourceSiteId: siteId }, { destinationSiteId: siteId }],
          }
        : {}),
      ...(startDate || endDate
        ? {
            movementDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { movementNumber: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              { referenceDocumentId: { contains: search, mode: "insensitive" } },
              { materialVariant: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const movements = await db.inventoryMovement.findMany({
      where,
      include: {
        materialVariant: {
          include: { materialType: { include: { category: true } } },
        },
        sourceWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        destinationWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        sourceSite: { select: { id: true, siteName: true, siteCode: true } },
        destinationSite: { select: { id: true, siteName: true, siteCode: true } },
        customer: { select: { id: true, name: true, customerCode: true } },
        supplier: { select: { id: true, name: true, supplierCode: true } },
        responsibleUser: { select: { id: true, name: true, userCode: true, role: true } },
      },
      orderBy: { movementDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: movements });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "movement", "create");

    const body = await req.json();
    const parsed = createMovementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress,
    };

    const result = await postInventoryMovement(parsed.data, actor);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED")
      ? 401
      : error.message.startsWith("FORBIDDEN")
      ? 403
      : error.message.includes("Insufficient stock")
      ? 400
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

