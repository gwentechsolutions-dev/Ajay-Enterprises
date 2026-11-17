import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { customerSchema } from "@/lib/schemas/customer";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "view");

    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        sites: {
          select: {
            id: true,
            siteCode: true,
            siteName: true,
            fullAddress: true,
            district: true,
            city: true,
            state: true,
            stateCode: true,
            pinCode: true,
            gpsLatitude: true,
            gpsLongitude: true,
            siteOwnerName: true,
            siteOwnerContact: true,
            siteInCharge: true,
            siteContactDetails: true,
            projectType: true,
            deliveryInstructions: true,
            status: true,
            createdAt: true,
            contacts: true,
            stockBalances: {
              select: {
                id: true,
                availableQty: true,
                ownershipType: true,
                materialVariant: {
                  select: {
                    id: true,
                    name: true,
                    materialCode: true,
                    uom: true,
                    size: true,
                    defaultRentalRate: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        contacts: {
          orderBy: { isPrimary: "desc" },
        },
        movements: {
          select: {
            id: true,
            movementNumber: true,
            movementType: true,
            movementDate: true,
            quantity: true,
            notes: true,
            materialVariant: {
              select: {
                id: true,
                name: true,
                materialCode: true,
                uom: true,
              },
            },
            sourceWarehouse: { select: { id: true, name: true } },
            destinationSite: { select: { id: true, siteName: true } },
            sourceSite: { select: { id: true, siteName: true } },
          },
          orderBy: { movementDate: "desc" },
          take: 25,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: { message: "Customer not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: customer },
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "edit");

    const { id } = await params;
    const body = await req.json();
    const parsed = customerSchema.partial().safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Customer not found" } },
        { status: 404 }
      );
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        customerType: data.customerType !== undefined ? data.customerType : existing.customerType,
        legalBusinessName: data.legalBusinessName !== undefined ? data.legalBusinessName : existing.legalBusinessName,
        primaryMobile: data.primaryMobile !== undefined ? data.primaryMobile : existing.primaryMobile,
        alternateMobile: data.alternateMobile !== undefined ? data.alternateMobile : existing.alternateMobile,
        whatsappNumber: data.whatsappNumber !== undefined ? data.whatsappNumber : existing.whatsappNumber,
        email: data.email !== undefined ? data.email : existing.email,
        pan: data.pan !== undefined ? (data.pan ? data.pan.toUpperCase() : null) : existing.pan,
        gstStatus: data.gstStatus !== undefined ? data.gstStatus : existing.gstStatus,
        gstin: data.gstin !== undefined ? (data.gstin ? data.gstin.toUpperCase() : null) : existing.gstin,
        billingAddress: data.billingAddress !== undefined ? data.billingAddress : existing.billingAddress,
        communicationAddress: data.communicationAddress !== undefined ? data.communicationAddress : existing.communicationAddress,
        state: data.state !== undefined ? data.state : existing.state,
        stateCode: data.stateCode !== undefined ? data.stateCode : existing.stateCode,
        pinCode: data.pinCode !== undefined ? data.pinCode : existing.pinCode,
        businessType: data.businessType !== undefined ? data.businessType : existing.businessType,
        creditLimit: data.creditLimit !== undefined ? (data.creditLimit !== null ? new Prisma.Decimal(data.creditLimit) : null) : existing.creditLimit,
        paymentTermsDays: data.paymentTermsDays !== undefined ? data.paymentTermsDays : existing.paymentTermsDays,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "CUSTOMERS",
      entityType: "Customer",
      entityId: id,
      beforeState: { name: existing.name, status: existing.isActive },
      afterState: { name: updated.name, status: updated.isActive },
      notes: `Updated customer ${updated.customerCode} (${updated.name})`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

