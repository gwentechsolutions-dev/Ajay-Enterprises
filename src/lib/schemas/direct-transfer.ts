import { z } from "zod";

export const directTransferItemInputSchema = z.object({
  materialVariantId: z.string().uuid("Invalid material variant ID"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  sourceRentalBatchId: z.string().uuid().optional().nullable(),
  quantityDispatched: z.coerce.number().positive("Dispatched quantity must be greater than zero"),
  quantityCollected: z.coerce.number().min(0).optional(),
  quantityGodownReturned: z.coerce.number().min(0).optional(),
  agreedDailyRate: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const createDirectTransferSchema = z.object({
  transferNumber: z.string().optional(),
  transferDate: z.string().optional(),
  sourceCustomerId: z.string().uuid("Source customer is required"),
  sourceCustomerSiteId: z.string().uuid("Source customer site is required"),
  destinationCustomerId: z.string().uuid("Destination customer is required"),
  destinationCustomerSiteId: z.string().uuid("Destination customer site is required"),
  sourceRentalAgreementId: z.string().uuid().optional().nullable(),
  destinationRentalAgreementId: z.string().uuid().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  vehicleTripId: z.string().uuid().optional().nullable(),
  preferredPickupTime: z.string().optional().nullable(),
  expectedArrivalTime: z.string().optional().nullable(),
  includeCutoffDate: z.boolean().default(false),
  transportCharges: z.coerce.number().min(0).default(0),
  transportPayer: z.enum(["SOURCE_CUSTOMER", "DESTINATION_CUSTOMER", "AJAY_ENTERPRISES"]).default("DESTINATION_CUSTOMER").optional().nullable(),
  payerAllocation: z.enum(["SOURCE_CUSTOMER", "DESTINATION_CUSTOMER", "AJAY_ENTERPRISES"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(directTransferItemInputSchema).min(1, "At least one material line item is required"),
}).refine(
  (data) => data.sourceCustomerSiteId !== data.destinationCustomerSiteId,
  {
    message: "Source site and destination site must be different",
    path: ["destinationCustomerSiteId"],
  }
);

export type CreateDirectTransferInput = z.infer<typeof createDirectTransferSchema>;

export const dispatchDirectTransferSchema = z.object({
  sourceRepName: z.string().min(1, "Source representative name is required"),
  sourceRepPhone: z.string().optional().nullable(),
  sourceRepDesignation: z.string().optional().nullable(),
  sourceRepSignatureUrl: z.string().optional().nullable(),
  sourceGpsLat: z.coerce.number().optional().nullable(),
  sourceGpsLng: z.coerce.number().optional().nullable(),
  sourcePhotoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type DispatchDirectTransferInput = z.infer<typeof dispatchDirectTransferSchema>;

export const receiveTransferItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantityAccepted: z.coerce.number().min(0, "Accepted quantity cannot be negative"),
  quantityGodownReturned: z.coerce.number().min(0).default(0),
  quantityDamaged: z.coerce.number().min(0).default(0),
  quantityMissing: z.coerce.number().min(0).default(0),
  quantityRejected: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

export const pickupTransferItemSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  quantityCollected: z.coerce.number().min(0, "Collected quantity cannot be negative"),
  quantityUnavailable: z.coerce.number().min(0).default(0),
  quantityDamaged: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

export const pickupDirectTransferSchema = z.object({
  sourceRepName: z.string().min(1, "Source representative name is required"),
  sourceRepPhone: z.string().optional().nullable(),
  sourceRepDesignation: z.string().optional().nullable(),
  sourceRepSignatureUrl: z.string().optional().nullable(),
  sourceGpsLat: z.coerce.number().optional().nullable(),
  sourceGpsLng: z.coerce.number().optional().nullable(),
  sourcePhotoUrl: z.string().optional().nullable(),
  odometerReading: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(pickupTransferItemSchema).optional(),
});

export type PickupDirectTransferInput = z.infer<typeof pickupDirectTransferSchema>;

export const godownReturnTransferSchema = z.object({
  warehouseId: z.string().uuid("Receiving warehouse is required"),
  yardArrivalGpsLat: z.coerce.number().optional().nullable(),
  yardArrivalGpsLng: z.coerce.number().optional().nullable(),
  yardOdometer: z.coerce.number().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantityReceived: z.coerce.number().min(0),
        quantityDamaged: z.coerce.number().min(0).default(0),
        condition: z.string().default("GOOD"),
      })
    )
    .optional(),
});

export type GodownReturnTransferInput = z.infer<typeof godownReturnTransferSchema>;

export const receiveDirectTransferSchema = z.object({
  destRepName: z.string().min(1, "Destination representative name is required"),
  destRepPhone: z.string().optional().nullable(),
  destRepDesignation: z.string().optional().nullable(),
  destRepSignatureUrl: z.string().optional().nullable(),
  destGpsLat: z.coerce.number().optional().nullable(),
  destGpsLng: z.coerce.number().optional().nullable(),
  destPhotoUrl: z.string().optional().nullable(),
  discrepancyNotes: z.string().optional().nullable(),
  discrepancyResponsibleParty: z
    .enum(["SOURCE_CUSTOMER", "TRANSPORTER", "DESTINATION_CUSTOMER", "UNDER_INVESTIGATION"])
    .default("UNDER_INVESTIGATION")
    .optional(),
  rejectedDisposition: z
    .enum(["RETURN_TO_WAREHOUSE", "HELD_IN_TRANSIT", "RETURNED_TO_SOURCE"])
    .default("RETURN_TO_WAREHOUSE")
    .optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  items: z.array(receiveTransferItemSchema).min(1, "At least one item must be reconciled"),
});

export type ReceiveDirectTransferInput = z.infer<typeof receiveDirectTransferSchema>;
