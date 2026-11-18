import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const DN_STATUSES = [
  "DRAFT",
  "APPROVED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const deliveryNoteItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  dailyRate: z.coerce.number().min(0).optional().nullable(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
});

export const createDeliveryNoteSchema = z.object({
  dnNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer construction site is required"),
  sourceWarehouseId: z.string().uuid("Source warehouse is required"),
  deliveryDate: z.string().optional(),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  vehicleNumber: z.string().optional().nullable(),
  transportMode: z.string().default("COMPANY_VEHICLE"),
  eWayBillNumber: z.string().optional().nullable(),
  contactPersonId: z.string().uuid().optional().nullable().or(z.literal("")),
  rentalAgreementId: z.string().uuid().optional().nullable().or(z.literal("")),
  autoGenerateAgreement: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  transportCharges: z.coerce.number().min(0, "Transport charges cannot be negative").optional().nullable(),
  items: z.array(deliveryNoteItemSchema).min(1, "At least one material item is required"),
});

export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;

export const deliverNoteWithEvidenceSchema = z.object({
  receiverName: z.string().min(2, "Receiver name is required").trim(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
  deliveredAt: z.string().optional(),
});

export type DeliverNoteWithEvidenceInput = z.infer<typeof deliverNoteWithEvidenceSchema>;

