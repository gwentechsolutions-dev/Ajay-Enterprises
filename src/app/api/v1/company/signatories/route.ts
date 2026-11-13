import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { signatorySchema } from "@/lib/schemas/company";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "view");

    const signatories = await db.signatoryAsset.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ success: true, data: signatories });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const company = await db.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: { message: "Company profile missing" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = signatorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Invalid signatory details", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    if (data.isDefault) {
      await db.signatoryAsset.updateMany({
        where: { companyId: company.id },
        data: { isDefault: false },
      });
    }

    const newSignatory = await db.signatoryAsset.create({
      data: {
        companyId: company.id,
        name: data.name,
        designation: data.designation,
        signatureAssetUrl: data.signatureAssetUrl,
        stampAssetUrl: data.stampAssetUrl || null,
        isDefault: data.isDefault,
        isActive: data.isActive,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "COMPANY",
      entityType: "SignatoryAsset",
      entityId: newSignatory.id,
      afterState: newSignatory,
      notes: `Added authorised signatory: ${newSignatory.name} (${newSignatory.designation})`,
    });

    return NextResponse.json({ success: true, data: newSignatory, message: "Signatory added successfully" }, { status: 201 });
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
      return NextResponse.json({ success: false, error: { message: "Signatory ID required" } }, { status: 400 });
    }

    const existing = await db.signatoryAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Signatory not found" } }, { status: 404 });
    }

    await db.signatoryAsset.delete({ where: { id } });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DELETE",
      module: "COMPANY",
      entityType: "SignatoryAsset",
      entityId: id,
      beforeState: existing,
      notes: `Deleted signatory: ${existing.name}`,
    });

    return NextResponse.json({ success: true, message: "Signatory deleted successfully" });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

