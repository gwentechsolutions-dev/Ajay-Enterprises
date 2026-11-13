import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { materialTypeSchema } from "@/lib/schemas/material";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const categoryId = req.nextUrl.searchParams.get("categoryId");

    const types = await db.materialType.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
        _count: { select: { variants: true } },
      },
      orderBy: { typeCode: "asc" },
    });

    return NextResponse.json({ success: true, data: types });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "create");

    const body = await req.json();
    const parsed = materialTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const { categoryId, typeCode, name, description, isActive } = parsed.data;

    const existing = await db.materialType.findUnique({
      where: { typeCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: "Material type code already exists." } },
        { status: 409 }
      );
    }

    const materialType = await db.materialType.create({
      data: { categoryId, typeCode, name, description, isActive },
      include: { category: true },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "INVENTORY",
      entityType: "MaterialType",
      entityId: materialType.id,
      afterState: { typeCode, name, categoryId },
      notes: `Created material type ${typeCode} - ${name}`,
    });

    return NextResponse.json({ success: true, data: materialType }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

