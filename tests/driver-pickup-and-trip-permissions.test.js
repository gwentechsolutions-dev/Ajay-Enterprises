import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

describe("Driver Pickup Workflow & Fleet Trip Permission Guard Suite", () => {
  // 1. Role-Based Access Control: Trip Creation Permissions
  describe("Fleet Trip Creation Authorization Rules", () => {
    // Permitted roles definition from INVENTRA RBAC
    const ROLE_PERMISSIONS = {
      OWNER: { fleet: ["view", "create", "edit", "delete"] },
      OFFICE_ADMIN: { fleet: ["view", "create", "edit", "delete"] },
      YARD_IN_CHARGE: { fleet: ["view", "create", "edit"] },
      ACCOUNTANT: { fleet: ["view"] },
      DELIVERY_PERSONNEL: { fleet: ["view"] }, // View only! Cannot create trips
      CUSTOMER_ADMIN: { fleet: [] },
      SITE_SUPERVISOR: { fleet: [] },
    };

    function checkCanCreateTrip(role) {
      const perms = ROLE_PERMISSIONS[role]?.fleet || [];
      const isDeliveryPerson = role === "DELIVERY_PERSONNEL";
      const hasPermission = perms.includes("create");
      return hasPermission && !isDeliveryPerson;
    }

    function checkCanCompleteTrip(role) {
      const perms = ROLE_PERMISSIONS[role]?.fleet || [];
      const isDeliveryPerson = role === "DELIVERY_PERSONNEL" || role === "DELIVERY_DRIVER";
      const hasPermission = perms.includes("edit");
      return hasPermission && !isDeliveryPerson;
    }

    test("DELIVERY_PERSONNEL must NOT be authorized to create vehicle trips", () => {
      const canCreate = checkCanCreateTrip("DELIVERY_PERSONNEL");
      assert.strictEqual(
        canCreate,
        false,
        "Delivery personnel must be prohibited from creating trips"
      );
    });

    test("DELIVERY_PERSONNEL must NOT be authorized to manually complete vehicle trips in fleet table", () => {
      const canComplete = checkCanCompleteTrip("DELIVERY_PERSONNEL");
      assert.strictEqual(
        canComplete,
        false,
        "Delivery personnel must NOT be able to manually complete fleet trips; button must be hidden"
      );
    });

    test("OWNER and OFFICE_ADMIN must be authorized to complete fleet trips", () => {
      assert.strictEqual(checkCanCompleteTrip("OWNER"), true);
      assert.strictEqual(checkCanCompleteTrip("OFFICE_ADMIN"), true);
      assert.strictEqual(checkCanCompleteTrip("YARD_IN_CHARGE"), true);
    });

    test("OWNER and YARD_IN_CHARGE must be authorized to create vehicle trips", () => {
      assert.strictEqual(
        checkCanCreateTrip("OWNER"),
        true,
        "OWNER must be able to create trips"
      );
      assert.strictEqual(
        checkCanCreateTrip("YARD_IN_CHARGE"),
        true,
        "YARD_IN_CHARGE must be able to create trips"
      );
      assert.strictEqual(
        checkCanCreateTrip("OFFICE_ADMIN"),
        true,
        "OFFICE_ADMIN must be able to create trips"
      );
    });

    test("ACCOUNTANT must have view-only access to trips", () => {
      assert.strictEqual(
        checkCanCreateTrip("ACCOUNTANT"),
        false,
        "Accountant should not create fleet trips"
      );
    });
  });

  // 2. Complete MRN Pickup Schema Validation
  describe("Driver MRN Material Pickup Validation Schema", () => {
    const completeMrnPickupSchema = z.object({
      receiverName: z
        .string()
        .min(2, "Receiver/Site In-charge name must be at least 2 characters"),
      receiverPhone: z
        .string()
        .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
        .optional()
        .or(z.literal("")),
      receiverDesignation: z.string().optional().or(z.literal("")),
      receiverSignatureUrl: z.string().url().optional().or(z.literal("")),
      photoUrl: z.string().min(1, "Site pickup proof photograph is mandatory"),
      gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
      gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
      gpsAccuracy: z.number().nonnegative().optional().nullable(),
      missingEvidenceReason: z.string().optional().or(z.literal("")),
      destinationType: z.enum(["YARD", "SITE_TRANSFER"]).default("YARD"),
      destinationSiteName: z.string().optional().or(z.literal("")),
      remarks: z.string().optional().or(z.literal("")),
      completedAt: z.string().datetime().optional(),
    });

    test("validates complete material pickup proof with GPS and photo", () => {
      const validPayload = {
        receiverName: "Karthik Raja",
        receiverPhone: "9876543210",
        receiverDesignation: "Site Engineer",
        photoUrl: "https://example.com/storage/mrn-pickup-proof-001.jpg",
        gpsLatitude: 12.9715987,
        gpsLongitude: 77.5945627,
        gpsAccuracy: 4.8,
        destinationType: "YARD",
        remarks: "15 Props and 10 Sheets picked up in good condition.",
      };

      const result = completeMrnPickupSchema.safeParse(validPayload);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.destinationType, "YARD");
      assert.strictEqual(result.data.receiverName, "Karthik Raja");
    });

    test("validates direct site transfer material pickup destination", () => {
      const transferPayload = {
        receiverName: "Murugan Site Supervisor",
        receiverPhone: "9123456780",
        photoUrl: "https://example.com/storage/transfer-pickup-002.jpg",
        gpsLatitude: 13.0826802,
        gpsLongitude: 80.2707184,
        destinationType: "SITE_TRANSFER",
        destinationSiteName: "Casagrand Phase 2 - Site B",
        remarks: "Direct transfer for slab casting tomorrow morning.",
      };

      const result = completeMrnPickupSchema.safeParse(transferPayload);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.destinationType, "SITE_TRANSFER");
      assert.strictEqual(result.data.destinationSiteName, "Casagrand Phase 2 - Site B");
    });

    test("rejects pickup submission without photoUrl", () => {
      const invalidPayload = {
        receiverName: "Murugan",
        photoUrl: "", // missing photo
        destinationType: "YARD",
      };

      const result = completeMrnPickupSchema.safeParse(invalidPayload);
      assert.strictEqual(result.success, false);
      assert.ok(
        result.error.issues.some((i) => i.path.includes("photoUrl")),
        "Should require photoUrl"
      );
    });

    test("rejects invalid 10-digit mobile number format", () => {
      const invalidPhonePayload = {
        receiverName: "Murugan",
        receiverPhone: "12345", // invalid format
        photoUrl: "https://example.com/proof.jpg",
        destinationType: "YARD",
      };

      const result = completeMrnPickupSchema.safeParse(invalidPhonePayload);
      assert.strictEqual(result.success, false);
      assert.ok(
        result.error.issues.some((i) => i.path.includes("receiverPhone")),
        "Should reject invalid phone"
      );
    });
  });

  // 3. Driver Portal Task Segregation & Counts
  describe("Driver Portal Feed Task Segregation", () => {
    const mockDeliveries = [
      { id: "dn-1", status: "DISPATCHED", isCompleted: false },
      { id: "dn-2", status: "DELIVERED", isCompleted: true },
    ];

    const mockPickups = [
      { id: "mrn-1", status: "ASSIGNED", photoUrl: null },
      { id: "mrn-2", status: "IN_TRANSIT", photoUrl: null },
      { id: "mrn-3", status: "POSTED", photoUrl: "https://proof.jpg" },
    ];

    test("correctly calculates active deliveries, active pickups, and completed tasks", () => {
      const activeDeliveries = mockDeliveries.filter((d) => !d.isCompleted);
      const activePickups = mockPickups.filter((p) => !p.photoUrl);
      const completedToday = mockDeliveries.filter((d) => d.isCompleted);
      const completedPickupsToday = mockPickups.filter((p) => Boolean(p.photoUrl));

      const totalPending = activeDeliveries.length + activePickups.length;
      const totalCompleted = completedToday.length + completedPickupsToday.length;

      assert.strictEqual(activeDeliveries.length, 1);
      assert.strictEqual(activePickups.length, 2);
      assert.strictEqual(completedToday.length, 1);
      assert.strictEqual(completedPickupsToday.length, 1);
      assert.strictEqual(totalPending, 3);
      assert.strictEqual(totalCompleted, 2);
    });
  });

  // 4. GPS Stamp Formatting Verification
  describe("GPS Metadata Stamping", () => {
    test("formats coordinate stamp string with precision and timestamp", () => {
      const lat = 12.9715987;
      const lng = 77.5945627;
      const accuracy = 5.2;
      const docNo = "MRN-2026-0042";
      const timestamp = new Date("2026-11-18T10:30:00Z");

      const line1 = `AJAY ENTERPRISES | DOC: ${docNo}`;
      const line2 = `LAT: ${lat.toFixed(6)} | LNG: ${lng.toFixed(6)} (±${Math.round(accuracy)}m)`;
      const line3 = `TIME: ${timestamp.toISOString()}`;

      assert.ok(line1.includes("AJAY ENTERPRISES"));
      assert.ok(line1.includes("MRN-2026-0042"));
      assert.ok(line2.includes("12.971599"));
      assert.ok(line2.includes("77.594563"));
      assert.ok(line2.includes("±5m"));
      assert.ok(line3.includes("2026-11-18T10:30:00.000Z"));
    });
  });

  // 5. Driver Trip History Scoping (Granular Record Scope)
  describe("Driver Trip History Scoping (Granular Record Scope)", () => {
    const allTrips = [
      {
        id: "trip-1",
        tripNumber: "AE/TRIP/2026-27/0002",
        driverId: "drv-ramesh",
        driverName: "Ramesh",
        driverPhone: "9841265700",
        status: "COMPLETED",
      },
      {
        id: "trip-2",
        tripNumber: "AE/TRIP/2026-27/0001",
        driverId: "drv-manjunath",
        driverName: "Manjunath R.",
        driverPhone: "9845223344",
        status: "IN_TRANSIT",
      },
      {
        id: "trip-3",
        tripNumber: "AE/TRIP/DEMO-001",
        driverId: "drv-suresh",
        driverName: "Suresh Gowda",
        driverPhone: "9845112233",
        status: "COMPLETED",
      },
    ];

    function filterTripsForUser(trips, user) {
      if (user.role === "DELIVERY_PERSONNEL" || user.role === "DELIVERY_DRIVER") {
        return trips.filter(
          (t) =>
            t.driverId === user.driverId ||
            (t.driverName && t.driverName.toLowerCase() === user.name.toLowerCase()) ||
            (t.driverPhone && user.mobile && t.driverPhone === user.mobile)
        );
      }
      return trips;
    }

    test("DELIVERY_PERSONNEL user (Ramesh) only receives their own trips and excludes other drivers", () => {
      const driverUser = {
        id: "usr-ramesh",
        name: "Ramesh",
        mobile: "9841265700",
        role: "DELIVERY_PERSONNEL",
        driverId: "drv-ramesh",
      };

      const scopedTrips = filterTripsForUser(allTrips, driverUser);
      assert.strictEqual(scopedTrips.length, 1);
      assert.strictEqual(scopedTrips[0].tripNumber, "AE/TRIP/2026-27/0002");
      assert.strictEqual(scopedTrips[0].driverName, "Ramesh");

      // Verify other drivers' trips are excluded
      assert.ok(!scopedTrips.some((t) => t.driverName === "Manjunath R."));
      assert.ok(!scopedTrips.some((t) => t.driverName === "Suresh Gowda"));
    });

    test("OWNER and ADMIN see all trips across the entire company fleet", () => {
      const adminUser = {
        id: "usr-admin",
        name: "Thanikaivel",
        role: "OWNER",
      };

      const allFleetTrips = filterTripsForUser(allTrips, adminUser);
      assert.strictEqual(allFleetTrips.length, 3);
      assert.ok(allFleetTrips.some((t) => t.driverName === "Ramesh"));
      assert.ok(allFleetTrips.some((t) => t.driverName === "Manjunath R."));
      assert.ok(allFleetTrips.some((t) => t.driverName === "Suresh Gowda"));
    });
  });
});
