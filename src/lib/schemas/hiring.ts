import { z } from "zod";

export const HDN_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export const HRN_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const hiringDeliveryItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  dailyHiringRate: z.coerce.number().min(0, "Hiring rate cannot be negative"),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createHiringDeliveryNoteSchema = z.object({
  hdnNumber: z.string().optional(),
  supplierId: z.string().uuid("Supplier is required"),
  receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
  receiptDate: z.string().optional(),
  supplierReference: z.string().optional().nullable(),
  effectiveDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  items: z.array(hiringDeliveryItemSchema).min(1, "At least one item is required"),
});

export type CreateHiringDeliveryNoteInput = z.infer<typeof createHiringDeliveryNoteSchema>;

export const hiringReturnItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  quantity: z.coerce.number().positive("Return quantity must be greater than zero"),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createHiringReturnNoteSchema = z.object({
  hrnNumber: z.string().optional(),
  supplierId: z.string().uuid("Supplier is required"),
  sourceWarehouseId: z.string().uuid("Source warehouse is required"),
  referenceHdnId: z.string().uuid().optional().nullable().or(z.literal("")),
  returnDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  items: z.array(hiringReturnItemSchema).min(1, "At least one item is required for hiring return"),
});

export type CreateHiringReturnNoteInput = z.infer<typeof createHiringReturnNoteSchema>;

