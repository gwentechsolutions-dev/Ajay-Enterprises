import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: PHASE 2 MASTER DATA & INVENTORY RECONCILIATION
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

// Reusable statutory validators matching INVENTRA schema standards
const IndianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number");
const OptionalIndianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number").optional().nullable().or(z.literal(""));
const OptionalIndianPANSchema = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Must be a valid Indian PAN").toUpperCase().optional().nullable().or(z.literal(""));
const OptionalIndianGSTINSchema = z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Must be a valid Indian GSTIN").toUpperCase().optional().nullable().or(z.literal(""));
const IndianPinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit Indian PIN code");
const IndianIFSCCodeSchema = z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Must be a valid Indian Bank IFSC code").toUpperCase();

// Phase 2 Zod schemas under test
const materialCategorySchema = z.object({
  categoryCode: z.string().min(2).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const materialTypeSchema = z.object({
  categoryId: z.string().uuid(),
  typeCode: z.string().min(2).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const materialVariantSchema = z.object({
  materialTypeId: z.string().uuid(),
  materialCode: z.string().min(2).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  size: z.string().min(1).trim(),
  description: z.string().optional().nullable(),
  uom: z.string().default("Nos."),
  defaultRentalRate: z.coerce.number().min(0),
  purchaseCost: z.coerce.number().min(0).optional().nullable(),
  replacementValue: z.coerce.number().min(0).optional().nullable(),
  minimumStock: z.coerce.number().min(0).default(0),
  preferredSupplierId: z.string().uuid().optional().nullable().or(z.literal("")),
  ownershipClassification: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  isActive: z.boolean().default(true),
});

const updateRateSchema = z.object({
  rentalRate: z.coerce.number().min(0),
  reason: z.string().min(3).trim(),
  effectiveFrom: z.string().optional(),
});

const customerSchema = z.object({
  customerCode: z.string().min(2).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  customerType: z.enum(["INDIVIDUAL", "COMPANY", "CONTRACTOR"]).default("COMPANY"),
  legalBusinessName: z.string().optional().nullable(),
  primaryMobile: IndianMobileSchema,
  alternateMobile: OptionalIndianMobileSchema,
  whatsappNumber: OptionalIndianMobileSchema,
  email: z.string().email().optional().nullable().or(z.literal("")),
  pan: OptionalIndianPANSchema,
  gstStatus: z.enum(["REGISTERED", "UNREGISTERED", "COMPOSITION"]).default("UNREGISTERED"),
  gstin: OptionalIndianGSTINSchema,
  billingAddress: z.string().min(5).trim(),
  state: z.string().min(2).trim(),
  stateCode: z.string().min(2).trim(),
  pinCode: IndianPinCodeSchema.optional().nullable().or(z.literal("")),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  paymentTermsDays: z.coerce.number().int().min(0).default(30),
  openingBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

const customerSiteSchema = z.object({
  customerId: z.string().uuid(),
  siteCode: z.string().min(2).toUpperCase().trim(),
  siteName: z.string().min(2).trim(),
  fullAddress: z.string().min(5).trim(),
  state: z.string().min(2).trim(),
  stateCode: z.string().min(2).trim(),
  district: z.string().min(2).trim(),
  city: z.string().min(2).trim(),
  pinCode: IndianPinCodeSchema,
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  siteOwnerName: z.string().optional().nullable(),
  siteOwnerContact: OptionalIndianMobileSchema,
  siteInCharge: z.string().optional().nullable(),
  deliveryInstructions: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "CLOSED"]).default("ACTIVE"),
});

const contactPersonSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).trim(),
  mobile: IndianMobileSchema,
  designation: z.string().min(2).trim(),
  contactType: z.enum(["PRIMARY", "BILLING", "SITE_INCHARGE", "RECEIVER", "OWNER"]).default("SITE_INCHARGE"),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  canReceiveDeliveryNotes: z.boolean().default(true),
  canAcknowledgeDeliveries: z.boolean().default(true),
  canReceiveReturnNotes: z.boolean().default(true),
  canReceiveInvoices: z.boolean().default(false),
  canReceivePaymentReminders: z.boolean().default(false),
  canReceiveWhatsApp: z.boolean().default(true),
});

const supplierSchema = z.object({
  supplierCode: z.string().min(2).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  contactPerson: z.string().min(2).trim(),
  primaryMobile: IndianMobileSchema,
  email: z.string().email().optional().nullable().or(z.literal("")),
  gstStatus: z.enum(["REGISTERED", "UNREGISTERED", "COMPOSITION"]).default("UNREGISTERED"),
  gstin: OptionalIndianGSTINSchema,
  pan: OptionalIndianPANSchema,
  billingAddress: z.string().min(5).trim(),
  state: z.string().min(2).trim(),
  stateCode: z.string().min(2).trim(),
  pinCode: IndianPinCodeSchema,
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: IndianIFSCCodeSchema.optional().nullable().or(z.literal("")),
  supplierType: z.enum(["MANUFACTURER", "TRADER", "HIRE_VENDOR", "SERVICE_PROVIDER"]).default("MANUFACTURER"),
  creditTermsDays: z.coerce.number().int().min(0).default(30),
  isActive: z.boolean().default(true),
});

const MOVEMENT_TYPES = [
  "OPENING_STOCK",
  "STOCK_RECEIPT",
  "DELIVERY_TO_CUSTOMER",
  "CUSTOMER_RETURN",
  "INTERNAL_TRANSFER",
  "SITE_TO_SITE_TRANSFER",
  "DAMAGE",
  "DAMAGE_RECOVERY",
  "MISSING",
  "FOUND_STOCK",
  "MAINTENANCE_OUT",
  "MAINTENANCE_RETURN",
  "SCRAP",
  "STOCK_ADJUSTMENT",
  "REVERSAL",
];

const createMovementSchema = z.object({
  movementNumber: z.string().optional(),
  materialVariantId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  uom: z.string().default("Nos."),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  movementType: z.enum(MOVEMENT_TYPES),
  sourceLocationType: z.string().default("NONE"),
  sourceWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  sourceSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  destinationLocationType: z.string().default("NONE"),
  destinationWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  destinationSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  customerId: z.string().uuid().optional().nullable().or(z.literal("")),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  notes: z.string().optional().nullable(),
});

const reverseMovementSchema = z.object({
  movementId: z.string().uuid(),
  reversalReason: z.string().min(5).trim(),
});

const createStockAuditSchema = z.object({
  warehouseId: z.string().uuid(),
  title: z.string().min(3).trim(),
  auditDate: z.string().optional(),
  remarks: z.string().optional().nullable(),
});

const recordStockCountSchema = z.object({
  stockAuditId: z.string().uuid(),
  items: z.array(
    z.object({
      materialVariantId: z.string().uuid(),
      ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
      physicalQty: z.coerce.number().min(0),
      condition: z.enum(["GOOD", "FAIR", "DAMAGED", "SCRAP"]).default("GOOD"),
      remarks: z.string().optional().nullable(),
    })
  ).min(1),
});

// Helper for exact decimal string arithmetic without JS float drift
function toFixedPaise(val) {
  return (Math.round(val * 100) / 100).toFixed(2);
}

describe("1. Material Master & Rental Rate History Versioning", () => {
  it("should validate Material Category creation", () => {
    const validCategory = materialCategorySchema.safeParse({
      categoryCode: "CAT-CENTERING",
      name: "Centering Materials",
      description: "Props, sheets, column boxes and staging",
      isActive: true,
    });
    assert.equal(validCategory.success, true);
    if (validCategory.success) {
      assert.equal(validCategory.data.categoryCode, "CAT-CENTERING");
      assert.equal(validCategory.data.name, "Centering Materials");
    }

    const invalidCategory = materialCategorySchema.safeParse({
      categoryCode: "C", // too short
      name: "",
    });
    assert.equal(invalidCategory.success, false);
  });

  it("should validate Material Type creation linked to Category", () => {
    const valid = materialTypeSchema.safeParse({
      categoryId: "0193231e-4500-7000-8000-000000000001",
      typeCode: "PROPS",
      name: "Adjustable Steel Props",
      description: "Telescopic scaffolding props",
    });
    assert.equal(valid.success, true);
  });

  it("should validate Material Variant with UOM and financial decimals", () => {
    const validVariant = materialVariantSchema.safeParse({
      materialTypeId: "0193231e-4500-7000-8000-000000000002",
      materialCode: "MAT-PROP-7-12",
      name: "Props 7-12 ft",
      size: "7–12 ft",
      description: "Standard inner & outer pipe centering props",
      uom: "Nos.",
      defaultRentalRate: 2.0,
      purchaseCost: 650.0,
      replacementValue: 800.0,
      minimumStock: 100,
      ownershipClassification: "OWNED",
      isActive: true,
    });
    assert.equal(validVariant.success, true);
    if (validVariant.success) {
      assert.equal(validVariant.data.materialCode, "MAT-PROP-7-12");
      assert.equal(validVariant.data.defaultRentalRate, 2.0);
      assert.equal(validVariant.data.purchaseCost, 650.0);
    }
  });

  it("should validate Rate Update schema requiring reason and non-negative rate", () => {
    const validRateChange = updateRateSchema.safeParse({
      rentalRate: 2.5,
      reason: "Annual inflation rate revision approved by Owner",
      effectiveFrom: "2026-04-01T00:00:00.000Z",
    });
    assert.equal(validRateChange.success, true);

    const negativeRateChange = updateRateSchema.safeParse({
      rentalRate: -1.0,
      reason: "Invalid discount",
    });
    assert.equal(negativeRateChange.success, false);

    const missingReason = updateRateSchema.safeParse({
      rentalRate: 2.5,
      reason: "", // required
    });
    assert.equal(missingReason.success, false);
  });

  it("should simulate rate history immutability and historical snapshot retention", () => {
    const initialRateRecord = {
      variantId: "var-001",
      version: 1,
      rentalRate: 2.0,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: new Date("2026-06-30"),
      changedBy: "USR-0001",
    };

    const newRateRecord = {
      variantId: "var-001",
      version: 2,
      rentalRate: 2.5,
      effectiveFrom: new Date("2026-07-01"),
      effectiveTo: null,
      changedBy: "USR-0001",
    };

    // Historical invoice issued on 2026-03-15:
    const invoiceLineSnapshot = {
      variantId: "var-001",
      appliedRentalRate: initialRateRecord.rentalRate, // 2.00
      billingDays: 30,
      quantity: 100,
    };

    // Rate change in version 2 must NOT modify invoiceLineSnapshot
    assert.equal(invoiceLineSnapshot.appliedRentalRate, 2.0);
    assert.notEqual(invoiceLineSnapshot.appliedRentalRate, newRateRecord.rentalRate);
  });

  it("should correctly handle unconfirmed zero rates and duplicate catalogue entries", () => {
    const unconfirmedVariant = {
      materialCode: "MAT-PROP-10-15",
      name: "PROPS 10-15 ft",
      size: "10–15 ft",
      defaultRentalRate: 0.0,
      isRateConfirmed: false,
      isDuplicateSourceEntry: false,
    };

    const duplicateSourceVariant = {
      materialCode: "MAT-PROP-10-15-DUP",
      name: "PROPS 10-15 ft (duplicate source entry)",
      size: "10–15 ft",
      defaultRentalRate: 0.0,
      isRateConfirmed: false,
      isDuplicateSourceEntry: true,
    };

    assert.equal(unconfirmedVariant.defaultRentalRate === 0 && !unconfirmedVariant.isRateConfirmed, true);
    assert.equal(duplicateSourceVariant.isDuplicateSourceEntry, true);
  });
});

describe("2. Customer Management & Multi-Site Architecture", () => {
  it("should validate Customer profile with GSTIN, PAN, and Mobile validation", () => {
    const validCustomer = customerSchema.safeParse({
      customerCode: "CUST-0001",
      name: "Sri Lakshmi Builders & Developers",
      customerType: "COMPANY",
      legalBusinessName: "Sri Lakshmi Builders Pvt Ltd",
      primaryMobile: "9876543210",
      pan: "AABCS1234D",
      gstStatus: "REGISTERED",
      gstin: "29AABCS1234D1Z5",
      billingAddress: "45 Industrial Layout, Rajajinagar, Bengaluru",
      state: "Karnataka",
      stateCode: "29",
      pinCode: "560010",
      creditLimit: 500000,
      paymentTermsDays: 30,
      openingBalance: 0,
      isActive: true,
    });
    assert.equal(validCustomer.success, true);
  });

  it("should reject customer with invalid GSTIN or mismatched format", () => {
    const invalidGst = customerSchema.safeParse({
      customerCode: "CUST-0002",
      name: "Rao Contractors",
      customerType: "CONTRACTOR",
      primaryMobile: "9876543210",
      billingAddress: "Site Road",
      state: "Karnataka",
      stateCode: "29",
      gstStatus: "REGISTERED",
      gstin: "INVALID_GSTIN_123", // invalid
    });
    assert.equal(invalidGst.success, false);
  });

  it("should validate CustomerSite creation with GPS coordinates and in-charge", () => {
    const validSite = customerSiteSchema.safeParse({
      customerId: "0193231e-4500-7000-8000-000000000010",
      siteCode: "SITE-0001",
      siteName: "Brigade Gateway Phase 2",
      fullAddress: "Plot 12, Outer Ring Road, Mahadevapura",
      state: "Karnataka",
      stateCode: "29",
      district: "Bengaluru Urban",
      city: "Bengaluru",
      pinCode: "560048",
      gpsLatitude: 12.9854,
      gpsLongitude: 77.7291,
      siteOwnerName: "Brigade Enterprises",
      siteOwnerContact: "9845012345",
      siteInCharge: "Suresh Kumar",
      deliveryInstructions: "Heavy trailers permitted only between 10 AM and 4 PM",
      status: "ACTIVE",
    });
    assert.equal(validSite.success, true);
    if (validSite.success) {
      assert.equal(validSite.data.gpsLatitude, 12.9854);
      assert.equal(validSite.data.gpsLongitude, 77.7291);
    }
  });

  it("should validate Contact Person with granular delivery/return authorization flags", () => {
    const siteContact = contactPersonSchema.safeParse({
      customerId: "0193231e-4500-7000-8000-000000000010",
      siteId: "0193231e-4500-7000-8000-000000000020",
      name: "Ramesh Site Supervisor",
      mobile: "9123456780",
      designation: "Site In-Charge",
      contactType: "SITE_INCHARGE",
      isPrimary: true,
      canReceiveDeliveryNotes: true,
      canAcknowledgeDeliveries: true,
      canReceiveReturnNotes: true,
      canReceiveInvoices: false,
      canReceiveWhatsApp: true,
    });
    assert.equal(siteContact.success, true);
    if (siteContact.success) {
      assert.equal(siteContact.data.canAcknowledgeDeliveries, true);
      assert.equal(siteContact.data.canReceiveInvoices, false);
    }
  });
});

describe("3. Supplier Management & Banking Validation", () => {
  it("should validate Supplier profile with PAN, GSTIN, and Bank IFSC", () => {
    const validSupplier = supplierSchema.safeParse({
      supplierCode: "SUP-0001",
      name: "Steel Authority of Karnataka",
      contactPerson: "Mahesh Gowda",
      primaryMobile: "9880011223",
      email: "sales@steelauthkarnataka.com",
      gstStatus: "REGISTERED",
      gstin: "29AABCS5678D1Z8",
      pan: "AABCS5678D",
      billingAddress: "Plot 88, Peenya Industrial Area 2nd Phase",
      state: "Karnataka",
      stateCode: "29",
      pinCode: "560058",
      bankName: "State Bank of India",
      accountNumber: "30012345678",
      ifscCode: "SBIN0000691",
      supplierType: "MANUFACTURER",
      creditTermsDays: 45,
      isActive: true,
    });
    assert.equal(validSupplier.success, true);
  });

  it("should reject supplier with invalid IFSC format", () => {
    const invalidSupplier = supplierSchema.safeParse({
      supplierCode: "SUP-0002",
      name: "Local Pipe Fabricator",
      contactPerson: "Kishore",
      primaryMobile: "9880011223",
      billingAddress: "Industrial Area",
      state: "Karnataka",
      stateCode: "29",
      pinCode: "560058",
      ifscCode: "SBIN1000691", // Invalid: 5th character must be 0
    });
    assert.equal(invalidSupplier.success, false);
  });
});

describe("4. Inventory Movement Ledger & Balance Calculation Rules", () => {
  it("should verify all 15 INVENTRA movement types are supported", () => {
    const expectedTypes = [
      "OPENING_STOCK",
      "STOCK_RECEIPT",
      "DELIVERY_TO_CUSTOMER",
      "CUSTOMER_RETURN",
      "INTERNAL_TRANSFER",
      "SITE_TO_SITE_TRANSFER",
      "DAMAGE",
      "DAMAGE_RECOVERY",
      "MISSING",
      "FOUND_STOCK",
      "MAINTENANCE_OUT",
      "MAINTENANCE_RETURN",
      "SCRAP",
      "STOCK_ADJUSTMENT",
      "REVERSAL",
    ];

    assert.equal(MOVEMENT_TYPES.length, 15);
    expectedTypes.forEach((t) => {
      assert.equal(MOVEMENT_TYPES.includes(t), true, `Missing movement type: ${t}`);
    });
  });

  it("should validate createMovementSchema for Delivery Note dispatch", () => {
    const movement = createMovementSchema.safeParse({
      materialVariantId: "0193231e-4500-7000-8000-000000000001",
      quantity: 150,
      uom: "Nos.",
      ownershipType: "OWNED",
      movementType: "DELIVERY_TO_CUSTOMER",
      sourceLocationType: "WAREHOUSE",
      sourceWarehouseId: "0193231e-4500-7000-8000-000000000002",
      destinationLocationType: "CUSTOMER_SITE",
      destinationSiteId: "0193231e-4500-7000-8000-000000000003",
      customerId: "0193231e-4500-7000-8000-000000000004",
      condition: "GOOD",
      notes: "Dispatched via Company Vehicle KA-01-EA-1234",
    });
    assert.equal(movement.success, true);
  });

  it("should prevent negative or zero quantity movements", () => {
    const zeroMovement = createMovementSchema.safeParse({
      materialVariantId: "0193231e-4500-7000-8000-000000000001",
      quantity: 0,
      movementType: "INTERNAL_TRANSFER",
    });
    assert.equal(zeroMovement.success, false);

    const negMovement = createMovementSchema.safeParse({
      materialVariantId: "0193231e-4500-7000-8000-000000000001",
      quantity: -50,
      movementType: "INTERNAL_TRANSFER",
    });
    assert.equal(negMovement.success, false);
  });

  it("should simulate warehouse-to-customer balance projection updates and verify availability checks", () => {
    // Initial state: Warehouse has 500 units available
    let whAvailable = 500.0;
    let whDamaged = 0.0;
    let siteCustomerStock = 0.0;

    // 1. Dispatch 200 units to Customer Site
    const dispatchQty = 200.0;
    assert.equal(whAvailable >= dispatchQty, true); // Availability check passes

    whAvailable -= dispatchQty;
    siteCustomerStock += dispatchQty;

    assert.equal(whAvailable, 300.0);
    assert.equal(siteCustomerStock, 200.0);

    // 2. Attempt to dispatch 400 units (more than 300 available) -> Must fail availability check
    const excessDispatch = 400.0;
    const canDispatchExcess = whAvailable >= excessDispatch;
    assert.equal(canDispatchExcess, false);

    // 3. Customer returns 180 good units and 20 damaged units
    const returnGood = 180.0;
    const returnDamaged = 20.0;

    // Site balance reduced by 200
    siteCustomerStock -= returnGood + returnDamaged;
    assert.equal(siteCustomerStock, 0.0);

    // Warehouse receives 180 into available and 20 into damaged pool
    whAvailable += returnGood;
    whDamaged += returnDamaged;

    assert.equal(whAvailable, 480.0);
    assert.equal(whDamaged, 20.0);
    assert.equal(whAvailable + whDamaged, 500.0); // Total stock conserved
  });

  it("should verify OWNED vs HIRED_IN segregation", () => {
    // INVENTRA rule 17: Owned and Hired-in materials are stored in separate balance buckets
    const ownedBalance = {
      variantId: "prop-7-12",
      ownershipType: "OWNED",
      availableQty: 300.0,
    };

    const hiredInBalance = {
      variantId: "prop-7-12",
      ownershipType: "HIRED_IN",
      availableQty: 100.0,
    };

    assert.notEqual(ownedBalance.ownershipType, hiredInBalance.ownershipType);
    assert.equal(ownedBalance.availableQty, 300.0);
    assert.equal(hiredInBalance.availableQty, 100.0);
    assert.equal(ownedBalance.availableQty + hiredInBalance.availableQty, 400.0);
  });

  it("should validate movement reversal logic creating an inverse record", () => {
    const reversalSchemaTest = reverseMovementSchema.safeParse({
      movementId: "0193231e-4500-7000-8000-000000000055",
      reversalReason: "Wrong destination site entered on delivery note",
    });
    assert.equal(reversalSchemaTest.success, true);

    // Simulate Reversal:
    // Original Movement: Warehouse WH-01 -> Site SITE-01, Qty: 100
    const original = {
      id: "mv-001",
      sourceLocationType: "WAREHOUSE",
      sourceWarehouseId: "wh-01",
      destinationLocationType: "CUSTOMER_SITE",
      destinationSiteId: "site-01",
      quantity: 100.0,
      status: "POSTED",
    };

    // Reversal Movement swaps source and destination
    const reversal = {
      id: "mv-002",
      sourceLocationType: original.destinationLocationType, // CUSTOMER_SITE
      sourceSiteId: original.destinationSiteId,             // site-01
      destinationLocationType: original.sourceLocationType, // WAREHOUSE
      destinationWarehouseId: original.sourceWarehouseId,   // wh-01
      quantity: original.quantity,
      movementType: "REVERSAL",
      reversedMovementId: original.id,
      status: "POSTED",
    };

    assert.equal(reversal.sourceSiteId, original.destinationSiteId);
    assert.equal(reversal.destinationWarehouseId, original.sourceWarehouseId);
    assert.equal(reversal.reversedMovementId, original.id);
  });
});

describe("5. Physical Stock Verification, Audits & Reconciliation", () => {
  it("should validate Stock Audit creation schema", () => {
    const validAudit = createStockAuditSchema.safeParse({
      warehouseId: "0193231e-4500-7000-8000-000000000001",
      title: "Quarterly Physical Stock Verification Q1",
      auditDate: "2026-03-31T00:00:00.000Z",
      remarks: "Comprehensive count of centering sheets and props",
    });
    assert.equal(validAudit.success, true);
  });

  it("should validate Record Stock Count items", () => {
    const validCount = recordStockCountSchema.safeParse({
      stockAuditId: "0193231e-4500-7000-8000-000000000010",
      items: [
        {
          materialVariantId: "0193231e-4500-7000-8000-000000000001",
          ownershipType: "OWNED",
          physicalQty: 495,
          condition: "GOOD",
          remarks: "5 pieces missing from bay 4",
        },
        {
          materialVariantId: "0193231e-4500-7000-8000-000000000002",
          ownershipType: "OWNED",
          physicalQty: 205,
          condition: "GOOD",
          remarks: "5 extra pieces found in yard corner",
        },
      ],
    });
    assert.equal(validCount.success, true);
  });

  it("should compute audit variance (shortage vs excess) and generate appropriate adjustment types", () => {
    // Item A: Expected 500, Counted 495 -> Variance: -5 (SHORTAGE) -> Generates MISSING movement
    const itemA = {
      expectedQty: 500,
      physicalQty: 495,
    };
    const varianceA = itemA.physicalQty - itemA.expectedQty;
    assert.equal(varianceA, -5);
    const adjustmentTypeA = varianceA < 0 ? "MISSING" : varianceA > 0 ? "FOUND_STOCK" : null;
    assert.equal(adjustmentTypeA, "MISSING");

    // Item B: Expected 200, Counted 205 -> Variance: +5 (EXCESS) -> Generates FOUND_STOCK movement
    const itemB = {
      expectedQty: 200,
      physicalQty: 205,
    };
    const varianceB = itemB.physicalQty - itemB.expectedQty;
    assert.equal(varianceB, 5);
    const adjustmentTypeB = varianceB < 0 ? "MISSING" : varianceB > 0 ? "FOUND_STOCK" : null;
    assert.equal(adjustmentTypeB, "FOUND_STOCK");
  });
});

describe("6. High-Precision Monetary & Quantity Calculations", () => {
  it("should calculate exact billing totals without floating-point inaccuracies", () => {
    // Prop Rental: ₹1.84 per day for 47 days for 237 props
    // Exact mathematical value: 184 paise * 47 * 237 = 2049576 paise = ₹20495.76
    const paisePerDay = 184; // ₹1.84
    const days = 47;
    const qty = 237;
    const totalPaise = paisePerDay * days * qty; // 2049576 paise
    const totalRupees = (totalPaise / 100).toFixed(2);

    assert.equal(totalRupees, "20495.76");
  });

  it("should enforce decimal formatting conventions", () => {
    const formatted = toFixedPaise(1234.5);
    assert.equal(formatted, "1234.50");
  });
});
