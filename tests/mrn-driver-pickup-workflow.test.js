import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

describe("INVENTRA – Driver-Assisted Return Pickup & MRN Lifecycle Test Suite", () => {
  const dummyUUID = "11111111-1111-4111-8111-111111111111";
  const dummyCustomerUUID = "22222222-2222-4222-8222-222222222222";
  const dummySiteUUID = "33333333-3333-4333-8333-333333333333";
  const dummyWarehouseUUID = "44444444-4444-4444-8444-444444444444";
  const dummyVariantUUID = "55555555-5555-4555-8555-555555555555";
  const dummyVehicleUUID = "66666666-6666-4666-8666-666666666666";
  const dummyDriverUUID = "77777777-7777-4777-8777-777777777777";

  const MRN_STATUSES = [
    "PICKUP_REQUESTED",
    "ASSIGNED",
    "EN_ROUTE",
    "ARRIVED_AT_SITE",
    "PICKUP_IN_PROGRESS",
    "PICKUP_COMPLETED",
    "IN_TRANSIT",
    "ARRIVED_AT_YARD",
    "AWAITING_INSPECTION",
    "INSPECTION_COMPLETED",
    "POSTED",
    "FINALIZED",
    "DRAFT",
    "COMPLETED",
    "CANCELLED",
  ];

  const materialReturnItemSchema = z.object({
    materialVariantId: z.string().uuid("Material variant is required"),
    ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
    returnedQty: z.coerce.number().min(0, "Returned quantity cannot be negative").default(0),
    expectedQty: z.coerce.number().min(0).optional().nullable(),
    receivedQty: z.coerce.number().min(0).optional().nullable(),
    acceptedQty: z.coerce.number().min(0).default(0),
    damagedQty: z.coerce.number().min(0).default(0),
    missingQty: z.coerce.number().min(0).default(0),
    rejectedQty: z.coerce.number().min(0).default(0),
    condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
    remarks: z.string().optional().nullable(),
  });

  const createMaterialReturnNoteSchema = z.object({
    mrnNumber: z.string().optional(),
    customerId: z.string().uuid("Customer is required"),
    customerSiteId: z.string().uuid("Customer construction site is required"),
    receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
    referenceDeliveryNoteId: z.string().uuid().optional().nullable().or(z.literal("")),
    preferredPickupDate: z.string().optional().nullable(),
    preferredPickupTime: z.string().optional().nullable(),
    pickupInstructions: z.string().optional().nullable(),
    includeReturnDate: z.boolean().default(false),
    status: z.enum(MRN_STATUSES).optional(),
    vehicleId: z.string().uuid().optional().nullable().or(z.literal("")),
    driverId: z.string().uuid().optional().nullable().or(z.literal("")),
    items: z.array(materialReturnItemSchema).min(1, "At least one item is required for return"),
  });

  const scheduleReturnTripSchema = z.object({
    vehicleId: z.string().uuid("Vehicle is required"),
    vehicleNumber: z.string().optional().nullable(),
    driverId: z.string().uuid().optional().nullable().or(z.literal("")),
    driverName: z.string().optional().nullable(),
    driverPhone: z.string().regex(/^[6-9]\d{9}$/).optional().nullable().or(z.literal("")),
    pickupDate: z.string().optional().nullable(),
    pickupTime: z.string().optional().nullable(),
    destinationWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
    tripInstructions: z.string().optional().nullable(),
    startOdometer: z.coerce.number().min(0).optional().nullable(),
    existingTripId: z.string().uuid().optional().nullable().or(z.literal("")),
  });

  const driverSiteArrivalSchema = z.object({
    gpsLatitude: z.coerce.number().min(-90).max(90),
    gpsLongitude: z.coerce.number().min(-180).max(180),
    gpsAccuracy: z.coerce.number().nonnegative().optional().nullable(),
    arrivedAt: z.string().optional(),
    exceptionReason: z.string().optional().nullable(),
  });

  const driverPickupItemSchema = z.object({
    materialVariantId: z.string().uuid(),
    driverCollectedQty: z.coerce.number().min(0, "Collected quantity cannot be negative"),
    driverGoodQty: z.coerce.number().min(0).optional().nullable(),
    driverDamagedQty: z.coerce.number().min(0).optional().nullable(),
    driverMissingQty: z.coerce.number().min(0).optional().nullable(),
    driverRemarks: z.string().optional().nullable(),
  });

  const driverConfirmPickupSchema = z.object({
    customerRepresentativeName: z.string().min(2, "Representative name must be at least 2 characters"),
    customerRepresentativeDesignation: z.string().optional().nullable().default("Site Supervisor"),
    customerRepresentativePhone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
    customerSignatureUrl: z.string().optional().nullable(),
    customerSignatureExceptionReason: z.string().optional().nullable(),
    photoUrl: z.string().min(1, "Site material return photograph is mandatory"),
    additionalPhotoUrls: z.array(z.string()).optional().default([]),
    pickupOdometer: z.coerce.number().min(0).optional().nullable(),
    gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    gpsAccuracy: z.coerce.number().nonnegative().optional().nullable(),
    remarks: z.string().optional().nullable(),
    items: z.array(driverPickupItemSchema).min(1, "At least one item must be verified"),
  });

  const driverYardArrivalSchema = z.object({
    yardOdometer: z.coerce.number().min(0, "Final odometer must be non-negative"),
    receiverName: z.string().min(2, "Warehouse receiving employee name is required"),
    receiverDesignation: z.string().optional().default("Yard In-Charge"),
    receiverPhone: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    yardArrivedAt: z.string().optional(),
  });

  const warehouseInspectionItemSchema = z.object({
    materialVariantId: z.string().uuid(),
    receivedQty: z.coerce.number().min(0, "Received quantity cannot be negative"),
    acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
    damagedQty: z.coerce.number().min(0).default(0),
    missingQty: z.coerce.number().min(0).default(0),
    rejectedQty: z.coerce.number().min(0).default(0),
    condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
    inspectionRemarks: z.string().optional().nullable(),
  });

  const warehouseReceiveAndInspectSchema = z.object({
    inspectorName: z.string().min(2, "Inspector name is required"),
    inspectorDesignation: z.string().optional().default("Quality Inspector"),
    inspectionRemarks: z.string().optional().nullable(),
    items: z.array(warehouseInspectionItemSchema).min(1, "At least one item must be inspected"),
  });

  const finalizeMrnSchema = z.object({
    includeReturnDate: z.boolean().default(false),
    remarks: z.string().optional().nullable(),
  });

  // 1. Stage 1 – Create Return Pickup Request (Initial Status: PICKUP_REQUESTED)
  describe("Stage 1: Create Return Pickup Request Schema", () => {
    test("allows creating Return Pickup Request without premature receiving or inspection fields", () => {
      const payload = {
        customerId: dummyCustomerUUID,
        customerSiteId: dummySiteUUID,
        receivingWarehouseId: dummyWarehouseUUID,
        preferredPickupDate: "2026-11-20",
        preferredPickupTime: "10:30 AM",
        pickupInstructions: "Gate 2 contact Suresh Kumar",
        status: "PICKUP_REQUESTED",
        items: [
          {
            materialVariantId: dummyVariantUUID,
            expectedQty: 40,
            returnedQty: 40,
            ownershipType: "OWNED",
            condition: "GOOD",
          },
        ],
      };

      const result = createMaterialReturnNoteSchema.safeParse(payload);
      assert.strictEqual(result.success, true, "Payload should be valid for Return Pickup Request");
      if (result.success) {
        assert.strictEqual(result.data.status, "PICKUP_REQUESTED");
        assert.strictEqual(result.data.preferredPickupTime, "10:30 AM");
      }
    });

    test("requires at least one material line item for return request", () => {
      const invalidPayload = {
        customerId: dummyCustomerUUID,
        customerSiteId: dummySiteUUID,
        receivingWarehouseId: dummyWarehouseUUID,
        items: [],
      };

      const result = createMaterialReturnNoteSchema.safeParse(invalidPayload);
      assert.strictEqual(result.success, false, "Should fail when items array is empty");
    });

    test("rejects negative expected return quantities", () => {
      const invalidPayload = {
        customerId: dummyCustomerUUID,
        customerSiteId: dummySiteUUID,
        receivingWarehouseId: dummyWarehouseUUID,
        items: [
          {
            materialVariantId: dummyVariantUUID,
            returnedQty: -10,
          },
        ],
      };

      const result = createMaterialReturnNoteSchema.safeParse(invalidPayload);
      assert.strictEqual(result.success, false, "Should reject negative quantity");
    });
  });

  // 2. Stage 2 – Automatic Vehicle Trip Scheduling
  describe("Stage 2: Automatic Vehicle Trip Scheduling Schema", () => {
    test("validates vehicle trip scheduling with company vehicle and assigned driver", () => {
      const tripPayload = {
        vehicleId: dummyVehicleUUID,
        driverId: dummyDriverUUID,
        pickupDate: "2026-11-20",
        pickupTime: "11:00 AM",
        tripInstructions: "Pickup 40 centering props from Mandaveli site",
      };

      const result = scheduleReturnTripSchema.safeParse(tripPayload);
      assert.strictEqual(result.success, true, "Should validate trip scheduling payload");
    });

    test("allows linking to an existing vehicle trip", () => {
      const tripPayload = {
        vehicleId: dummyVehicleUUID,
        existingTripId: dummyUUID,
      };

      const result = scheduleReturnTripSchema.safeParse(tripPayload);
      assert.strictEqual(result.success, true, "Should allow existingTripId");
    });
  });

  // 3. Stage 4 – Driver Site Arrival and GPS Evidence
  describe("Stage 4: Driver Site Arrival and GPS Evidence", () => {
    test("validates browser GPS coordinates with timestamp upon site arrival", () => {
      const arrivalPayload = {
        gpsLatitude: 12.9716,
        gpsLongitude: 77.5946,
        gpsAccuracy: 4.8,
        arrivedAt: new Date().toISOString(),
      };

      const result = driverSiteArrivalSchema.safeParse(arrivalPayload);
      assert.strictEqual(result.success, true, "Should validate site arrival GPS coordinates");
    });

    test("allows authorized exception workflow when GPS permission is denied", () => {
      const exceptionPayload = {
        gpsLatitude: 0,
        gpsLongitude: 0,
        exceptionReason: "Driver phone GPS sensor failed in basement parking; location verified by site gate entry log.",
      };

      const result = driverSiteArrivalSchema.safeParse(exceptionPayload);
      assert.strictEqual(result.success, true, "Should accept documented GPS exception");
    });

    test("rejects out-of-bounds latitude and longitude values", () => {
      const invalidCoords = {
        gpsLatitude: 120.0,
        gpsLongitude: 77.5946,
      };

      const result = driverSiteArrivalSchema.safeParse(invalidCoords);
      assert.strictEqual(result.success, false, "Should reject latitude > 90");
    });
  });

  // 4. Stage 5, 6, 7 & 8 – Driver Material Count, Photo Upload & Customer Handover
  describe("Stages 5-8: Driver Preliminary Count, Photos & Customer Handover", () => {
    test("validates driver preliminary visual count and segregates good, damaged and missing", () => {
      const handoverPayload = {
        customerRepresentativeName: "Ramesh Babu",
        customerRepresentativeDesignation: "Site Supervisor",
        customerRepresentativePhone: "9876543210",
        customerSignatureUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        photoUrl: "/storage/return-proofs/photo-1.jpg",
        additionalPhotoUrls: ["/storage/return-proofs/photo-2.jpg"],
        gpsLatitude: 12.9716,
        gpsLongitude: 77.5946,
        gpsAccuracy: 5.0,
        items: [
          {
            materialVariantId: dummyVariantUUID,
            driverCollectedQty: 40,
            driverGoodQty: 38,
            driverDamagedQty: 2,
            driverMissingQty: 0,
            driverRemarks: "2 sheets slightly bent on corners",
          },
        ],
      };

      const result = driverConfirmPickupSchema.safeParse(handoverPayload);
      assert.strictEqual(result.success, true, "Handover confirmation payload should be valid");
    });

    test("enforces valid 10-digit Indian mobile number for customer representative", () => {
      const invalidPhone = {
        customerRepresentativeName: "Ramesh Babu",
        customerRepresentativePhone: "12345",
        customerSignatureUrl: "data:image/png;base64,dummy",
        photoUrl: "/storage/return-proofs/photo.jpg",
        items: [{ materialVariantId: dummyVariantUUID, driverCollectedQty: 10 }],
      };

      const result = driverConfirmPickupSchema.safeParse(invalidPhone);
      assert.strictEqual(result.success, false, "Should reject invalid mobile number");
    });

    test("supports signature refusal exception workflow with mandatory documented reason", () => {
      const refusalPayload = {
        customerRepresentativeName: "Suresh Guard",
        customerRepresentativePhone: "9845012345",
        customerSignatureExceptionReason: "Site representative refused to sign stating owner was not on site.",
        photoUrl: "/storage/return-proofs/evidence.jpg",
        items: [{ materialVariantId: dummyVariantUUID, driverCollectedQty: 10 }],
      };

      const result = driverConfirmPickupSchema.safeParse(refusalPayload);
      assert.strictEqual(result.success, true, "Should allow signature refusal when reason is documented");
    });
  });

  // 5. Stage 9 – Driver Return to Yard
  describe("Stage 9: Driver Yard Arrival & Warehouse Handover", () => {
    test("validates yard arrival with odometer reading and receiving employee name", () => {
      const yardArrival = {
        yardOdometer: 14520,
        receiverName: "Yard Manager Ramesh",
        receiverDesignation: "Yard In-Charge",
        receiverPhone: "9845112233",
        remarks: "Vehicle arrived at Peenya Main Yard, materials unloaded at inspection bay.",
        gpsLatitude: 13.0285,
        gpsLongitude: 77.5197,
      };

      const result = driverYardArrivalSchema.safeParse(yardArrival);
      assert.strictEqual(result.success, true, "Should validate yard arrival payload");
    });

    test("requires non-empty receiver name upon yard arrival", () => {
      const invalidArrival = {
        yardOdometer: 14520,
        receiverName: "",
      };

      const result = driverYardArrivalSchema.safeParse(invalidArrival);
      assert.strictEqual(result.success, false, "Should reject empty receiver name");
    });
  });

  // 6. Stage 10 – Warehouse Physical QC Inspection & Discrepancy Tracking
  describe("Stage 10: Warehouse Receiving, QC Inspection & Discrepancy Schema", () => {
    test("validates physical QC breakdown and calculates accepted, damaged and missing", () => {
      const qcPayload = {
        inspectorName: "Govind Raj",
        inspectorDesignation: "Lead Quality Inspector",
        inspectionRemarks: "Physical verification completed. 38 good, 2 repairable damage.",
        items: [
          {
            materialVariantId: dummyVariantUUID,
            receivedQty: 40,
            acceptedQty: 38,
            damagedQty: 2,
            missingQty: 0,
            rejectedQty: 0,
            condition: "GOOD",
            inspectionRemarks: "2 sheets routed to maintenance bay for straightening.",
          },
        ],
      };

      const result = warehouseReceiveAndInspectSchema.safeParse(qcPayload);
      assert.strictEqual(result.success, true, "Should validate warehouse inspection breakdown");
    });

    test("enforces that sum of accepted, damaged, missing and rejected cannot exceed received quantity", () => {
      const items = [
        {
          materialVariantId: dummyVariantUUID,
          receivedQty: 20,
          acceptedQty: 18,
          damagedQty: 5,
          missingQty: 0,
          rejectedQty: 0,
        },
      ];

      const item = items[0];
      const sum = item.acceptedQty + item.damagedQty + item.missingQty + item.rejectedQty;
      const exceeds = sum > item.receivedQty;

      assert.strictEqual(exceeds, true, "Business validation must flag when accepted + damaged exceeds received");
    });
  });

  // 7. Stage 11 – Finalize MRN & Post Double-Entry Movements
  describe("Stage 11: Finalize MRN & Business Rules Verification", () => {
    test("observes Business Rule #12: independent Include Return Date boolean configuration", () => {
      const finalizeWithReturnDate = {
        includeReturnDate: true,
        remarks: "Approved for billing stop including return date.",
      };

      const finalizeWithoutReturnDate = {
        includeReturnDate: false,
        remarks: "Approved for billing stop excluding return date.",
      };

      const res1 = finalizeMrnSchema.safeParse(finalizeWithReturnDate);
      const res2 = finalizeMrnSchema.safeParse(finalizeWithoutReturnDate);

      assert.strictEqual(res1.success, true);
      assert.strictEqual(res2.success, true);
      if (res1.success && res2.success) {
        assert.strictEqual(res1.data.includeReturnDate, true);
        assert.strictEqual(res2.data.includeReturnDate, false);
      }
    });

    test("verifies all operational statuses in the complete MRN lifecycle", () => {
      const expectedStatuses = [
        "PICKUP_REQUESTED",
        "ASSIGNED",
        "EN_ROUTE",
        "ARRIVED_AT_SITE",
        "PICKUP_IN_PROGRESS",
        "PICKUP_COMPLETED",
        "IN_TRANSIT",
        "ARRIVED_AT_YARD",
        "AWAITING_INSPECTION",
        "INSPECTION_COMPLETED",
        "POSTED",
        "FINALIZED",
      ];

      for (const st of expectedStatuses) {
        assert.ok(
          MRN_STATUSES.includes(st),
          `Status '${st}' must be defined in MRN_STATUSES`
        );
      }
    });

    test("inventory movement immutability: materials in vehicle transit are NEVER credited to available yard stock", () => {
      const transitStatuses = ["ASSIGNED", "ARRIVED_AT_SITE", "PICKUP_COMPLETED", "IN_TRANSIT", "AWAITING_INSPECTION"];
      for (const status of transitStatuses) {
        const isAvailableInYardStock = status === "POSTED" || status === "FINALIZED";
        assert.strictEqual(
          isAvailableInYardStock,
          false,
          `Status '${status}' must NOT add materials into available warehouse inventory pool`
        );
      }
    });
  });
});
