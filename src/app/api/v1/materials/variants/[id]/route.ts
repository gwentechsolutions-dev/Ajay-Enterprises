import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const { id } = await params;
    const variant = await db.materialVariant.findUnique({
      where: { id },
      include: {
        materialType: { include: { category: true } },
        preferredSupplier: true,
        rateHistory: {
          include: { changedBy: { select: { id: true, name: true, role: true } } },
          orderBy: { effectiveFrom: "desc" },
        },
        stockBalances: {
          include: {
            warehouse: { select: { id: true, name: true, warehouseCode: true } },
            site: { select: { id: true, siteName: true, siteCode: true } },
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { success: false, error: { message: "Material variant not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: variant });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "edit");

    const { id } = await params;
    const body = await req.json();

    const existing = await db.materialVariant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Material variant not found" } },
        { status: 404 }
      );
    }

    const updated = await db.materialVariant.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : existing.name,
        size: body.size !== undefined ? body.size : existing.size,
        description: body.description !== undefined ? body.description : existing.description,
        uom: body.uom !== undefined ? body.uom : existing.uom,
        purchaseCost: body.purchaseCost !== undefined && body.purchaseCost !== null ? new Prisma.Decimal(body.purchaseCost) : existing.purchaseCost,
        replacementValue: body.replacementValue !== undefined && body.replacementValue !== null ? new Prisma.Decimal(body.replacementValue) : existing.replacementValue,
        minimumStock: body.minimumStock !== undefined ? new Prisma.Decimal(body.minimumStock) : existing.minimumStock,
        preferredSupplierId: body.preferredSupplierId !== undefined ? (body.preferredSupplierId || null) : existing.preferredSupplierId,
        ownershipClassification: body.ownershipClassification !== undefined ? body.ownershipClassification : existing.ownershipClassification,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      },
      include: {
        materialType: { include: { category: true } },
        preferredSupplier: true,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "INVENTORY",
      entityType: "MaterialVariant",
      entityId: id,
      beforeState: { name: existing.name, active: existing.isActive },
      afterState: { name: updated.name, active: updated.isActive },
      notes: `Updated material variant ${updated.materialCode} (${updated.name})`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
