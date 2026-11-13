import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { companyProfileSchema } from "@/lib/schemas/company";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "view");

    let company = await db.companyProfile.findFirst({
      include: {
        addresses: true,
        bankAccounts: true,
        signatories: true,
        documents: true,
      },
    });

    if (!company) {
      // Create initial company record if missing
      company = await db.companyProfile.create({
        data: {
          legalName: "AJAY ENTERPRISES",
          tradeName: "AJAY ENTERPRISES",
          entityType: "PROPRIETORSHIP",
          businessCategory: "Construction Centering Material Rental & Formwork Equipment",
          primaryMobile: "",
          whatsappNumber: "",
          officialEmail: "",
          contactPerson: "",
          isOnboardingComplete: false,
        },
        include: {
          addresses: true,
          bankAccounts: true,
          signatories: true,
          documents: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: company });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const body = await req.json();
    const parsed = companyProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Company profile validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    let company = await db.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: { message: "Company profile not found" } }, { status: 404 });
    }

    const data = parsed.data;

    const updated = await db.companyProfile.update({
      where: { id: company.id },
      data: {
        legalName: data.legalName,
        tradeName: data.tradeName,
        entityType: data.entityType,
        establishmentDate: data.establishmentDate ? new Date(data.establishmentDate) : null,
        businessCategory: data.businessCategory || null,
        description: data.description || null,
        website: data.website || null,
        primaryMobile: data.primaryMobile,
        alternateMobile: data.alternateMobile || null,
        whatsappNumber: data.whatsappNumber,
        officialEmail: data.officialEmail,
        alternateEmail: data.alternateEmail || null,
        contactPerson: data.contactPerson,
        telephone: data.telephone || null,
        pan: data.pan ? data.pan.toUpperCase() : null,
        gstin: data.gstin ? data.gstin.toUpperCase() : null,
        gstLegalName: data.gstLegalName || null,
        gstTradeName: data.gstTradeName || null,
        gstType: data.gstType,
        gstState: data.gstState || null,
        gstStateCode: data.gstStateCode || null,
        gstRegistrationDate: data.gstRegistrationDate ? new Date(data.gstRegistrationDate) : null,
        logoAssetUrl: data.logoAssetUrl || null,
        isOnboardingComplete: true,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "COMPANY",
      entityType: "CompanyProfile",
      entityId: updated.id,
      beforeState: company,
      afterState: updated,
      notes: "Updated AJAY ENTERPRISES Company Profile details",
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Company profile updated successfully",
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

