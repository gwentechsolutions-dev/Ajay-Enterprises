import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const STN_STATUSES = [
  "DRAFT",
  "APPROVED",
  "DISPATCHED",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
] as const;

export const stockTransferItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  dispatchedQty: z.coerce.number().positive("Dispatched quantity must be greater than zero"),
  receivedQty: z.coerce.number().min(0).default(0),
  shortageQty: z.coerce.number().min(0).default(0),
  damagedQty: z.coerce.number().min(0).default(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createStockTransferNoteSchema = z.object({
  stnNumber: z.string().optional(),
  sourceWarehouseId: z.string().uuid("Source warehouse is required"),
  destinationWarehouseId: z.string().uuid("Destination warehouse is required"),
  transferDate: z.string().optional(),
  vehicleNumber: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  eWayBillNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(stockTransferItemSchema).min(1, "At least one item is required for transfer"),
}).refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: "Source and destination warehouses must be different",
  path: ["destinationWarehouseId"],
});

export type CreateStockTransferNoteInput = z.infer<typeof createStockTransferNoteSchema>;

export const receiveStockTransferSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().uuid("Item ID is required"),
      receivedQty: z.coerce.number().min(0, "Received quantity cannot be negative"),
      shortageQty: z.coerce.number().min(0).default(0),
      damagedQty: z.coerce.number().min(0).default(0),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, "At least one item receipt is required"),
  notes: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type ReceiveStockTransferInput = z.infer<typeof receiveStockTransferSchema>;

