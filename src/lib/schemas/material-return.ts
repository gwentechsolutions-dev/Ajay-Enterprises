import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const MRN_STATUSES = ["DRAFT", "ASSIGNED", "IN_TRANSIT", "POSTED", "COMPLETED", "CANCELLED"] as const;

export const materialReturnItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  returnedQty: z.coerce.number().positive("Returned quantity must be greater than zero"),
  acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  damagedQty: z.coerce.number().min(0).default(0),
  missingQty: z.coerce.number().min(0).default(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createMaterialReturnNoteSchema = z.object({
  mrnNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer construction site is required"),
  receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
  referenceDeliveryNoteId: z.string().uuid().optional().nullable().or(z.literal("")),
  returnDate: z.string().optional(),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  vehicleNumber: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverSignatureUrl: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(materialReturnItemSchema).min(1, "At least one item is required for return"),
});

export type CreateMaterialReturnNoteInput = z.infer<typeof createMaterialReturnNoteSchema>;

export const completeMrnPickupSchema = z.object({
  receiverName: z.string().min(2, "Receiver/Handover person name is required").trim(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  photoUrl: z.string().min(1, "Site pickup proof photo is required"),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
  destinationType: z.enum(["YARD", "SITE_TRANSFER"]).default("YARD"),
  destinationSiteName: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  completedAt: z.string().optional(),
});

export type CompleteMrnPickupInput = z.infer<typeof completeMrnPickupSchema>;


