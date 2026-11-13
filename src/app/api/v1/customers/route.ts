import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { customerSchema } from "@/lib/schemas/customer";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "view");

    const search = req.nextUrl.searchParams.get("search");
    const gstStatus = req.nextUrl.searchParams.get("gstStatus");
    const customerType = req.nextUrl.searchParams.get("customerType");

    const where: Prisma.CustomerWhereInput = {
      ...(gstStatus ? { gstStatus } : {}),
      ...(customerType ? { customerType } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { customerCode: { contains: search, mode: "insensitive" } },
              { primaryMobile: { contains: search, mode: "insensitive" } },
              { gstin: { contains: search, mode: "insensitive" } },
              { pan: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: {
          select: { sites: true, contacts: true, documents: true, movements: true },
        },
        sites: {
          select: { id: true, siteCode: true, siteName: true, status: true, city: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "create");

    const body = await req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Automatic code generation if not provided or placeholder
    let customerCode = data.customerCode;
    if (!customerCode || customerCode.startsWith("AUTO") || customerCode === "NEW") {
      customerCode = await generateNextDocumentNumber("CUST");
    }

    // Check duplicate customer code
    const existingCode = await db.customer.findUnique({
      where: { customerCode },
    });
    if (existingCode) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: `Customer code '${customerCode}' already exists.` } },
        { status: 409 }
      );
    }

    const customer = await db.customer.create({
      data: {
        customerCode,
        name: data.name,
        customerType: data.customerType,
        legalBusinessName: data.legalBusinessName || null,
        primaryMobile: data.primaryMobile,
        alternateMobile: data.alternateMobile || null,
        whatsappNumber: data.whatsappNumber || null,
        email: data.email || null,
        pan: data.pan ? data.pan.toUpperCase() : null,
        gstStatus: data.gstStatus,
        gstin: data.gstin ? data.gstin.toUpperCase() : null,
        billingAddress: data.billingAddress,
        communicationAddress: data.communicationAddress || null,
        state: data.state,
        stateCode: data.stateCode,
        pinCode: data.pinCode || null,
        businessType: data.businessType || null,
        creditLimit: data.creditLimit !== null && data.creditLimit !== undefined ? new Prisma.Decimal(data.creditLimit) : null,
        paymentTermsDays: data.paymentTermsDays || 30,
        openingBalance: new Prisma.Decimal(data.openingBalance || 0),
        isActive: data.isActive,
        notes: data.notes || null,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "CUSTOMERS",
      entityType: "Customer",
      entityId: customer.id,
      afterState: { customerCode, name: data.name },
      notes: `Created customer ${customerCode} - ${data.name}`,
    });

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

