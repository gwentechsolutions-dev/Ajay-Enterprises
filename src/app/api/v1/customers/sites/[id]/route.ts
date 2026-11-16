import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { customerSiteSchema } from "@/lib/schemas/customer";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "view");

    const { id } = await params;
    const site = await db.customerSite.findUnique({
      where: { id },
      include: {
        customer: true,
        contacts: true,
        documents: true,
        stockBalances: {
          include: {
            materialVariant: { include: { materialType: true } },
          },
        },
        sourceMovements: { take: 20, orderBy: { movementDate: "desc" } },
        destinationMovements: { take: 20, orderBy: { movementDate: "desc" } },
      },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: { message: "Construction site not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: site },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      }
    );
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
    await requirePermission(session, "customers", "edit");

    const { id } = await params;
    const body = await req.json();
    const parsed = customerSiteSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const existing = await db.customerSite.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Site not found" } },
        { status: 404 }
      );
    }

    const updated = await db.customerSite.update({
      where: { id },
      data: {
        siteName: data.siteName !== undefined ? data.siteName : existing.siteName,
        fullAddress: data.fullAddress !== undefined ? data.fullAddress : existing.fullAddress,
        state: data.state !== undefined ? data.state : existing.state,
        stateCode: data.stateCode !== undefined ? data.stateCode : existing.stateCode,
        district: data.district !== undefined ? data.district : existing.district,
        city: data.city !== undefined ? data.city : existing.city,
        pinCode: data.pinCode !== undefined ? data.pinCode : existing.pinCode,
        gpsLatitude: data.gpsLatitude !== undefined ? (data.gpsLatitude !== null ? new Prisma.Decimal(data.gpsLatitude) : null) : existing.gpsLatitude,
        gpsLongitude: data.gpsLongitude !== undefined ? (data.gpsLongitude !== null ? new Prisma.Decimal(data.gpsLongitude) : null) : existing.gpsLongitude,
        siteOwnerName: data.siteOwnerName !== undefined ? data.siteOwnerName : existing.siteOwnerName,
        siteOwnerContact: data.siteOwnerContact !== undefined ? data.siteOwnerContact : existing.siteOwnerContact,
        siteInCharge: data.siteInCharge !== undefined ? data.siteInCharge : existing.siteInCharge,
        siteContactDetails: data.siteContactDetails !== undefined ? data.siteContactDetails : existing.siteContactDetails,
        projectType: data.projectType !== undefined ? data.projectType : existing.projectType,
        deliveryInstructions: data.deliveryInstructions !== undefined ? data.deliveryInstructions : existing.deliveryInstructions,
        expectedClosingDate: data.expectedClosingDate !== undefined ? (data.expectedClosingDate ? new Date(data.expectedClosingDate) : null) : existing.expectedClosingDate,
        actualClosingDate: data.actualClosingDate !== undefined ? (data.actualClosingDate ? new Date(data.actualClosingDate) : null) : existing.actualClosingDate,
        status: data.status !== undefined ? data.status : existing.status,
        internalRemarks: data.internalRemarks !== undefined ? data.internalRemarks : existing.internalRemarks,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "CUSTOMERS",
      entityType: "CustomerSite",
      entityId: id,
      beforeState: { siteName: existing.siteName, status: existing.status },
      afterState: { siteName: updated.siteName, status: updated.status },
      notes: `Updated construction site ${updated.siteCode} (${updated.siteName})`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

