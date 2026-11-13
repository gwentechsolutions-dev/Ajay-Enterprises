import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { customerSiteSchema } from "@/lib/schemas/customer";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "view");

    const { id: customerId } = await params;
    const sites = await db.customerSite.findMany({
      where: { customerId },
      include: {
        contacts: true,
        documents: true,
        stockBalances: {
          include: { materialVariant: true },
        },
        _count: { select: { destinationMovements: true, sourceMovements: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sites });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "create");

    const { id: customerId } = await params;
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { message: "Customer not found" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = customerSiteSchema.safeParse({ ...body, customerId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    let siteCode = data.siteCode;
    if (!siteCode || siteCode.startsWith("AUTO") || siteCode === "NEW") {
      siteCode = await generateNextDocumentNumber("SITE");
    }

    const site = await db.customerSite.create({
      data: {
        siteCode,
        customerId,
        siteName: data.siteName,
        fullAddress: data.fullAddress,
        state: data.state,
        stateCode: data.stateCode,
        district: data.district,
        city: data.city,
        pinCode: data.pinCode,
        gpsLatitude: data.gpsLatitude !== null && data.gpsLatitude !== undefined ? new Prisma.Decimal(data.gpsLatitude) : null,
        gpsLongitude: data.gpsLongitude !== null && data.gpsLongitude !== undefined ? new Prisma.Decimal(data.gpsLongitude) : null,
        siteOwnerName: data.siteOwnerName || null,
        siteOwnerContact: data.siteOwnerContact || null,
        siteInCharge: data.siteInCharge || null,
        siteContactDetails: data.siteContactDetails || null,
        projectType: data.projectType || null,
        deliveryInstructions: data.deliveryInstructions || null,
        openingDate: data.openingDate ? new Date(data.openingDate) : new Date(),
        expectedClosingDate: data.expectedClosingDate ? new Date(data.expectedClosingDate) : null,
        status: data.status,
        internalRemarks: data.internalRemarks || null,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "CUSTOMERS",
      entityType: "CustomerSite",
      entityId: site.id,
      afterState: { siteCode, siteName: data.siteName, customerId },
      notes: `Created construction site ${siteCode} (${data.siteName}) for customer ${customer.customerCode}`,
    });

    return NextResponse.json({ success: true, data: site }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

