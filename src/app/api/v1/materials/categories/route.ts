import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { materialCategorySchema } from "@/lib/schemas/material";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const categories = await db.materialCategory.findMany({
      include: {
        _count: { select: { types: true } },
      },
      orderBy: { categoryCode: "asc" },
    });

    return NextResponse.json({ success: true, data: categories });
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
    const parsed = materialCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const { categoryCode, name, description, isActive } = parsed.data;

    const existing = await db.materialCategory.findUnique({
      where: { categoryCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: "Category code already exists." } },
        { status: 409 }
      );
    }

    const category = await db.materialCategory.create({
      data: { categoryCode, name, description, isActive },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "INVENTORY",
      entityType: "MaterialCategory",
      entityId: category.id,
      afterState: { categoryCode, name },
      notes: `Created material category ${categoryCode} - ${name}`,
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
