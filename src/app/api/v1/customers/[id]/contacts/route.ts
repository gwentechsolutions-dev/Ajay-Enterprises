import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { contactPersonSchema } from "@/lib/schemas/customer";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "customers", "create");

    const { id: customerId } = await params;
    const body = await req.json();

    const parsed = contactPersonSchema.safeParse({ ...body, customerId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // If marked primary, unset other primary contacts for this customer
    if (data.isPrimary) {
      await db.contactPerson.updateMany({
        where: { customerId, siteId: data.siteId || null },
        data: { isPrimary: false },
      });
    }

    const contact = await db.contactPerson.create({
      data: {
        customerId,
        siteId: data.siteId || null,
        name: data.name,
        mobile: data.mobile,
        alternateMobile: data.alternateMobile || null,
        email: data.email || null,
        designation: data.designation,
        contactType: data.contactType,
        isPrimary: data.isPrimary,
        isActive: data.isActive,
        canReceiveDeliveryNotes: data.canReceiveDeliveryNotes,
        canAcknowledgeDeliveries: data.canAcknowledgeDeliveries,
        canReceiveReturnNotes: data.canReceiveReturnNotes,
        canReceiveInvoices: data.canReceiveInvoices,
        canReceivePaymentReminders: data.canReceivePaymentReminders,
        canReceiveWhatsApp: data.canReceiveWhatsApp,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "CUSTOMERS",
      entityType: "ContactPerson",
      entityId: contact.id,
      afterState: { name: contact.name, designation: contact.designation },
      notes: `Created contact ${contact.name} (${contact.designation}) for customer ${customerId}`,
    });

    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

