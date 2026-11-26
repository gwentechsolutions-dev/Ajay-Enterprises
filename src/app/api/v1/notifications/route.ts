import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchBusinessAlerts } from "@/lib/reports/dashboard-service";
import { checkPermission } from "@/lib/permissions";
import { isRouteAllowedForRole } from "@/lib/portal-routing";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const roleUpper = (session.role || "").toUpperCase();
    const isDriverOnly = roleUpper === "DELIVERY_PERSONNEL" || roleUpper === "DELIVERY_DRIVER";

    // Drivers only receive their own assigned delivery & pickup notifications
    if (isDriverOnly) {
      const sessionName = session.name || "";
      const sessionMobile = session.mobile || undefined;

      const driver =
        sessionMobile || sessionName
          ? await db.driver.findFirst({
              where: {
                OR: [
                  ...(sessionMobile ? [{ mobileNumber: sessionMobile }] : []),
                  ...(sessionName ? [{ name: { equals: sessionName, mode: "insensitive" as const } }] : []),
                ],
              },
              select: { id: true },
            })
          : null;

      const dnConditions: any[] = [];
      if (driver) dnConditions.push({ tripDeliveryNotes: { some: { trip: { driverId: driver.id } } } });
      if (sessionName) dnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
      if (sessionMobile) dnConditions.push({ driverPhone: sessionMobile });

      const mrnConditions: any[] = [];
      if (driver) mrnConditions.push({ vehicleTrip: { driverId: driver.id } });
      if (sessionName) mrnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
      if (sessionMobile) mrnConditions.push({ driverPhone: sessionMobile });

      const [assignedDeliveries, assignedPickups] = await Promise.all([
        dnConditions.length > 0
          ? db.deliveryNote.findMany({
              where: { status: "DISPATCHED", OR: dnConditions },
              select: {
                id: true,
                dnNumber: true,
                deliveryDate: true,
                customer: { select: { name: true } },
                customerSite: { select: { siteName: true } },
              },
              take: 5,
              orderBy: { deliveryDate: "asc" },
            })
          : Promise.resolve([]),
        mrnConditions.length > 0
          ? db.materialReturnNote.findMany({
              where: {
                status: { in: ["ASSIGNED", "EN_ROUTE", "ARRIVED_AT_SITE", "PICKUP_IN_PROGRESS"] },
                OR: mrnConditions,
              },
              select: {
                id: true,
                mrnNumber: true,
                returnDate: true,
                status: true,
                customer: { select: { name: true } },
                customerSite: { select: { siteName: true } },
              },
              take: 5,
              orderBy: { returnDate: "asc" },
            })
          : Promise.resolve([]),
      ]);

      const driverNotifications = [
        ...assignedDeliveries.map((dn) => ({
          id: `drv-dn-${dn.id}`,
          type: "ASSIGNED_DELIVERY",
          title: `Assigned Delivery: ${dn.dnNumber}`,
          description: `Deliver materials to ${dn.customer.name} (${dn.customerSite.siteName}) and capture site proof.`,
          severity: "INFO" as const,
          href: "/delivery-portal",
          timestamp: dn.deliveryDate.toISOString(),
        })),
        ...assignedPickups.map((mrn) => ({
          id: `drv-mrn-${mrn.id}`,
          type: "ASSIGNED_PICKUP",
          title: `Assigned Return Pickup: ${mrn.mrnNumber}`,
          description: `Collect return materials from ${mrn.customer.name} (${mrn.customerSite.siteName}) — Status: ${mrn.status.replace(/_/g, " ")}.`,
          severity: "WARNING" as const,
          href: "/delivery-portal",
          timestamp: mrn.returnDate.toISOString(),
        })),
      ];

      return NextResponse.json(
        {
          success: true,
          data: {
            notifications: driverNotifications,
            total: driverNotifications.length,
          },
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // Non-driver roles: load alerts & permission-gated operational notifications
    const [alerts, canAuthorizeDispatch, canApprovePO] = await Promise.all([
      fetchBusinessAlerts(),
      Promise.all([
        checkPermission(session.role, "delivery_notes", "create"),
        checkPermission(session.role, "delivery_notes", "approve"),
      ]).then((res) => res.some(Boolean) && isRouteAllowedForRole(session.role, "/delivery-notes")),
      Promise.all([
        checkPermission(session.role, "purchases", "approve"),
        checkPermission(session.role, "purchases", "edit"),
      ]).then((res) => res.some(Boolean) && isRouteAllowedForRole(session.role, "/purchases")),
    ]);

    const [draftDeliveries, submittedPOs] = await Promise.all([
      canAuthorizeDispatch
        ? db.deliveryNote.findMany({
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
          })
        : Promise.resolve([]),
      canApprovePO
        ? db.purchaseOrder.findMany({
            where: { status: "SUBMITTED" },
            select: {
              id: true,
              poNumber: true,
              orderDate: true,
              supplier: { select: { name: true } },
            },
            take: 3,
            orderBy: { orderDate: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const pendingDispatches = draftDeliveries.map((dn) => ({
      id: `dn-draft-${dn.id}`,
      type: "PENDING_DISPATCH",
      title: `Draft Delivery Note: ${dn.dnNumber}`,
      description: `Material dispatch to ${dn.customer.name} (${dn.customerSite.siteName}) is pending dispatch authorization.`,
      severity: "INFO" as const,
      href: "/delivery-notes",
      timestamp: dn.deliveryDate.toISOString(),
    }));

    const pendingPOs = submittedPOs.map((po) => ({
      id: `po-sub-${po.id}`,
      type: "PO_APPROVAL",
      title: `PO Awaiting Approval: ${po.poNumber}`,
      description: `Vendor order with ${po.supplier.name} is awaiting managerial approval for warehouse receipt.`,
      severity: "WARNING" as const,
      href: "/purchases",
      timestamp: po.orderDate.toISOString(),
    }));

    // Strictly filter all notifications to routes the user's role is permitted to access
    const notifications = [
      ...alerts
        .filter((a) => isRouteAllowedForRole(session.role, a.href))
        .map((a) => ({
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
          "Cache-Control": "private, no-store",
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
