import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchBusinessAlerts } from "@/lib/reports/dashboard-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    // 1. Core Business Alerts (Overdue Invoices, Uninvoiced Statements, Damage Assessments, Fleet Expiries, etc.)
    const alerts = await fetchBusinessAlerts();

    // 2. Operational Pending Dispatches (Delivery Notes in DRAFT)
    const draftDeliveries = await db.deliveryNote.findMany({
      where: { status: "DRAFT" },
      select: {
        id: true,
        dnNumber: true,
        deliveryDate: true,
        customer: { select: { name: true } },
        customerSite: { select: { siteName: true } },
      },
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    const pendingDispatches = draftDeliveries.map((dn) => ({
      id: `dn-draft-${dn.id}`,
      type: "PENDING_DISPATCH",
      title: `Draft Delivery Note: ${dn.dnNumber}`,
      description: `Material dispatch to ${dn.customer.name} (${dn.customerSite.siteName}) is pending dispatch authorization.`,
      severity: "INFO" as const,
      href: "/delivery-notes",
      timestamp: dn.deliveryDate.toISOString(),
    }));

    // 3. Purchase Orders Awaiting Approval
    const submittedPOs = await db.purchaseOrder.findMany({
      where: { status: "SUBMITTED" },
      select: {
        id: true,
        poNumber: true,
        orderDate: true,
        supplier: { select: { name: true } },
      },
      take: 3,
      orderBy: { orderDate: "desc" },
    });

    const pendingPOs = submittedPOs.map((po) => ({
      id: `po-sub-${po.id}`,
      type: "PO_APPROVAL",
      title: `PO Awaiting Approval: ${po.poNumber}`,
      description: `Vendor order with ${po.supplier.name} is awaiting managerial approval for warehouse receipt.`,
      severity: "WARNING" as const,
      href: "/purchases",
      timestamp: po.orderDate.toISOString(),
    }));

    // Combine all notification items
    const notifications = [
      ...alerts.map((a) => ({
        ...a,
        timestamp: new Date().toISOString(),
      })),
      ...pendingDispatches,
      ...pendingPOs,
    ];

    return NextResponse.json(
      {
        success: true,
        data: {
          notifications,
          total: notifications.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to load notifications" } },
      { status: 500 }
    );
  }
}
