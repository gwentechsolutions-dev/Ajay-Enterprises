import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { supplierSchema } from "@/lib/schemas/supplier";
import { validationErrorResponse } from "@/lib/api-validation";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "suppliers", "view");

    const search = req.nextUrl.searchParams.get("search");
    const supplierType = req.nextUrl.searchParams.get("supplierType");
    const gstStatus = req.nextUrl.searchParams.get("gstStatus");

    const where: Prisma.SupplierWhereInput = {
      ...(supplierType ? { supplierType } : {}),
      ...(gstStatus ? { gstStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { supplierCode: { contains: search, mode: "insensitive" } },
              { contactPerson: { contains: search, mode: "insensitive" } },
              { primaryMobile: { contains: search, mode: "insensitive" } },
              { gstin: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: {
          select: { documents: true, materialVariants: true, movements: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "suppliers", "create");

    const body = await req.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;

    let supplierCode = data.supplierCode;
    if (!supplierCode || supplierCode.startsWith("AUTO") || supplierCode === "NEW") {
      supplierCode = await generateNextDocumentNumber("SUP");
    }

    const existing = await db.supplier.findUnique({
      where: { supplierCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: `Supplier code '${supplierCode}' already exists.` } },
        { status: 409 }
      );
    }

    const supplier = await db.supplier.create({
      data: {
        supplierCode,
        name: data.name,
        contactPerson: data.contactPerson,
        primaryMobile: data.primaryMobile,
        alternateMobile: data.alternateMobile || null,
        email: data.email || null,
        gstStatus: data.gstStatus,
        gstin: data.gstin ? data.gstin.toUpperCase() : null,
        pan: data.pan ? data.pan.toUpperCase() : null,
        billingAddress: data.billingAddress,
        state: data.state,
        stateCode: data.stateCode,
        pinCode: data.pinCode,
        bankName: data.bankName || null,
        accountNumber: data.accountNumber || null,
        ifscCode: data.ifscCode ? data.ifscCode.toUpperCase() : null,
        supplierType: data.supplierType,
        openingBalance: new Prisma.Decimal(data.openingBalance || 0),
        creditTermsDays: data.creditTermsDays || 30,
        isActive: data.isActive,
        internalRemarks: data.internalRemarks || null,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "SUPPLIERS",
      entityType: "Supplier",
      entityId: supplier.id,
      afterState: { supplierCode, name: data.name },
      notes: `Created supplier ${supplierCode} - ${data.name}`,
    });

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

