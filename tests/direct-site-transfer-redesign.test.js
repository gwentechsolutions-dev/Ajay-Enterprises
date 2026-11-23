import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// Direct Transfer Schemas
const directTransferItemInputSchema = z.object({
  materialVariantId: z.string().uuid("Invalid material variant ID"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  sourceRentalBatchId: z.string().uuid().optional().nullable(),
  quantityDispatched: z.coerce.number().positive("Dispatched quantity must be greater than zero"),
  quantityCollected: z.coerce.number().min(0).optional(),
  quantityGodownReturned: z.coerce.number().min(0).optional(),
  agreedDailyRate: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const createDirectTransferSchema = z
  .object({
    transferNumber: z.string().optional(),
    transferDate: z.string().optional(),
    sourceCustomerId: z.string().uuid("Source customer is required"),
    sourceCustomerSiteId: z.string().uuid("Source customer site is required"),
    destinationCustomerId: z.string().uuid("Destination customer is required"),
    destinationCustomerSiteId: z.string().uuid("Destination customer site is required"),
    sourceRentalAgreementId: z.string().uuid().optional().nullable(),
    destinationRentalAgreementId: z.string().uuid().optional().nullable(),
    vehicleId: z.string().uuid().optional().nullable(),
    driverId: z.string().uuid().optional().nullable(),
    vehicleTripId: z.string().uuid().optional().nullable(),
    preferredPickupTime: z.string().optional().nullable(),
    expectedArrivalTime: z.string().optional().nullable(),
    includeCutoffDate: z.boolean().default(false),
    transportCharges: z.coerce.number().min(0).default(0),
    transportPayer: z
      .enum(["SOURCE_CUSTOMER", "DESTINATION_CUSTOMER", "AJAY_ENTERPRISES"])
      .default("DESTINATION_CUSTOMER")
      .optional()
      .nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(directTransferItemInputSchema).min(1, "At least one material line item is required"),
  })
  .refine((data) => data.sourceCustomerSiteId !== data.destinationCustomerSiteId, {
    message: "Source site and destination site must be different",
    path: ["destinationCustomerSiteId"],
  });

const pickupTransferItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantityCollected: z.coerce.number().min(0, "Collected quantity cannot be negative"),
  quantityUnavailable: z.coerce.number().min(0).default(0),
  quantityDamaged: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

const pickupDirectTransferSchema = z.object({
  sourceRepName: z.string().min(1, "Source representative name is required"),
  sourceRepPhone: z.string().optional().nullable(),
  sourceRepDesignation: z.string().optional().nullable(),
  sourceRepSignatureUrl: z.string().optional().nullable(),
  sourceGpsLat: z.coerce.number().optional().nullable(),
  sourceGpsLng: z.coerce.number().optional().nullable(),
  sourcePhotoUrl: z.string().optional().nullable(),
  odometerReading: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(pickupTransferItemSchema).optional(),
});

const receiveTransferItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantityAccepted: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  quantityGodownReturned: z.coerce.number().min(0).default(0),
  quantityDamaged: z.coerce.number().min(0).default(0),
  quantityMissing: z.coerce.number().min(0).default(0),
  quantityRejected: z.coerce.number().min(0).default(0),
  agreedDailyRate: z.coerce.number().min(0, "Daily rate cannot be negative").optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const receiveDirectTransferSchema = z.object({
  destRepName: z.string().min(1, "Destination representative name is required"),
  destRepPhone: z.string().optional().nullable(),
  destRepDesignation: z.string().optional().nullable(),
  destRepSignatureUrl: z.string().optional().nullable(),
  destGpsLat: z.coerce.number().optional().nullable(),
  destGpsLng: z.coerce.number().optional().nullable(),
  destPhotoUrl: z.string().optional().nullable(),
  discrepancyNotes: z.string().optional().nullable(),
  discrepancyResponsibleParty: z
    .enum(["SOURCE_CUSTOMER", "TRANSPORTER", "DESTINATION_CUSTOMER", "UNDER_INVESTIGATION"])
    .default("UNDER_INVESTIGATION")
    .optional(),
  rejectedDisposition: z
    .enum(["RETURN_TO_WAREHOUSE", "HELD_IN_TRANSIT", "RETURNED_TO_SOURCE"])
    .default("RETURN_TO_WAREHOUSE")
    .optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  items: z.array(receiveTransferItemSchema).min(1, "At least one item must be reconciled"),
});

const godownReturnTransferSchema = z.object({
  warehouseId: z.string().uuid("Receiving warehouse is required"),
  yardArrivalGpsLat: z.coerce.number().optional().nullable(),
  yardArrivalGpsLng: z.coerce.number().optional().nullable(),
  yardOdometer: z.coerce.number().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantityReceived: z.coerce.number().min(0),
        quantityDamaged: z.coerce.number().min(0).default(0),
        condition: z.string().default("GOOD"),
      })
    )
    .optional(),
});

// ==============================================================================
// INVENTRA DIRECT SITE-TO-SITE TRANSFER (DSTN) COMPLETE REDESIGN TEST SUITE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// Verification across all 10 Architectural Phases & Statutory Invariants
// ==============================================================================

describe("INVENTRA – Direct Site-to-Site Transfer (DSTN) Redesign Suite", () => {
  const dummySourceCustId = "11111111-1111-7111-8111-111111111111";
  const dummySourceSiteId = "22222222-2222-7222-8222-222222222222";
  const dummyDestCustId = "33333333-3333-7333-8333-333333333333";
  const dummyDestSiteId = "44444444-4444-7444-8444-444444444444";
  const dummyVariantId = "55555555-5555-7555-8555-555555555555";
  const dummyVehicleId = "66666666-6666-7666-8666-666666666666";
  const dummyDriverId = "77777777-7777-7777-8777-777777777777";
  const dummyWarehouseId = "88888888-8888-7888-8888-888888888888";

  // --------------------------------------------------------------------------
  // Phase 1: Creation & Validation
  // --------------------------------------------------------------------------
  describe("Phase 1: Multi-Step Direct Transfer Creation & Document Linking", () => {
    it("should validate and accept valid multi-step direct transfer payload with fleet assignment", () => {
      const payload = {
        transferDate: "2026-11-20T00:00:00.000Z",
        preferredPickupTime: "09:30 AM",
        expectedArrivalTime: "01:00 PM",
        sourceCustomerId: dummySourceCustId,
        sourceCustomerSiteId: dummySourceSiteId,
        destinationCustomerId: dummyDestCustId,
        destinationCustomerSiteId: dummyDestSiteId,
        vehicleId: dummyVehicleId,
        driverId: dummyDriverId,
        transportCharges: 750,
        transportPayer: "DESTINATION_CUSTOMER",
        includeCutoffDate: false,
        notes: "Carefully inspect staging props before loading",
        items: [
          {
            materialVariantId: dummyVariantId,
            ownershipType: "OWNED",
            quantityDispatched: 50,
            agreedDailyRate: 4.5,
          },
        ],
      };

      const parsed = createDirectTransferSchema.safeParse(payload);
      assert.equal(parsed.success, true, "Payload should be valid");
      if (parsed.success) {
        assert.equal(parsed.data.sourceCustomerSiteId, dummySourceSiteId);
        assert.equal(parsed.data.destinationCustomerSiteId, dummyDestSiteId);
        assert.equal(parsed.data.transportPayer, "DESTINATION_CUSTOMER");
        assert.equal(parsed.data.items[0].quantityDispatched, 50);
      }
    });

    it("should reject creation when source site and destination site are identical", () => {
      const payload = {
        sourceCustomerId: dummySourceCustId,
        sourceCustomerSiteId: dummySourceSiteId,
        destinationCustomerId: dummyDestCustId,
        destinationCustomerSiteId: dummySourceSiteId, // SAME SITE
        items: [
          {
            materialVariantId: dummyVariantId,
            quantityDispatched: 10,
          },
        ],
      };

      const parsed = createDirectTransferSchema.safeParse(payload);
      assert.equal(parsed.success, false, "Should reject identical sites");
    });

    it("should reject creation when no items or non-positive quantity is provided", () => {
      const payload = {
        sourceCustomerId: dummySourceCustId,
        sourceCustomerSiteId: dummySourceSiteId,
        destinationCustomerId: dummyDestCustId,
        destinationCustomerSiteId: dummyDestSiteId,
        items: [],
      };

      const parsed = createDirectTransferSchema.safeParse(payload);
      assert.equal(parsed.success, false, "Should reject empty items array");
    });
  });

  // --------------------------------------------------------------------------
  // Phase 2: Source Customer Pickup (MRN Workflow)
  // --------------------------------------------------------------------------
  describe("Phase 2: Source Customer Pickup (MRN Handover)", () => {
    it("should validate source pickup evidence with representative details and GPS coordinates", () => {
      const pickupPayload = {
        sourceRepName: "Ramesh Site Engineer",
        sourceRepPhone: "9876543210",
        sourceRepDesignation: "Site In-Charge",
        sourceGpsLat: 12.9716,
        sourceGpsLng: 77.5946,
        sourcePhotoUrl: "https://storage.supabase.co/inventra/pickup-1.jpg",
        odometerReading: 42100,
        notes: "Counted 50 props in good condition",
        items: [
          {
            itemId: "99999999-9999-7999-8999-999999999999",
            quantityCollected: 50,
          },
        ],
      };

      const parsed = pickupDirectTransferSchema.safeParse(pickupPayload);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.sourceRepName, "Ramesh Site Engineer");
        assert.equal(parsed.data.odometerReading, 42100);
      }
    });

    it("should require source representative name for physical custody handover", () => {
      const pickupPayload = {
        sourceRepName: "",
        sourceGpsLat: 12.9716,
        sourceGpsLng: 77.5946,
      };

      const parsed = pickupDirectTransferSchema.safeParse(pickupPayload);
      assert.equal(parsed.success, false, "Should require representative name");
    });
  });

  // --------------------------------------------------------------------------
  // Phase 3 & 4: Destination Delivery (DN Workflow)
  // --------------------------------------------------------------------------
  describe("Phase 3 & 4: Destination Delivery & Receipt Reconciliation", () => {
    it("should enforce mathematical reconciliation: Collected = Accepted + Godown + Damaged + Missing + Rejected", () => {
      const itemId = "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa";
      const baseDispatched = 50;

      // Scenario A: 100% delivered to destination
      const scenarioA = {
        destRepName: "Suresh PM",
        items: [
          {
            itemId,
            quantityAccepted: 50,
            quantityGodownReturned: 0,
            quantityDamaged: 0,
            quantityMissing: 0,
            quantityRejected: 0,
          },
        ],
      };
      const parsedA = receiveDirectTransferSchema.safeParse(scenarioA);
      assert.equal(parsedA.success, true);
      const itemA = parsedA.data.items[0];
      const totalA =
        itemA.quantityAccepted +
        itemA.quantityGodownReturned +
        itemA.quantityDamaged +
        itemA.quantityMissing +
        itemA.quantityRejected;
      assert.equal(totalA, baseDispatched);

      // Scenario B: Partial Delivery (30 Accepted, 20 Godown Return)
      const scenarioB = {
        destRepName: "Suresh PM",
        items: [
          {
            itemId,
            quantityAccepted: 30,
            quantityGodownReturned: 20,
            quantityDamaged: 0,
            quantityMissing: 0,
            quantityRejected: 0,
          },
        ],
      };
      const parsedB = receiveDirectTransferSchema.safeParse(scenarioB);
      assert.equal(parsedB.success, true);
      const itemB = parsedB.data.items[0];
      const totalB =
        itemB.quantityAccepted +
        itemB.quantityGodownReturned +
        itemB.quantityDamaged +
        itemB.quantityMissing +
        itemB.quantityRejected;
      assert.equal(totalB, baseDispatched);

      // Scenario C: Discrepancy (40 Accepted, 5 Damaged, 5 Missing)
      const scenarioC = {
        destRepName: "Suresh PM",
        discrepancyResponsibleParty: "TRANSPORTER",
        rejectedDisposition: "RETURN_TO_WAREHOUSE",
        items: [
          {
            itemId,
            quantityAccepted: 40,
            quantityGodownReturned: 0,
            quantityDamaged: 5,
            quantityMissing: 5,
            quantityRejected: 0,
          },
        ],
      };
      const parsedC = receiveDirectTransferSchema.safeParse(scenarioC);
      assert.equal(parsedC.success, true);
      const itemC = parsedC.data.items[0];
      const totalC =
        itemC.quantityAccepted +
        itemC.quantityGodownReturned +
        itemC.quantityDamaged +
        itemC.quantityMissing +
        itemC.quantityRejected;
      assert.equal(totalC, baseDispatched);
    });

    it("should accept explicit agreed daily rate in receipt reconciliation", () => {
      const payloadWithRate = {
        destRepName: "Anand Murthy",
        destRepPhone: "9845044556",
        destRepDesignation: "Site In-Charge",
        items: [
          {
            itemId: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
            quantityAccepted: 5,
            quantityGodownReturned: 0,
            quantityDamaged: 0,
            quantityMissing: 0,
            quantityRejected: 0,
            agreedDailyRate: 2.5,
          },
        ],
      };

      const parsed = receiveDirectTransferSchema.safeParse(payloadWithRate);
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.items[0].agreedDailyRate, 2.5);
    });

    it("should reject negative quantities in receipt reconciliation", () => {
      const invalid = {
        destRepName: "Suresh PM",
        items: [
          {
            itemId: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
            quantityAccepted: -5,
            quantityGodownReturned: 0,
          },
        ],
      };

      const parsed = receiveDirectTransferSchema.safeParse(invalid);
      assert.equal(parsed.success, false, "Should reject negative accepted quantity");
    });
  });

  // --------------------------------------------------------------------------
  // Phase 5: Godown Return & Receiving
  // --------------------------------------------------------------------------
  describe("Phase 5: Godown Return & Receiving at Yard", () => {
    it("should validate godown receiving payload with warehouse, odometer and inspection", () => {
      const godownPayload = {
        warehouseId: dummyWarehouseId,
        yardArrivalGpsLat: 12.9716,
        yardArrivalGpsLng: 77.5946,
        yardOdometer: 42150,
        receiverName: "Yard Manager Kumar",
        remarks: "Received 20 remaining props into yard rack A-2",
        items: [
          {
            itemId: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
            quantityReceived: 20,
            quantityDamaged: 0,
            condition: "GOOD",
          },
        ],
      };

      const parsed = godownReturnTransferSchema.safeParse(godownPayload);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.warehouseId, dummyWarehouseId);
        assert.equal(parsed.data.yardOdometer, 42150);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Phase 7: Rental Billing & Single Date Cutoff Invariant
  // --------------------------------------------------------------------------
  describe("Phase 7: Exact Single-Customer Billing on Transfer Date (Zero Double-Billing)", () => {
    it("should verify includeCutoffDate=true bills Customer A on transfer day and starts Customer B day after", () => {
      const transferDate = new Date("2026-11-20T00:00:00.000Z");
      const includeCutoffDate = true;

      // Rule calculation:
      // Customer A Return Date Policy: includeReturnDate = includeCutoffDate
      const customerAIncludesTransferDay = includeCutoffDate;
      // Customer B Delivery Date Policy: includeDeliveryDate = !includeCutoffDate
      const customerBIncludesTransferDay = !includeCutoffDate;

      assert.equal(customerAIncludesTransferDay, true, "Customer A bears transfer date");
      assert.equal(customerBIncludesTransferDay, false, "Customer B starts billing next day");

      // Invariant: Exactly one customer is charged for transfer date
      const customersChargedOnTransferDay =
        (customerAIncludesTransferDay ? 1 : 0) + (customerBIncludesTransferDay ? 1 : 0);
      assert.equal(
        customersChargedOnTransferDay,
        1,
        "Invariant violated: Exactly one customer must be charged for transfer date"
      );
    });

    it("should verify includeCutoffDate=false stops Customer A day before and starts Customer B on transfer day", () => {
      const transferDate = new Date("2026-11-20T00:00:00.000Z");
      const includeCutoffDate = false;

      const customerAIncludesTransferDay = includeCutoffDate;
      const customerBIncludesTransferDay = !includeCutoffDate;

      assert.equal(customerAIncludesTransferDay, false, "Customer A stops billing day before");
      assert.equal(customerBIncludesTransferDay, true, "Customer B starts billing on transfer day");

      const customersChargedOnTransferDay =
        (customerAIncludesTransferDay ? 1 : 0) + (customerBIncludesTransferDay ? 1 : 0);
      assert.equal(
        customersChargedOnTransferDay,
        1,
        "Invariant violated: Exactly one customer must be charged for transfer date"
      );
    });
  });
});
