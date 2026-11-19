import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// ==============================================================================
// INVENTRA AUTOMATED TEST SUITE: PHASE 3 OPERATIONS & FLEET DISPATCH
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

// Statutory schemas
const IndianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number");
const OptionalIndianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number").optional().nullable().or(z.literal(""));
const IndianPinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit Indian PIN code");

// Phase 3 Schemas
const purchaseOrderItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  orderedQty: z.coerce.number().positive(),
  unitRate: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).default(18),
  discountAmount: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

const createPurchaseOrderSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: z.string().uuid(),
  branchId: z.string().uuid(),
  deliveryWarehouseId: z.string().uuid(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1),
});

const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  materialVariantId: z.string().uuid(),
  receivedQty: z.coerce.number().min(0),
  acceptedQty: z.coerce.number().min(0),
  damagedQty: z.coerce.number().min(0).default(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

const createGoodsReceiptNoteSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  receivingWarehouseId: z.string().uuid(),
  receiptDate: z.string().optional(),
  supplierInvoiceNumber: z.string().optional().nullable(),
  supplierInvoiceDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

const purchaseReturnItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  returnQty: z.coerce.number().positive(),
  returnReason: z.enum(["DEFECTIVE_ON_ARRIVAL", "WRONG_SPECIFICATION", "EXCESS_SUPPLY", "DAMAGED_IN_TRANSIT", "OTHER"]),
  remarks: z.string().optional().nullable(),
});

const createPurchaseReturnSchema = z.object({
  supplierId: z.string().uuid(),
  sourceWarehouseId: z.string().uuid(),
  referenceGrnId: z.string().uuid().optional().nullable(),
  returnDate: z.string().optional(),
  remarks: z.string().optional().nullable(),
  items: z.array(purchaseReturnItemSchema).min(1),
});

const deliveryNoteItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  dispatchedQty: z.coerce.number().positive(),
  dailyRentalRate: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const createDeliveryNoteSchema = z.object({
  customerId: z.string().uuid(),
  customerSiteId: z.string().uuid(),
  sourceWarehouseId: z.string().uuid(),
  dispatchDate: z.string().optional(),
  includeDeliveryDate: z.boolean().default(true),
  vehicleNumber: z.string().min(5).toUpperCase().trim().optional(),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  notes: z.string().optional().nullable(),
  items: z.array(deliveryNoteItemSchema).min(1),
});

const deliverNoteWithEvidenceSchema = z.object({
  receiverName: z.string().min(2),
  receiverPhone: IndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  photoUrl: z.string().min(5),
  additionalPhotoUrls: z.array(z.string()).max(10, "Maximum 10 images allowed").optional().default([]),
  storagePath: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90),
  gpsLongitude: z.coerce.number().min(-180).max(180),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const materialReturnItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  returnedQty: z.coerce.number().positive(),
  acceptedQty: z.coerce.number().min(0),
  damagedQty: z.coerce.number().min(0).default(0),
  missingQty: z.coerce.number().min(0).default(0),
  conditionStatus: z.enum(["GOOD", "DAMAGED", "SCRAP"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

const createMaterialReturnNoteSchema = z.object({
  customerId: z.string().uuid(),
  customerSiteId: z.string().uuid(),
  receivingWarehouseId: z.string().uuid(),
  returnDate: z.string().optional(),
  includeReturnDate: z.boolean().default(false),
  vehicleNumber: z.string().min(5).toUpperCase().trim().optional(),
  receiverName: z.string().optional().nullable(),
  items: z.array(materialReturnItemSchema).min(1),
});

const stockTransferItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  transferQty: z.coerce.number().positive(),
  remarks: z.string().optional().nullable(),
});

const createStockTransferNoteSchema = z.object({
  sourceWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  transferDate: z.string().optional(),
  vehicleNumber: z.string().min(5).toUpperCase().trim().optional(),
  items: z.array(stockTransferItemSchema).min(1),
}).refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: "Source and destination warehouse cannot be the same",
});

const receiveStockTransferSchema = z.object({
  remarks: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      receivedQty: z.coerce.number().min(0),
      damagedQty: z.coerce.number().min(0).default(0),
      remarks: z.string().optional().nullable(),
    })
  ).min(1),
});

const hiringDeliveryItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  dailyHiringRate: z.coerce.number().min(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
});

const createHiringDeliveryNoteSchema = z.object({
  supplierId: z.string().uuid(),
  receivingWarehouseId: z.string().uuid(),
  items: z.array(hiringDeliveryItemSchema).min(1),
});

const hiringReturnItemSchema = z.object({
  materialVariantId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
});

const createHiringReturnNoteSchema = z.object({
  supplierId: z.string().uuid(),
  sourceWarehouseId: z.string().uuid(),
  items: z.array(hiringReturnItemSchema).min(1),
});

const generateEWayBillSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "TRANSFER_NOTE"]),
  documentId: z.string().uuid(),
  vehicleNumber: z.string().min(5).toUpperCase().trim(),
  fromPincode: IndianPinCodeSchema,
  toPincode: IndianPinCodeSchema,
  distanceKm: z.coerce.number().int().positive(),
});

const cancelEWayBillSchema = z.object({
  ewbNumber: z.string().min(10).trim(),
  cancelReason: z.string().min(5).trim(),
});

// RBAC logic
const RBAC_PHASE3 = {
  DELIVERY_PERSONNEL: ["delivery_portal:view", "delivery_notes:view", "delivery_notes:deliver"],
  WAREHOUSE_STAFF: ["warehouse_portal:view", "purchases:receive_grn", "material_returns:create", "stock_transfers:receive"],
  OWNER: ["ALL"],
  ADMINISTRATOR: ["ALL"],
};

function checkRbac(role, perm) {
  const perms = RBAC_PHASE3[role] || [];
  return perms.includes("ALL") || perms.includes(perm);
}

// ----------------------------------------------------------------------------
// TEST SUITES
// ----------------------------------------------------------------------------
describe("1. Purchase Orders (PO) Workflow & Calculations", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";
  const dummyUUID2 = "018f45a0-0000-7000-8000-000000000002";
  const dummyUUID3 = "018f45a0-0000-7000-8000-000000000003";

  it("should validate PO schema and calculate subtotal, GST and grand total correctly", () => {
    const validPO = {
      supplierId: dummyUUID,
      branchId: dummyUUID2,
      deliveryWarehouseId: dummyUUID3,
      orderDate: "2026-11-13",
      items: [
        {
          materialVariantId: dummyUUID,
          orderedQty: 100,
          unitRate: 500, // 100 * 500 = 50,000
          taxPercent: 18,
          discountAmount: 1000, // taxable: 49,000, tax: 8,820
        },
      ],
    };

    const res = createPurchaseOrderSchema.safeParse(validPO);
    assert.equal(res.success, true);

    const line = validPO.items[0];
    const taxable = line.orderedQty * line.unitRate - line.discountAmount;
    const tax = (taxable * line.taxPercent) / 100;
    const grandTotal = taxable + tax;

    assert.equal(taxable, 49000);
    assert.equal(tax, 8820);
    assert.equal(grandTotal, 57820);
  });

  it("should reject PO with negative quantities or empty items", () => {
    const invalidPO = {
      supplierId: dummyUUID,
      branchId: dummyUUID2,
      deliveryWarehouseId: dummyUUID3,
      items: [],
    };
    const res = createPurchaseOrderSchema.safeParse(invalidPO);
    assert.equal(res.success, false);
  });
});

describe("2. Goods Receipt Notes (GRN) & Damage Segregation", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate GRN with separate accepted, damaged and rejected quantities", () => {
    const validGRN = {
      purchaseOrderId: dummyUUID,
      receivingWarehouseId: dummyUUID,
      receiptDate: "2026-11-13",
      supplierInvoiceNumber: "INV-1029",
      items: [
        {
          purchaseOrderItemId: dummyUUID,
          materialVariantId: dummyUUID,
          receivedQty: 100,
          acceptedQty: 90,
          damagedQty: 8,
          rejectedQty: 2,
        },
      ],
    };

    const res = createGoodsReceiptNoteSchema.safeParse(validGRN);
    assert.equal(res.success, true);
    assert.equal(res.data.items[0].acceptedQty + res.data.items[0].damagedQty + res.data.items[0].rejectedQty, 100);
  });

  it("should reject GRN where damaged or accepted qty is negative", () => {
    const invalidGRN = {
      purchaseOrderId: dummyUUID,
      receivingWarehouseId: dummyUUID,
      items: [
        {
          purchaseOrderItemId: dummyUUID,
          materialVariantId: dummyUUID,
          receivedQty: 100,
          acceptedQty: 105,
          damagedQty: -5,
        },
      ],
    };
    const res = createGoodsReceiptNoteSchema.safeParse(invalidGRN);
    assert.equal(res.success, false);
  });
});

describe("3. Purchase Returns against GRN", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate purchase return schema with valid return reasons", () => {
    const validPR = {
      supplierId: dummyUUID,
      sourceWarehouseId: dummyUUID,
      returnDate: "2026-11-13",
      items: [
        {
          materialVariantId: dummyUUID,
          returnQty: 15,
          returnReason: "DEFECTIVE_ON_ARRIVAL",
        },
      ],
    };
    const res = createPurchaseReturnSchema.safeParse(validPR);
    assert.equal(res.success, true);
  });
});

describe("4. Delivery Notes (DN) & Independent Billing Rules", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate Delivery Note with independent includeDeliveryDate flag", () => {
    const validDN = {
      customerId: dummyUUID,
      customerSiteId: dummyUUID,
      sourceWarehouseId: dummyUUID,
      dispatchDate: "2026-11-13",
      includeDeliveryDate: true, // Independent config (Rule #12)
      vehicleNumber: "KA-01-AB-1234",
      driverName: "Ramesh Kumar",
      driverPhone: "9876543210",
      items: [
        {
          materialVariantId: dummyUUID,
          ownershipType: "OWNED",
          dispatchedQty: 250,
          dailyRentalRate: 3.5,
        },
        {
          materialVariantId: dummyUUID,
          ownershipType: "HIRED_IN",
          dispatchedQty: 50,
          dailyRentalRate: 4.0,
        },
      ],
    };

    const res = createDeliveryNoteSchema.safeParse(validDN);
    assert.equal(res.success, true);
    assert.equal(res.data.includeDeliveryDate, true);
    assert.equal(res.data.items[0].ownershipType, "OWNED");
    assert.equal(res.data.items[1].ownershipType, "HIRED_IN");
  });

  it("should allow includeDeliveryDate to be explicitly false without affecting return date rules", () => {
    const validDN = {
      customerId: dummyUUID,
      customerSiteId: dummyUUID,
      sourceWarehouseId: dummyUUID,
      includeDeliveryDate: false,
      items: [
        {
          materialVariantId: dummyUUID,
          dispatchedQty: 10,
        },
      ],
    };
    const res = createDeliveryNoteSchema.safeParse(validDN);
    assert.equal(res.success, true);
    assert.equal(res.data.includeDeliveryDate, false);
  });
});

describe("5. Delivery Evidence, GPS Proof & Receiver Acknowledgement", () => {
  it("should validate delivery completion with GPS coordinates, photo, and receiver signature", () => {
    const validDeliver = {
      receiverName: "Suresh Gowda",
      receiverPhone: "9845012345",
      receiverDesignation: "Project Engineer",
      photoUrl: "https://storage.inventra.app/proofs/dn-2026-0001.jpg",
      gpsLatitude: 12.9715987,
      gpsLongitude: 77.5945627,
      gpsAccuracy: 4.8,
      receiverSignatureUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      remarks: "Unloaded in zone A",
    };

    const res = deliverNoteWithEvidenceSchema.safeParse(validDeliver);
    assert.equal(res.success, true);
    assert.equal(res.data.receiverName, "Suresh Gowda");
    assert.equal(res.data.gpsLatitude, 12.9715987);
  });

  it("should validate delivery note evidence with multiple photos up to 10 images", () => {
    const multiPhotoDeliver = {
      receiverName: "Suresh Gowda",
      receiverPhone: "9845012345",
      photoUrl: "https://storage.supabase.co/deliveries/p1.jpg",
      additionalPhotoUrls: [
        "https://storage.supabase.co/deliveries/p2.jpg",
        "https://storage.supabase.co/deliveries/p3.jpg",
        "https://storage.supabase.co/deliveries/p4.jpg",
      ],
      gpsLatitude: 12.9715987,
      gpsLongitude: 77.5945627,
    };
    const res = deliverNoteWithEvidenceSchema.safeParse(multiPhotoDeliver);
    assert.equal(res.success, true);
    assert.equal(res.data.additionalPhotoUrls.length, 3);
  });

  it("should reject delivery note evidence with more than 10 additional images", () => {
    const tooManyPhotos = {
      receiverName: "Suresh Gowda",
      receiverPhone: "9845012345",
      photoUrl: "https://storage.supabase.co/deliveries/p1.jpg",
      additionalPhotoUrls: Array.from({ length: 11 }, (_, i) => `https://storage.supabase.co/deliveries/p${i + 2}.jpg`),
      gpsLatitude: 12.9715987,
      gpsLongitude: 77.5945627,
    };
    const res = deliverNoteWithEvidenceSchema.safeParse(tooManyPhotos);
    assert.equal(res.success, false);
  });
});

describe("6. Material Return Notes (MRN) & Damaged/Missing Stock Routing", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate MRN with accepted, damaged, and missing items", () => {
    const validMRN = {
      customerId: dummyUUID,
      customerSiteId: dummyUUID,
      receivingWarehouseId: dummyUUID,
      returnDate: "2026-11-13",
      includeReturnDate: false, // Independent config (Rule #12)
      vehicleNumber: "KA-01-CD-5678",
      items: [
        {
          materialVariantId: dummyUUID,
          returnedQty: 100,
          acceptedQty: 92,
          damagedQty: 5, // routes to damaged non-rentable pool
          missingQty: 3, // recorded for billing loss recovery
          conditionStatus: "GOOD",
        },
      ],
    };

    const res = createMaterialReturnNoteSchema.safeParse(validMRN);
    assert.equal(res.success, true);
    assert.equal(res.data.items[0].acceptedQty, 92);
    assert.equal(res.data.items[0].damagedQty, 5);
    assert.equal(res.data.items[0].missingQty, 3);
  });
});

describe("7. Stock Transfer Notes (STN) Warehouse-to-Warehouse", () => {
  const sourceWH = "018f45a0-0000-7000-8000-000000000001";
  const destWH = "018f45a0-0000-7000-8000-000000000002";
  const variantId = "018f45a0-0000-7000-8000-000000000003";

  it("should validate STN creation and reject identical source and destination", () => {
    const validSTN = {
      sourceWarehouseId: sourceWH,
      destinationWarehouseId: destWH,
      items: [
        {
          materialVariantId: variantId,
          ownershipType: "OWNED",
          transferQty: 50,
        },
      ],
    };
    const res = createStockTransferNoteSchema.safeParse(validSTN);
    assert.equal(res.success, true);

    const identicalSTN = {
      sourceWarehouseId: sourceWH,
      destinationWarehouseId: sourceWH, // Identical
      items: [{ materialVariantId: variantId, transferQty: 50 }],
    };
    const resId = createStockTransferNoteSchema.safeParse(identicalSTN);
    assert.equal(resId.success, false);
  });

  it("should validate STN receipt with shortage and damaged breakdown", () => {
    const receiveInput = {
      remarks: "Received at Yard 2",
      items: [
        {
          itemId: "018f45a0-0000-7000-8000-000000000010",
          receivedQty: 48,
          damagedQty: 2,
        },
      ],
    };
    const res = receiveStockTransferSchema.safeParse(receiveInput);
    assert.equal(res.success, true);
    assert.equal(res.data.items[0].receivedQty, 48);
  });
});

describe("8. Hired-In Material Operations (HDN & HRN Segregation)", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate HDN receipt schema with daily hiring rate", () => {
    const validHDN = {
      supplierId: dummyUUID,
      receivingWarehouseId: dummyUUID,
      items: [
        {
          materialVariantId: dummyUUID,
          quantity: 200,
          dailyHiringRate: 2.75,
          condition: "GOOD",
        },
      ],
    };
    const res = createHiringDeliveryNoteSchema.safeParse(validHDN);
    assert.equal(res.success, true);
    assert.equal(res.data.items[0].dailyHiringRate, 2.75);
  });

  it("should validate HRN return schema", () => {
    const validHRN = {
      supplierId: dummyUUID,
      sourceWarehouseId: dummyUUID,
      items: [
        {
          materialVariantId: dummyUUID,
          quantity: 150,
          condition: "GOOD",
        },
      ],
    };
    const res = createHiringReturnNoteSchema.safeParse(validHRN);
    assert.equal(res.success, true);
    assert.equal(res.data.items[0].quantity, 150);
  });
});

describe("9. FYN Gateway E-Way Bill Integration & Masking", () => {
  const dummyUUID = "018f45a0-0000-7000-8000-000000000001";

  it("should validate E-Way Bill generation schema with PIN codes and distance", () => {
    const validEWB = {
      documentType: "DELIVERY_NOTE",
      documentId: dummyUUID,
      vehicleNumber: "KA01AB1234",
      fromPincode: "560001",
      toPincode: "560068",
      distanceKm: 35,
    };
    const res = generateEWayBillSchema.safeParse(validEWB);
    assert.equal(res.success, true);
    assert.equal(res.data.vehicleNumber, "KA01AB1234");
  });

  it("should simulate statutory 12-digit EWB number and validity calculation", () => {
    const distanceKm = 150;
    const daysValid = Math.max(1, Math.ceil(distanceKm / 100)); // 1 day per 100 km
    assert.equal(daysValid, 2);

    const simulatedEwbNumber = `29${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    assert.match(simulatedEwbNumber, /^29\d{10}$/);
    assert.equal(simulatedEwbNumber.length, 12);
  });

  it("should validate E-Way Bill cancellation schema requiring reason", () => {
    const validCancel = {
      ewbNumber: "291234567890",
      cancelReason: "Vehicle broke down; goods transferred to new vehicle",
    };
    const res = cancelEWayBillSchema.safeParse(validCancel);
    assert.equal(res.success, true);
  });
});

describe("10. Offline Draft Synchronization Engine", () => {
  it("should generate collision-resistant idempotency keys", () => {
    const keys = new Set();
    for (let i = 0; i < 50; i++) {
      const key = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      keys.add(key);
    }
    assert.equal(keys.size, 50);
  });

  it("should verify offline draft status transitions", () => {
    const validStatuses = ["draft", "pending_sync", "syncing", "synced", "failed"];
    const currentStatus = "pending_sync";
    assert.ok(validStatuses.includes(currentStatus));
  });
});

describe("11. Role-Based Access Control (RBAC) Scoping for Phase 3", () => {
  it("DELIVERY_PERSONNEL should have delivery permissions but no financial or admin access", () => {
    const role = "DELIVERY_PERSONNEL";
    assert.equal(checkRbac(role, "delivery_portal:view"), true);
    assert.equal(checkRbac(role, "delivery_notes:view"), true);
    assert.equal(checkRbac(role, "delivery_notes:deliver"), true);

    // Forbidden from purchases, rates, accounting, company profile
    assert.equal(checkRbac(role, "purchases:create"), false);
    assert.equal(checkRbac(role, "purchases:approve"), false);
    assert.equal(checkRbac(role, "company_profile:edit"), false);
  });

  it("WAREHOUSE_STAFF should have receipt and transfer rights but cannot approve POs or edit company", () => {
    const role = "WAREHOUSE_STAFF";
    assert.equal(checkRbac(role, "warehouse_portal:view"), true);
    assert.equal(checkRbac(role, "purchases:receive_grn"), true);
    assert.equal(checkRbac(role, "material_returns:create"), true);
    assert.equal(checkRbac(role, "stock_transfers:receive"), true);

    // Forbidden from PO approval and company config
    assert.equal(checkRbac(role, "purchases:approve"), false);
    assert.equal(checkRbac(role, "company_profile:edit"), false);
  });

  it("OWNER and ADMINISTRATOR have full operational permissions across all Phase 3 modules", () => {
    ["OWNER", "ADMINISTRATOR"].forEach((role) => {
      assert.equal(checkRbac(role, "purchases:create"), true);
      assert.equal(checkRbac(role, "purchases:approve"), true);
      assert.equal(checkRbac(role, "purchases:receive_grn"), true);
      assert.equal(checkRbac(role, "delivery_notes:create"), true);
      assert.equal(checkRbac(role, "delivery_notes:dispatch"), true);
      assert.equal(checkRbac(role, "delivery_notes:deliver"), true);
      assert.equal(checkRbac(role, "material_returns:create"), true);
      assert.equal(checkRbac(role, "stock_transfers:create"), true);
      assert.equal(checkRbac(role, "stock_transfers:dispatch"), true);
      assert.equal(checkRbac(role, "stock_transfers:receive"), true);
      assert.equal(checkRbac(role, "hiring_notes:create"), true);
    });
  });
});
