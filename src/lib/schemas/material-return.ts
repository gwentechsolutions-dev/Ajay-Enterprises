import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const MRN_STATUSES = [
  "PICKUP_REQUESTED",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED_AT_SITE",
  "PICKUP_IN_PROGRESS",
  "PICKUP_COMPLETED",
  "IN_TRANSIT",
  "ARRIVED_AT_YARD",
  "AWAITING_INSPECTION",
  "INSPECTION_COMPLETED",
  "POSTED",
  "FINALIZED",
  "DRAFT",
  "COMPLETED",
  "CANCELLED",
] as const;

export const materialReturnItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  returnedQty: z.coerce.number().min(0, "Returned quantity cannot be negative").default(0),
  expectedQty: z.coerce.number().min(0).optional().nullable(),
  receivedQty: z.coerce.number().min(0).optional().nullable(),
  acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative").default(0),
  damagedQty: z.coerce.number().min(0).default(0),
  missingQty: z.coerce.number().min(0).default(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  remarks: z.string().optional().nullable(),
  inspectionRemarks: z.string().optional().nullable(),
  driverCollectedQty: z.coerce.number().min(0).optional().nullable(),
  driverGoodQty: z.coerce.number().min(0).optional().nullable(),
  driverDamagedQty: z.coerce.number().min(0).optional().nullable(),
  driverMissingQty: z.coerce.number().min(0).optional().nullable(),
  driverRemarks: z.string().optional().nullable(),
});

export const createMaterialReturnNoteSchema = z.object({
  mrnNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer construction site is required"),
  receivingWarehouseId: z.string().uuid("Receiving warehouse is required"),
  referenceDeliveryNoteId: z.string().uuid().optional().nullable().or(z.literal("")),
  returnDate: z.string().optional(),
  preferredPickupDate: z.string().optional().nullable(),
  preferredPickupTime: z.string().optional().nullable(),
  pickupInstructions: z.string().optional().nullable(),
  includeReturnDate: z.boolean().default(false),
  status: z.enum(MRN_STATUSES).optional(),

  // Fleet & Trip Scheduling
  vehicleId: z.string().uuid().optional().nullable().or(z.literal("")),
  vehicleNumber: z.string().optional().nullable(),
  driverId: z.string().uuid().optional().nullable().or(z.literal("")),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  existingTripId: z.string().uuid().optional().nullable().or(z.literal("")),
  startOdometer: z.coerce.number().min(0).optional().nullable(),

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
  inspectionStatus: z.enum(["PENDING", "COMPLETED"]).default("PENDING"),
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

export type CreateMaterialReturnNoteInput = z.infer<typeof createMaterialReturnNoteSchema>;

// Stage 2: Trip Scheduling Schema
export const scheduleReturnTripSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  vehicleNumber: z.string().optional().nullable(),
  driverId: z.string().uuid().optional().nullable().or(z.literal("")),
  driverName: z.string().optional().nullable(),
  driverPhone: OptionalIndianMobileSchema,
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional().nullable(),
  destinationWarehouseId: z.string().uuid().optional().nullable(),
  tripInstructions: z.string().optional().nullable(),
  existingTripId: z.string().uuid().optional().nullable().or(z.literal("")),
  startOdometer: z.coerce.number().min(0).optional().nullable(),
});

export type ScheduleReturnTripInput = z.infer<typeof scheduleReturnTripSchema>;

// Stage 4: Driver Site Arrival Schema
export const driverSiteArrivalSchema = z.object({
  gpsLatitude: z.coerce.number().min(-90).max(90),
  gpsLongitude: z.coerce.number().min(-180).max(180),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  arrivedAt: z.string().optional(),
  exceptionReason: z.string().optional().nullable(),
});

export type DriverSiteArrivalInput = z.infer<typeof driverSiteArrivalSchema>;

// Stage 5 & 7 & 8: Driver Pickup Confirmation Schema
export const driverPickupItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  expectedQty: z.coerce.number().min(0).optional().default(0),
  driverCollectedQty: z.coerce.number().min(0, "Collected quantity cannot be negative"),
  driverGoodQty: z.coerce.number().min(0).default(0),
  driverDamagedQty: z.coerce.number().min(0).default(0),
  driverMissingQty: z.coerce.number().min(0).default(0),
  driverRemarks: z.string().optional().nullable(),
});

export const driverConfirmPickupSchema = z.object({
  items: z.array(driverPickupItemSchema).min(1, "At least one item must be verified"),
  customerRepresentativeName: z.string().min(2, "Customer representative name is required").trim(),
  customerRepresentativeDesignation: z.string().optional().nullable(),
  customerRepresentativePhone: OptionalIndianMobileSchema,
  customerSignatureUrl: z.string().optional().nullable(),
  customerSignatureExceptionReason: z.string().optional().nullable(),
  photoUrl: z.string().min(1, "At least one photo of returned materials is required"),
  additionalPhotoUrls: z.array(z.string()).optional().default([]),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  pickupCompletedAt: z.string().optional(),
  pickupOdometer: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type DriverConfirmPickupInput = z.infer<typeof driverConfirmPickupSchema>;

// Stage 9: Driver Yard Arrival & Handover to Warehouse Schema
export const driverYardArrivalSchema = z.object({
  yardArrivedAt: z.string().optional(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  yardOdometer: z.coerce.number().min(0).optional().nullable(),
  receivingWarehouseId: z.string().uuid().optional().nullable(),
  receiverName: z.string().min(2, "Warehouse receiver name is required").trim(),
  receiverDesignation: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  remarks: z.string().optional().nullable(),
});

export type DriverYardArrivalInput = z.infer<typeof driverYardArrivalSchema>;

// Stage 10: Warehouse Physical Receiving & QC Inspection Schema
export const warehouseInspectionItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  receivedQty: z.coerce.number().min(0, "Received quantity cannot be negative"),
  acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  damagedQty: z.coerce.number().min(0).default(0),
  missingQty: z.coerce.number().min(0).default(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  inspectionRemarks: z.string().optional().nullable(),
});

export const warehouseReceiveAndInspectSchema = z.object({
  receiverName: z.string().min(2, "Warehouse receiver name is required").trim(),
  receiverDesignation: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverSignatureUrl: z.string().optional().nullable(),
  companyStampUrl: z.string().optional().nullable(),
  receivedAt: z.string().optional(),
  inspectorName: z.string().min(2, "Inspector name is required").trim(),
  inspectorDesignation: z.string().optional().nullable(),
  inspectedAt: z.string().optional(),
  inspectionRemarks: z.string().optional().nullable(),
  customerAgreedDamage: z.boolean().default(false),
  items: z.array(warehouseInspectionItemSchema).min(1, "At least one item must be inspected"),
});

export type WarehouseReceiveAndInspectInput = z.infer<typeof warehouseReceiveAndInspectSchema>;

// Stage 11: Finalize MRN Schema
export const finalizeMrnSchema = z.object({
  includeReturnDate: z.boolean().default(false),
  remarks: z.string().optional().nullable(),
});

export type FinalizeMrnInput = z.infer<typeof finalizeMrnSchema>;

export const inspectionItemSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  damagedQty: z.coerce.number().min(0).default(0),
  missingQty: z.coerce.number().min(0).default(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
  inspectionRemarks: z.string().optional().nullable(),
});

export const recordMrnInspectionSchema = z.object({
  inspectorName: z.string().min(2, "Inspector name must be at least 2 characters").trim(),
  inspectorDesignation: z.string().optional().nullable(),
  inspectedAt: z.string().optional(),
  inspectionRemarks: z.string().optional().nullable(),
  customerAgreedDamage: z.boolean().default(false),
  items: z.array(inspectionItemSchema).min(1, "At least one item inspection record is required"),
});

export type RecordMrnInspectionInput = z.infer<typeof recordMrnInspectionSchema>;

export const completeMrnPickupSchema = z.object({
  receiverName: z.string().min(2, "Receiver/Handover person name is required").trim(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  customerRepresentativeName: z.string().optional().nullable(),
  customerRepresentativeDesignation: z.string().optional().nullable(),
  customerRepresentativePhone: OptionalIndianMobileSchema,
  customerSignatureUrl: z.string().optional().nullable(),
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


