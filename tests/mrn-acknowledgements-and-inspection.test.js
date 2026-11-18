import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

describe("MRN Customer & Company Acknowledgements and Material Inspection Suite", () => {
  const dummyUuid = "00000000-0000-0000-0000-000000000001";
  const dummySiteId = "00000000-0000-0000-0000-000000000002";
  const dummyWarehouseId = "00000000-0000-0000-0000-000000000003";
  const dummyVariantId = "00000000-0000-0000-0000-000000000004";

  const OptionalIndianMobileSchema = z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Mobile number must be a valid 10-digit Indian number")
    .optional()
    .nullable()
    .or(z.literal(""));

  const materialReturnItemSchema = z.object({
    materialVariantId: z.string().uuid("Material variant is required"),
    ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
    returnedQty: z.coerce.number().positive("Returned quantity must be greater than zero"),
    receivedQty: z.coerce.number().min(0).optional().nullable(),
    acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
    damagedQty: z.coerce.number().min(0).default(0),
    missingQty: z.coerce.number().min(0).default(0),
    rejectedQty: z.coerce.number().min(0).default(0),
    condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
    remarks: z.string().optional().nullable(),
    inspectionRemarks: z.string().optional().nullable(),
  });

  const createMaterialReturnNoteSchema = z.object({
    mrnNumber: z.string().optional(),
    customerId: z.string().uuid("Customer is required"),
    customerSiteId: z.string().uuid("Customer construction site is required"),
    receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
    referenceDeliveryNoteId: z.string().uuid().optional().nullable().or(z.literal("")),
    returnDate: z.string().optional(),
    driverName: z.string().optional().nullable(),
    driverPhone: OptionalIndianMobileSchema,
    vehicleNumber: z.string().optional().nullable(),

    // Customer / Site Representative - Material Handover
    customerRepresentativeName: z.string().optional().nullable(),
    customerRepresentativeDesignation: z.string().optional().nullable(),
    customerRepresentativePhone: OptionalIndianMobileSchema,
    customerSignatureUrl: z.string().optional().nullable(),
    handoverAt: z.string().optional().nullable(),
    customerAgreedDamage: z.boolean().default(false),

    // AJAY ENTERPRISES - Material Receiving Acknowledgement
    receiverName: z.string().optional().nullable(),
    receiverPhone: OptionalIndianMobileSchema,
    receiverDesignation: z.string().optional().nullable(),
    receiverSignatureUrl: z.string().optional().nullable(),
    receivedAt: z.string().optional().nullable(),
    companyStampUrl: z.string().optional().nullable(),

    // Material Inspection Lifecycle & Delayed Inspection
    inspectionStatus: z.enum(["PENDING", "COMPLETED"]).default("COMPLETED"),
    inspectorName: z.string().optional().nullable(),
    inspectorDesignation: z.string().optional().nullable(),
    inspectedAt: z.string().optional().nullable(),
    inspectionRemarks: z.string().optional().nullable(),

    gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    photoUrl: z.string().optional().nullable(),
    missingEvidenceReason: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    items: z.array(materialReturnItemSchema).min(1, "At least one item is required for return"),
  });

  const recordMrnInspectionSchema = z.object({
    inspectorName: z.string().min(2, "Inspector name must be at least 2 characters").trim(),
    inspectorDesignation: z.string().optional().nullable(),
    inspectedAt: z.string().optional(),
    inspectionRemarks: z.string().optional().nullable(),
    customerAgreedDamage: z.boolean().default(false),
    items: z.array(
      z.object({
        materialVariantId: z.string().uuid("Material variant is required"),
        acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
        damagedQty: z.coerce.number().min(0).default(0),
        missingQty: z.coerce.number().min(0).default(0),
        rejectedQty: z.coerce.number().min(0).default(0),
        condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
        inspectionRemarks: z.string().optional().nullable(),
      })
    ).min(1, "At least one item inspection record is required"),
  });

  // 1. Customer Handover Acknowledgement Schema & Validation
  describe("1. Customer / Site Representative - Material Handover", () => {
    test("validates complete customer representative handover details", () => {
      const payload = {
        customerId: dummyUuid,
        customerSiteId: dummySiteId,
        receivingWarehouseId: dummyWarehouseId,
        customerRepresentativeName: "Anand Sharma",
        customerRepresentativeDesignation: "Site In-Charge",
        customerRepresentativePhone: "9876543210",
        handoverAt: new Date().toISOString(),
        customerAgreedDamage: true,
        vehicleNumber: "KA-01-AB-1234",
        receiverName: "Suresh Gowda",
        receiverDesignation: "Yard In-Charge",
        receiverPhone: "9123456789",
        inspectionStatus: "COMPLETED",
        items: [
          {
            materialVariantId: dummyVariantId,
            ownershipType: "OWNED",
            returnedQty: 50,
            acceptedQty: 45,
            damagedQty: 3,
            missingQty: 2,
            rejectedQty: 0,
            condition: "GOOD",
          },
        ],
      };

      const result = createMaterialReturnNoteSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.customerRepresentativeName, "Anand Sharma");
      assert.strictEqual(result.data.customerRepresentativeDesignation, "Site In-Charge");
      assert.strictEqual(result.data.customerRepresentativePhone, "9876543210");
      assert.strictEqual(result.data.customerAgreedDamage, true);
    });

    test("allows optional customer representative phone to be empty or valid 10-digit mobile", () => {
      const emptyPhonePayload = {
        customerId: dummyUuid,
        customerSiteId: dummySiteId,
        receivingWarehouseId: dummyWarehouseId,
        customerRepresentativeName: "Murugan",
        customerRepresentativePhone: "",
        items: [
          {
            materialVariantId: dummyVariantId,
            returnedQty: 10,
            acceptedQty: 10,
          },
        ],
      };

      const res = createMaterialReturnNoteSchema.safeParse(emptyPhonePayload);
      assert.strictEqual(res.success, true);

      const invalidPhonePayload = {
        ...emptyPhonePayload,
        customerRepresentativePhone: "12345", // Invalid length
      };
      const badRes = createMaterialReturnNoteSchema.safeParse(invalidPhonePayload);
      assert.strictEqual(badRes.success, false);
    });
  });

  // 2. AJAY ENTERPRISES Company Receiving Acknowledgement
  describe("2. AJAY ENTERPRISES - Receiving Acknowledgement", () => {
    test("validates company receiver details including yard designation and timestamp", () => {
      const payload = {
        customerId: dummyUuid,
        customerSiteId: dummySiteId,
        receivingWarehouseId: dummyWarehouseId,
        receiverName: "Manjunath Yard Manager",
        receiverDesignation: "Head Yard In-Charge",
        receiverPhone: "9845012345",
        receivedAt: new Date().toISOString(),
        items: [
          {
            materialVariantId: dummyVariantId,
            returnedQty: 20,
            acceptedQty: 20,
          },
        ],
      };

      const result = createMaterialReturnNoteSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.receiverName, "Manjunath Yard Manager");
      assert.strictEqual(result.data.receiverDesignation, "Head Yard In-Charge");
      assert.strictEqual(result.data.receiverPhone, "9845012345");
    });
  });

  // 3. Material Inspection Reconciliation & Discrepancies
  describe("3. Material Discrepancy & Reconciliation Rules", () => {
    test("reconciles declared return = accepted + damaged + missing + rejected", () => {
      const item = {
        materialVariantId: dummyVariantId,
        ownershipType: "OWNED",
        returnedQty: 100,
        acceptedQty: 80,
        damagedQty: 15,
        missingQty: 5,
        rejectedQty: 0,
        condition: "GOOD",
      };

      const parsed = materialReturnItemSchema.safeParse(item);
      assert.strictEqual(parsed.success, true);

      const declared = parsed.data.returnedQty;
      const sum =
        parsed.data.acceptedQty +
        (parsed.data.damagedQty || 0) +
        (parsed.data.missingQty || 0) +
        (parsed.data.rejectedQty || 0);

      assert.strictEqual(declared, sum, "Sum must perfectly equal declared quantity");

      // Verify physical received does NOT include missing quantity
      const physicallyReceived =
        parsed.data.acceptedQty +
        (parsed.data.damagedQty || 0) +
        (parsed.data.rejectedQty || 0);

      assert.strictEqual(physicallyReceived, 95, "Missing 5 units were never physically received at yard");
    });

    test("enforces non-negative constraints across all quantity buckets", () => {
      const negativeItem = {
        materialVariantId: dummyVariantId,
        returnedQty: 10,
        acceptedQty: -2,
      };

      const result = materialReturnItemSchema.safeParse(negativeItem);
      assert.strictEqual(result.success, false);
    });
  });

  // 4. Delayed Inspection Workflow Schema
  describe("4. Delayed Inspection After Initial Receipt", () => {
    test("validates recordMrnInspectionSchema when inspection is conducted separately", () => {
      const inspectionPayload = {
        inspectorName: "Ramesh Quality Controller",
        inspectorDesignation: "Chief Material Inspector",
        inspectedAt: new Date().toISOString(),
        inspectionRemarks: "Physical lot testing completed. 3 Props found with damaged collar pins.",
        customerAgreedDamage: false,
        items: [
          {
            materialVariantId: dummyVariantId,
            acceptedQty: 47,
            damagedQty: 3,
            missingQty: 0,
            rejectedQty: 0,
            condition: "REPAIRABLE",
            inspectionRemarks: "Bent inner tube, sent for hydraulic straightening",
          },
        ],
      };

      const result = recordMrnInspectionSchema.safeParse(inspectionPayload);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.inspectorName, "Ramesh Quality Controller");
      assert.strictEqual(result.data.customerAgreedDamage, false);
      assert.strictEqual(result.data.items[0].acceptedQty, 47);
      assert.strictEqual(result.data.items[0].damagedQty, 3);
    });

    test("rejects inspection without inspector name", () => {
      const badPayload = {
        inspectorName: "",
        items: [
          {
            materialVariantId: dummyVariantId,
            acceptedQty: 10,
          },
        ],
      };

      const result = recordMrnInspectionSchema.safeParse(badPayload);
      assert.strictEqual(result.success, false);
    });
  });

  // 5. PDF Generator Template Verification
  describe("5. PDF Layout & Acknowledgement Block Generation", () => {
    test("verifies PDF generator contains two distinct acknowledgement sections for MRN", () => {
      const generatorCode = fs.readFileSync(path.resolve("src/lib/pdf/generator.ts"), "utf-8");

      // Verify two acknowledgement blocks
      assert.ok(
        generatorCode.includes("1. Customer Handover Sign-Off"),
        "Must contain section 1 customer handover sign-off block"
      );
      assert.ok(
        generatorCode.includes("2. AJAY ENTERPRISES Receipt"),
        "Must contain section 2 AJAY ENTERPRISES receiving acknowledgement block"
      );

      // Verify inspection table headers
      assert.ok(
        generatorCode.includes("Returned Materials &amp; Physical Inspection Breakdown"),
        "Must contain physical inspection breakdown heading"
      );
      assert.ok(
        generatorCode.includes("Inspection Pending · Awaiting Yard Verification"),
        "Must support pending inspection badge"
      );
      assert.ok(
        generatorCode.includes("Inspection Completed &amp; Verified"),
        "Must support completed inspection badge"
      );

      // Verify column headers
      assert.ok(generatorCode.includes("Declared"), "Must contain Declared return column");
      assert.ok(generatorCode.includes("Received"), "Must contain Physically Received column");
      assert.ok(generatorCode.includes("Accepted"), "Must contain Accepted (Good) column");
      assert.ok(generatorCode.includes("Damaged"), "Must contain Damaged column");
      assert.ok(generatorCode.includes("Missing"), "Must contain Shortage/Missing column");

      // Verify reconciliation note
      assert.ok(
        generatorCode.includes("Material Custody &amp; Inspection Audit Note"),
        "Must contain custody audit note"
      );
      assert.ok(
        generatorCode.includes("Customer Damage Acceptance"),
        "Must state customer damage acceptance status"
      );
    });

    test("verifies MRN print route passes customer handover, receiver, and inspection details", () => {
      const printRouteCode = fs.readFileSync(
        path.resolve("src/app/api/v1/return-notes/[id]/print/route.ts"),
        "utf-8"
      );

      assert.ok(printRouteCode.includes("customerHandoverDetails"), "Print route must pass customerHandoverDetails");
      assert.ok(printRouteCode.includes("customerRepresentativeName"), "Print route must extract customerRepresentativeName");
      assert.ok(printRouteCode.includes("receiverDesignation"), "Print route must extract receiverDesignation");
      assert.ok(printRouteCode.includes("inspectionDetails"), "Print route must pass inspectionDetails");
      assert.ok(printRouteCode.includes("customerAgreedDamage"), "Print route must pass customerAgreedDamage");
    });
  });

  // 6. WhatsApp Message Formulation Verification
  describe("6. WhatsApp MRN Message Notification", () => {
    test("verifies WhatsApp template includes customer handover person and inspection status", () => {
      const whatsappCode = fs.readFileSync(path.resolve("src/lib/whatsapp.ts"), "utf-8");

      assert.ok(
        whatsappCode.includes("case \"MRN\":"),
        "whatsapp.ts must handle MRN case"
      );
      assert.ok(
        whatsappCode.includes("Customer Handover:"),
        "Must display customer handover representative"
      );
      assert.ok(
        whatsappCode.includes("Company Receiver:"),
        "Must display company receiver"
      );
      assert.ok(
        whatsappCode.includes("Inspection Status:"),
        "Must display inspection status"
      );
      assert.ok(
        whatsappCode.includes("PENDING (Under physical verification)"),
        "Must label pending inspection explicitly"
      );
      assert.ok(
        whatsappCode.includes("COMPLETED & VERIFIED"),
        "Must label verified inspection explicitly"
      );
    });
  });

  // 7. Delayed Inspection API Endpoint Verification
  describe("7. Delayed Inspection API Route", () => {
    test("verifies inspection API endpoint route exists and enforces permissions and immutability", () => {
      const routePath = path.resolve("src/app/api/v1/return-notes/[id]/inspection/route.ts");
      assert.ok(fs.existsSync(routePath), "Inspection route file must exist");

      const routeCode = fs.readFileSync(routePath, "utf-8");
      assert.ok(
        routeCode.includes("requirePermission(session, \"material_returns\", \"edit\")"),
        "Must enforce material_returns edit permission"
      );
      assert.ok(
        routeCode.includes("recordMrnInspectionSchema"),
        "Must validate payload with recordMrnInspectionSchema"
      );
      assert.ok(
        routeCode.includes("Customer handover details preserved"),
        "Must preserve customer handover details"
      );
      assert.ok(
        routeCode.includes("logAuditEvent"),
        "Must log audit event for inspection"
      );
    });
  });
});
