import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { supplierSchema } from "@/lib/schemas/supplier";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "suppliers", "view");

    const { id } = await params;
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        documents: true,
        materialVariants: true,
        movements: {
          include: { materialVariant: true },
          take: 50,
          orderBy: { movementDate: "desc" },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: { message: "Supplier not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: supplier });
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
    await requirePermission(session, "suppliers", "edit");

    const { id } = await params;
    const body = await req.json();
    const parsed = supplierSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Supplier not found" } },
        { status: 404 }
      );
    }

    const updated = await db.supplier.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        contactPerson: data.contactPerson !== undefined ? data.contactPerson : existing.contactPerson,
        primaryMobile: data.primaryMobile !== undefined ? data.primaryMobile : existing.primaryMobile,
        alternateMobile: data.alternateMobile !== undefined ? data.alternateMobile : existing.alternateMobile,
        email: data.email !== undefined ? data.email : existing.email,
        gstStatus: data.gstStatus !== undefined ? data.gstStatus : existing.gstStatus,
        gstin: data.gstin !== undefined ? (data.gstin ? data.gstin.toUpperCase() : null) : existing.gstin,
        pan: data.pan !== undefined ? (data.pan ? data.pan.toUpperCase() : null) : existing.pan,
        billingAddress: data.billingAddress !== undefined ? data.billingAddress : existing.billingAddress,
        state: data.state !== undefined ? data.state : existing.state,
        stateCode: data.stateCode !== undefined ? data.stateCode : existing.stateCode,
        pinCode: data.pinCode !== undefined ? data.pinCode : existing.pinCode,
        bankName: data.bankName !== undefined ? data.bankName : existing.bankName,
        accountNumber: data.accountNumber !== undefined ? data.accountNumber : existing.accountNumber,
        ifscCode: data.ifscCode !== undefined ? (data.ifscCode ? data.ifscCode.toUpperCase() : null) : existing.ifscCode,
        supplierType: data.supplierType !== undefined ? data.supplierType : existing.supplierType,
        creditTermsDays: data.creditTermsDays !== undefined ? data.creditTermsDays : existing.creditTermsDays,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        internalRemarks: data.internalRemarks !== undefined ? data.internalRemarks : existing.internalRemarks,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "SUPPLIERS",
      entityType: "Supplier",
      entityId: id,
      beforeState: { name: existing.name, status: existing.isActive },
      afterState: { name: updated.name, status: updated.isActive },
      notes: `Updated supplier ${updated.supplierCode} (${updated.name})`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
