import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { materialVariantSchema } from "@/lib/schemas/material";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const search = req.nextUrl.searchParams.get("search");
    const materialTypeId = req.nextUrl.searchParams.get("materialTypeId");
    const categoryId = req.nextUrl.searchParams.get("categoryId");
    const ownership = req.nextUrl.searchParams.get("ownership");

    const where: Prisma.MaterialVariantWhereInput = {
      ...(materialTypeId ? { materialTypeId } : {}),
      ...(categoryId ? { materialType: { categoryId } } : {}),
      ...(ownership ? { ownershipClassification: ownership } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { materialCode: { contains: search, mode: "insensitive" } },
              { size: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const variants = await db.materialVariant.findMany({
      where,
      include: {
        materialType: { include: { category: true } },
        preferredSupplier: true,
        stockBalances: true,
      },
      orderBy: { materialCode: "asc" },
    });

    return NextResponse.json(
      { success: true, data: variants },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
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
    const parsed = materialVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Concurrency-safe automatic code generation if not provided or placeholder
    let materialCode = data.materialCode;
    if (!materialCode || materialCode.startsWith("AUTO") || materialCode === "NEW") {
      materialCode = await generateNextDocumentNumber("MAT");
    }

    // Check duplicate material code
    const existing = await db.materialVariant.findUnique({
      where: { materialCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: `Material code '${materialCode}' already exists.` } },
        { status: 409 }
      );
    }

    const defaultRate = new Prisma.Decimal(data.defaultRentalRate);

    // Create variant and initial rate history transactionally
    const newVariant = await db.$transaction(async (tx) => {
      const created = await tx.materialVariant.create({
        data: {
          materialCode,
          materialTypeId: data.materialTypeId,
          name: data.name,
          size: data.size,
          description: data.description || null,
          uom: data.uom || "Nos.",
          defaultRentalRate: defaultRate,
          purchaseCost: data.purchaseCost !== null && data.purchaseCost !== undefined ? new Prisma.Decimal(data.purchaseCost) : null,
          replacementValue: data.replacementValue !== null && data.replacementValue !== undefined ? new Prisma.Decimal(data.replacementValue) : null,
          minimumStock: new Prisma.Decimal(data.minimumStock || 0),
          preferredSupplierId: data.preferredSupplierId || null,
          ownershipClassification: data.ownershipClassification || "OWNED",
          isActive: data.isActive,
        },
        include: {
          materialType: { include: { category: true } },
          preferredSupplier: true,
        },
      });

      // Initial Rate History record
      await tx.materialRateHistory.create({
        data: {
          materialVariantId: created.id,
          rentalRate: defaultRate,
          previousRate: null,
          effectiveFrom: new Date(),
          reason: "Initial catalogue rental rate definition",
          changedById: session?.id || null,
        },
      });

      return created;
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "INVENTORY",
      entityType: "MaterialVariant",
      entityId: newVariant.id,
      afterState: { materialCode, name: data.name, rate: defaultRate.toString() },
      notes: `Created material variant ${materialCode} - ${data.name} (${data.size})`,
    });

    return NextResponse.json({ success: true, data: newVariant }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

