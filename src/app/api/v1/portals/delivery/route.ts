import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_portal", "view");

    // Filter by assigned driver phone or name if user is DELIVERY_PERSONNEL
    const isDriverOnly = session?.role === "DELIVERY_PERSONNEL";
    const sessionName = session?.name || "";
    const sessionMobile = session?.mobile || undefined;

    // DeliveryNote uses tripDeliveryNotes -> trip -> driver, plus driverName and driverPhone
    const dnConditions: any[] = [];
    if (sessionName) {
      dnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
      dnConditions.push({
        tripDeliveryNotes: {
          some: {
            trip: {
              driver: { name: { contains: sessionName, mode: "insensitive" } },
            },
          },
        },
      });
    }
    if (sessionMobile) {
      dnConditions.push({ driverPhone: sessionMobile });
      dnConditions.push({
        tripDeliveryNotes: {
          some: {
            trip: {
              driver: { mobileNumber: sessionMobile },
            },
          },
        },
      });
    }
    const dnDriverFilter = isDriverOnly && dnConditions.length > 0 ? { OR: dnConditions } : {};

    // MaterialReturnNote uses vehicleTrip -> driver, plus driverName and driverPhone
    const mrnConditions: any[] = [];
    if (sessionName) {
      mrnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
      mrnConditions.push({
        vehicleTrip: {
          driver: { name: { contains: sessionName, mode: "insensitive" } },
        },
      });
    }
    if (sessionMobile) {
      mrnConditions.push({ driverPhone: sessionMobile });
      mrnConditions.push({
        vehicleTrip: {
          driver: { mobileNumber: sessionMobile },
        },
      });
    }
    const mrnDriverFilter = isDriverOnly && mrnConditions.length > 0 ? { OR: mrnConditions } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Active Dispatched Deliveries (Awaiting Delivery & Receiver Sign-off)
    const activeDeliveries = await db.deliveryNote.findMany({
      where: {
        status: "DISPATCHED",
        ...dnDriverFilter,
      },
      include: {
        customer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
        customerSite: { select: { id: true, siteName: true, fullAddress: true, siteContactDetails: true, siteInCharge: true, gpsLatitude: true, gpsLongitude: true } },
        sourceWarehouse: { select: { id: true, name: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, uom: true, materialCode: true } },
          },
        },
        evidences: true,
      },
      orderBy: { deliveryDate: "asc" },
    });

    // 2. Deliveries Completed Today
    const completedToday = await db.deliveryNote.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: { gte: startOfToday },
        ...dnDriverFilter,
      },
      include: {
        customer: { select: { id: true, name: true } },
        customerSite: { select: { id: true, siteName: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, uom: true } },
          },
        },
      },
      orderBy: { deliveredAt: "desc" },
    });

    // 3. Active Material Pickups / Returns (Assigned to driver, en-route, arrived at site, or returning to yard)
    const activePickups = await db.materialReturnNote.findMany({
      where: {
        status: {
          in: [
            "ASSIGNED",
            "EN_ROUTE",
            "ARRIVED_AT_SITE",
            "PICKUP_IN_PROGRESS",
            "PICKUP_COMPLETED",
            "IN_TRANSIT",
            "ARRIVED_AT_YARD",
          ],
        },
        ...mrnDriverFilter,
      },
      include: {
        customer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
        customerSite: { select: { id: true, siteName: true, fullAddress: true, siteContactDetails: true, siteInCharge: true, gpsLatitude: true, gpsLongitude: true } },
        receivingWarehouse: { select: { id: true, name: true, addressLine1: true, city: true, contactPerson: true, mobile: true } },
        referenceDeliveryNote: { select: { id: true, dnNumber: true } },
        vehicleTrip: {
          select: {
            id: true,
            tripNumber: true,
            status: true,
            startOdometer: true,
            endOdometer: true,
            distanceKm: true,
            driver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
            vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
          },
        },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, uom: true, materialCode: true } },
          },
        },
        evidences: true,
      },
      orderBy: { returnDate: "asc" },
    });

    // 4. Material Pickups Completed Today (Handed over to warehouse, inspected, or posted today)
    const completedPickupsToday = await db.materialReturnNote.findMany({
      where: {
        status: {
          in: [
            "HANDED_OVER_TO_WAREHOUSE",
            "AWAITING_INSPECTION",
            "INSPECTION_COMPLETED",
            "POSTED",
            "FINALIZED",
          ],
        },
        updatedAt: { gte: startOfToday },
        ...mrnDriverFilter,
      },
      include: {
        customer: { select: { id: true, name: true } },
        customerSite: { select: { id: true, siteName: true } },
        receivingWarehouse: { select: { id: true, name: true, contactPerson: true, mobile: true } },
        vehicleTrip: {
          select: {
            id: true,
            tripNumber: true,
            vehicle: { select: { vehicleNumber: true } },
          },
        },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, uom: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 5. Fetch Yard Receiving Personnel / Warehouse Staff from DB for automatic autofill
    const [warehouseUsers, allWarehouses, recentReceivers] = await Promise.all([
      db.user.findMany({
        where: {
          isActive: true,
          role: { in: ["WAREHOUSE_MANAGER", "WAREHOUSE_STAFF", "ADMINISTRATOR", "OWNER"] },
        },
        select: {
          id: true,
          name: true,
          role: true,
          mobile: true,
          warehouseId: true,
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.warehouse.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          contactPerson: true,
          mobile: true,
          warehouseType: true,
        },
        orderBy: { name: "asc" },
      }),
      db.materialReturnNote.findMany({
        where: { receiverName: { not: null } },
        select: {
          receiverName: true,
          receiverDesignation: true,
          receiverPhone: true,
          receivingWarehouseId: true,
        },
        distinct: ["receiverName"],
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const receiversMap = new Map<string, {
      id: string;
      name: string;
      designation: string;
      phone: string;
      warehouseId?: string | null;
      warehouseName?: string | null;
    }>();

    const formatRole = (r: string) => {
      switch (r) {
        case "WAREHOUSE_MANAGER": return "Yard / Warehouse Manager";
        case "WAREHOUSE_STAFF": return "Yard In-Charge / QC Staff";
        case "OWNER": return "Proprietor / Yard Owner";
        case "ADMINISTRATOR": return "Yard Administrator";
        default: return "Yard In-Charge";
      }
    };

    for (const u of warehouseUsers) {
      if (u.name) {
        receiversMap.set(u.name.toLowerCase().trim(), {
          id: u.id,
          name: u.name.trim(),
          designation: formatRole(u.role),
          phone: u.mobile || "",
          warehouseId: u.warehouseId,
          warehouseName: u.warehouse?.name || "",
        });
      }
    }

    for (const w of allWarehouses) {
      if (w.contactPerson && !receiversMap.has(w.contactPerson.toLowerCase().trim())) {
        receiversMap.set(w.contactPerson.toLowerCase().trim(), {
          id: `wh-${w.id}`,
          name: w.contactPerson.trim(),
          designation: w.warehouseType === "MAIN_YARD" ? "Main Yard In-Charge" : "Yard In-Charge",
          phone: w.mobile || "",
          warehouseId: w.id,
          warehouseName: w.name,
        });
      }
    }

    for (const r of recentReceivers) {
      if (r.receiverName && !receiversMap.has(r.receiverName.toLowerCase().trim())) {
        receiversMap.set(r.receiverName.toLowerCase().trim(), {
          id: `mrn-${r.receiverName.toLowerCase().trim()}`,
          name: r.receiverName.trim(),
          designation: r.receiverDesignation || "Yard In-Charge",
          phone: r.receiverPhone || "",
          warehouseId: r.receivingWarehouseId,
          warehouseName: "",
        });
      }
    }

    const yardReceivers = Array.from(receiversMap.values());

    return NextResponse.json({
      success: true,
      data: {
        activeDeliveries,
        completedToday,
        activePickups,
        completedPickupsToday,
        yardReceivers,
        preferredLanguage: session?.preferredLanguage || "en",
        summary: {
          pendingCount: activeDeliveries.length + activePickups.length,
          pendingDeliveriesCount: activeDeliveries.length,
          pendingPickupsCount: activePickups.length,
          completedTodayCount: completedToday.length + completedPickupsToday.length,
          completedDeliveriesCount: completedToday.length,
          completedPickupsCount: completedPickupsToday.length,
        },
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
