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

    // Fast indexed driver lookup to avoid heavy table-wide ILIKE / contains operations
    const driver = isDriverOnly && (sessionMobile || sessionName)
      ? await db.driver.findFirst({
          where: {
            OR: [
              ...(sessionMobile ? [{ mobileNumber: sessionMobile }] : []),
              ...(sessionName ? [{ name: { equals: sessionName, mode: "insensitive" as const } }] : []),
            ],
          },
          select: { id: true, name: true, mobileNumber: true },
        })
      : null;

    // DeliveryNote uses tripDeliveryNotes -> trip -> driver, plus driverName and driverPhone
    const dnConditions: any[] = [];
    if (driver) {
      dnConditions.push({ tripDeliveryNotes: { some: { trip: { driverId: driver.id } } } });
    }
    if (sessionName) {
      dnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
    }
    if (sessionMobile) {
      dnConditions.push({ driverPhone: sessionMobile });
    }
    const dnDriverFilter = isDriverOnly && dnConditions.length > 0 ? { OR: dnConditions } : {};

    // MaterialReturnNote uses vehicleTrip -> driver, plus driverName and driverPhone
    const mrnConditions: any[] = [];
    if (driver) {
      mrnConditions.push({ vehicleTrip: { driverId: driver.id } });
    }
    if (sessionName) {
      mrnConditions.push({ driverName: { contains: sessionName, mode: "insensitive" } });
    }
    if (sessionMobile) {
      mrnConditions.push({ driverPhone: sessionMobile });
    }
    const mrnDriverFilter = isDriverOnly && mrnConditions.length > 0 ? { OR: mrnConditions } : {};

    // Vehicle trips assigned to driver
    const tripConditions: any[] = [];
    if (driver) {
      tripConditions.push({ driverId: driver.id });
    }
    if (sessionName) {
      tripConditions.push({ driver: { name: { contains: sessionName, mode: "insensitive" } } });
    }
    if (sessionMobile) {
      tripConditions.push({ driver: { mobileNumber: sessionMobile } });
    }
    if (session?.id) {
      tripConditions.push({ createdById: session.id });
    }
    const tripDriverFilter = isDriverOnly && tripConditions.length > 0 ? { OR: tripConditions } : {};

    // Active Direct Site-to-Site Transfers assigned to driver
    const dstnConditions: any[] = [];
    if (driver) {
      dstnConditions.push({ driverId: driver.id });
    }
    if (sessionName) {
      dstnConditions.push({ driver: { name: { contains: sessionName, mode: "insensitive" } } });
    }
    if (sessionMobile) {
      dstnConditions.push({ driver: { mobileNumber: sessionMobile } });
    }
    const dstnDriverFilter = isDriverOnly && dstnConditions.length > 0 ? { OR: dstnConditions } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Parallel Execution of all independent queries (prevents serial network roundtrips)
    const [
      activeDeliveries,
      completedToday,
      activePickups,
      completedPickupsToday,
      warehouseUsers,
      allWarehouses,
      assignedTrips,
      activeDirectTransfers,
    ] = await Promise.all([
      // 1. Active Dispatched Deliveries (Awaiting Delivery & Receiver Sign-off)
      db.deliveryNote.findMany({
        where: {
          status: "DISPATCHED",
          ...dnDriverFilter,
        },
        select: {
          id: true,
          dnNumber: true,
          deliveryDate: true,
          status: true,
          notes: true,
          vehicleNumber: true,
          driverName: true,
          driverPhone: true,
          customer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
          customerSite: {
            select: {
              id: true,
              siteName: true,
              fullAddress: true,
              siteContactDetails: true,
              siteInCharge: true,
              gpsLatitude: true,
              gpsLongitude: true,
            },
          },
          sourceWarehouse: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              materialVariant: { select: { id: true, name: true, size: true, uom: true, materialCode: true } },
            },
          },
        },
        orderBy: { deliveryDate: "asc" },
      }),

      // 2. Deliveries Completed Today
      db.deliveryNote.findMany({
        where: {
          status: "DELIVERED",
          deliveredAt: { gte: startOfToday },
          ...dnDriverFilter,
        },
        select: {
          id: true,
          dnNumber: true,
          deliveredAt: true,
          status: true,
          customer: { select: { id: true, name: true } },
          customerSite: { select: { id: true, siteName: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              materialVariant: { select: { id: true, name: true, size: true, uom: true } },
            },
          },
        },
        orderBy: { deliveredAt: "desc" },
        take: 20,
      }),

      // 3. Active Material Pickups / Returns (Assigned to driver, en-route, arrived at site, or returning to yard)
      db.materialReturnNote.findMany({
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
        select: {
          id: true,
          mrnNumber: true,
          returnDate: true,
          status: true,
          remarks: true,
          vehicleNumber: true,
          driverName: true,
          driverPhone: true,
          siteArrivedAt: true,
          pickupCompletedAt: true,
          yardArrivedAt: true,
          customer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
          customerSite: {
            select: {
              id: true,
              siteName: true,
              fullAddress: true,
              siteContactDetails: true,
              siteInCharge: true,
              gpsLatitude: true,
              gpsLongitude: true,
            },
          },
          receivingWarehouse: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
              contactPerson: true,
              mobile: true,
            },
          },
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
            select: {
              id: true,
              materialVariantId: true,
              returnedQty: true,
              expectedQty: true,
              acceptedQty: true,
              damagedQty: true,
              missingQty: true,
              driverCollectedQty: true,
              driverGoodQty: true,
              driverDamagedQty: true,
              driverMissingQty: true,
              driverRemarks: true,
              condition: true,
              remarks: true,
              materialVariant: { select: { id: true, name: true, size: true, uom: true, materialCode: true } },
            },
          },
        },
        orderBy: { returnDate: "asc" },
      }),

      // 4. Material Pickups Completed Today (Handed over to warehouse, inspected, or posted today)
      db.materialReturnNote.findMany({
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
        select: {
          id: true,
          mrnNumber: true,
          updatedAt: true,
          status: true,
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
            select: {
              id: true,
              returnedQty: true,
              materialVariant: { select: { id: true, name: true, size: true, uom: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),

      // 5a. Fetch Yard Receiving Personnel / Warehouse Staff from DB for automatic autofill
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
        take: 25,
      }),

      // 5b. Fetch Warehouses for Receiver Options
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
        take: 15,
      }),

      // 6. Fetch Driver's Assigned Trips
      db.vehicleTrip.findMany({
        where: tripDriverFilter,
        select: {
          id: true,
          tripNumber: true,
          status: true,
          tripDate: true,
          startOdometer: true,
          endOdometer: true,
          distanceKm: true,
          vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
          driver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
          originWarehouse: { select: { id: true, name: true } },
          destinationSite: { select: { id: true, siteName: true } },
          returnNotes: { select: { id: true, mrnNumber: true, status: true } },
          deliveryNotes: {
            select: {
              id: true,
              deliveryNote: { select: { id: true, dnNumber: true, status: true } },
            },
          },
        },
        orderBy: { tripDate: "desc" },
        take: 10,
      }),

      // 7. Active Direct Site-to-Site Transfers assigned to driver
      db.directSiteTransferNote.findMany({
        where: {
          status: {
            in: [
              "DRAFT",
              "SOURCE_PICKUP_PENDING",
              "SOURCE_PICKUP_COMPLETED",
              "IN_TRANSIT",
              "DESTINATION_DELIVERED",
              "GODOWN_RETURN_PENDING",
            ],
          },
          ...dstnDriverFilter,
        },
        select: {
          id: true,
          transferNumber: true,
          status: true,
          transferDate: true,
          sourceCustomer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
          sourceCustomerSite: {
            select: {
              id: true,
              siteName: true,
              fullAddress: true,
              siteContactDetails: true,
              siteInCharge: true,
              gpsLatitude: true,
              gpsLongitude: true,
            },
          },
          destinationCustomer: { select: { id: true, name: true, primaryMobile: true, whatsappNumber: true } },
          destinationCustomerSite: {
            select: {
              id: true,
              siteName: true,
              fullAddress: true,
              siteContactDetails: true,
              siteInCharge: true,
              gpsLatitude: true,
              gpsLongitude: true,
            },
          },
          vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
          driver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
          items: {
            select: {
              id: true,
              quantityDispatched: true,
              materialVariant: { select: { id: true, name: true, size: true, uom: true, materialCode: true } },
            },
          },
        },
        orderBy: { transferDate: "asc" },
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

    const yardReceivers = Array.from(receiversMap.values());

    return NextResponse.json({
      success: true,
      data: {
        activeDeliveries,
        completedToday,
        activePickups,
        completedPickupsToday,
        activeDirectTransfers,
        assignedTrips,
        yardReceivers,
        preferredLanguage: session?.preferredLanguage || "en",
        driverProfile: {
          id: session?.id || "",
          name: session?.name || "Driver",
          email: session?.email || "",
          mobile: session?.mobile || "",
          role: session?.role || "DELIVERY_PERSONNEL",
        },
        summary: {
          pendingCount: activeDeliveries.length + activePickups.length + activeDirectTransfers.length,
          pendingDeliveriesCount: activeDeliveries.length,
          pendingPickupsCount: activePickups.length,
          pendingTransfersCount: activeDirectTransfers.length,
          completedTodayCount: completedToday.length + completedPickupsToday.length,
          completedDeliveriesCount: completedToday.length,
          completedPickupsCount: completedPickupsToday.length,
          assignedTripsCount: assignedTrips.length,
        },
      },
    }, {
      headers: {
        "Cache-Control": "private, no-cache, no-transform",
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
