import { z } from "zod";

export const PO_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const purchaseOrderItemSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === "object") {
      const q = val.quantity !== undefined ? val.quantity : val.orderedQty;
      const r = val.unitRate !== undefined ? val.unitRate : val.rate;
      return {
        ...val,
        quantity: q,
        unitRate: r,
      };
    }
    return val;
  },
  z.object({
    materialVariantId: z.string().uuid("Material variant is required"),
    quantity: z.coerce.number().positive("Quantity must be greater than zero"),
    unitRate: z.coerce.number().min(0, "Unit rate cannot be negative"),
    discountPercent: z.coerce.number().min(0).max(100).default(0),
    taxPercent: z.coerce.number().min(0).max(100).default(18),
  })
);

export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().optional(),
  supplierId: z.string().uuid("Supplier is required"),
  branchId: z.string().uuid("Branch is required"),
  deliveryWarehouseId: z.string().uuid("Delivery warehouse is required"),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const grnItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  poItemId: z.string().uuid().optional().nullable(),
  orderedQty: z.coerce.number().min(0).default(0),
  receivedQty: z.coerce.number().positive("Received quantity must be greater than zero"),
  acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  rejectedQty: z.coerce.number().min(0).default(0),
  damagedQty: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createGoodsReceiptNoteSchema = z.object({
  grnNumber: z.string().optional(),
  purchaseOrderId: z.string().uuid().optional().nullable().or(z.literal("")),
  supplierId: z.string().uuid("Supplier is required"),
  receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
  receiptDate: z.string().optional(),
  supplierInvoiceNumber: z.string().optional().nullable(),
  supplierInvoiceDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(grnItemSchema).min(1, "At least one item is required in GRN"),
});

export type CreateGoodsReceiptNoteInput = z.infer<typeof createGoodsReceiptNoteSchema>;

export const purchaseReturnItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  quantity: z.coerce.number().positive("Return quantity must be greater than zero"),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const createPurchaseReturnSchema = z.object({
  prNumber: z.string().optional(),
  supplierId: z.string().uuid("Supplier is required"),
  warehouseId: z.string().uuid("Warehouse is required"),
  grnId: z.string().uuid().optional().nullable().or(z.literal("")),
  returnDate: z.string().optional(),
  reason: z.string().min(3, "Return reason is required").trim(),
  remarks: z.string().optional().nullable(),
  items: z.array(purchaseReturnItemSchema).min(1, "At least one item is required for return"),
});

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

