import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { companyAddressSchema } from "@/lib/schemas/company";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const company = await db.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: { message: "Company profile missing" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = companyAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Invalid address format", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // If default billing is selected, unset other defaults
    if (data.isDefaultBilling) {
      await db.companyAddress.updateMany({
        where: { companyId: company.id },
        data: { isDefaultBilling: false },
      });
    }

    if (data.isDefaultCorrespondence) {
      await db.companyAddress.updateMany({
        where: { companyId: company.id },
        data: { isDefaultCorrespondence: false },
      });
    }

    const newAddress = await db.companyAddress.create({
      data: {
        companyId: company.id,
        addressType: data.addressType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        areaLocality: data.areaLocality || null,
        city: data.city,
        district: data.district,
        state: data.state,
        stateCode: data.stateCode,
        pinCode: data.pinCode,
        country: data.country || "India",
        isDefaultBilling: data.isDefaultBilling,
        isDefaultCorrespondence: data.isDefaultCorrespondence,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "COMPANY",
      entityType: "CompanyAddress",
      entityId: newAddress.id,
      afterState: newAddress,
      notes: `Added company address: ${newAddress.addressType} - ${newAddress.city}`,
    });

    return NextResponse.json({ success: true, data: newAddress, message: "Address added successfully" }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "Address ID required" } }, { status: 400 });
    }

    const existing = await db.companyAddress.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Address not found" } }, { status: 404 });
    }

    await db.companyAddress.delete({ where: { id } });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DELETE",
      module: "COMPANY",
      entityType: "CompanyAddress",
      entityId: id,
      beforeState: existing,
      notes: `Deleted company address: ${existing.addressType} - ${existing.city}`,
    });

    return NextResponse.json({ success: true, message: "Address deleted successfully" });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

