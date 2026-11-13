import { z } from "zod";

export const MOVEMENT_TYPES = [
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
] as const;

export type MovementTypeEnum = (typeof MOVEMENT_TYPES)[number];

export const LOCATION_TYPES = [
  "WAREHOUSE",
  "CUSTOMER_SITE",
  "IN_TRANSIT",
  "DAMAGE_YARD",
  "MAINTENANCE",
  "MISSING",
  "SCRAP",
  "SUPPLIER",
  "NONE",
] as const;

export const createMovementSchema = z.object({
  movementNumber: z.string().optional(),
  materialVariantId: z.string().uuid("Material variant is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  uom: z.string().default("Nos."),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  movementType: z.enum(MOVEMENT_TYPES),
  movementDate: z.string().optional(),
  sourceLocationType: z.enum(LOCATION_TYPES).default("NONE"),
  sourceWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  sourceSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  destinationLocationType: z.enum(LOCATION_TYPES).default("NONE"),
  destinationWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  destinationSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  customerId: z.string().uuid().optional().nullable().or(z.literal("")),
  supplierId: z.string().uuid().optional().nullable().or(z.literal("")),
  referenceDocumentType: z.string().optional().nullable(),
  referenceDocumentId: z.string().optional().nullable(),
  batchOrLotNumber: z.string().optional().nullable(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  replacementValue: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;

export const reverseMovementSchema = z.object({
  movementId: z.string().uuid("Movement ID to reverse is required"),
  reversalReason: z.string().min(5, "A clear reversal reason is required").trim(),
});

export type ReverseMovementInput = z.infer<typeof reverseMovementSchema>;

export const createStockAuditSchema = z.object({
  warehouseId: z.string().uuid("Warehouse is required"),
  title: z.string().min(3, "Audit title is required").trim(),
  auditDate: z.string().optional(),
  remarks: z.string().optional().nullable(),
});

export type CreateStockAuditInput = z.infer<typeof createStockAuditSchema>;

export const recordStockCountSchema = z.object({
  stockAuditId: z.string().uuid("Audit ID is required"),
  items: z.array(
    z.object({
      materialVariantId: z.string().uuid("Material variant is required"),
      ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
      physicalQty: z.coerce.number().min(0, "Counted physical quantity cannot be negative"),
      condition: z.enum(["GOOD", "FAIR", "DAMAGED", "SCRAP"]).default("GOOD"),
      remarks: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
    })
  ).min(1, "At least one material count is required"),
});

export type RecordStockCountInput = z.infer<typeof recordStockCountSchema>;
