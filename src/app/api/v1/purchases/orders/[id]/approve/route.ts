import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "approve");
    const { id } = await params;

    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!po) {
      return NextResponse.json({ success: false, error: { message: "Purchase Order not found" } }, { status: 404 });
    }

    if (po.status !== "DRAFT" && po.status !== "SUBMITTED") {
      return NextResponse.json(
        { success: false, error: { message: `Cannot approve PO in status '${po.status}'.` } },
        { status: 400 }
      );
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session!.id,
        approvedAt: new Date(),
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      action: "APPROVE",
      module: "PURCHASES",
      entityType: "PurchaseOrder",
      entityId: po.id,
      notes: `Approved Purchase Order ${po.poNumber}`,
    });

    // Notify supplier via WhatsApp (non-blocking)
    if (po.supplier?.primaryMobile) {
      sendWhatsAppNotification({
        recipientMobile: po.supplier.primaryMobile,
        recipientName: po.supplier.name,
        templateName: "PO_APPROVED",
        documentNumber: po.poNumber,
        documentType: "PurchaseOrder",
        parameters: {
          poNumber: po.poNumber,
          grandTotal: po.grandTotal.toString(),
        },
      });
    }

    return NextResponse.json({ success: true, data: updated, message: `PO ${po.poNumber} approved.` });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

