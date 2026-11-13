import { z } from "zod";
import { IndianPinCodeSchema } from "./common";

export const generateEWayBillSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "TRANSFER_NOTE"]),
  documentId: z.string().uuid("Document ID is required"),
  vehicleNumber: z.string().min(5, "Vehicle registration number is required").toUpperCase().trim(),
  fromPincode: IndianPinCodeSchema,
  toPincode: IndianPinCodeSchema,
  distanceKm: z.coerce.number().int().positive("Distance must be greater than zero"),
});

export type GenerateEWayBillInput = z.infer<typeof generateEWayBillSchema>;

export const cancelEWayBillSchema = z.object({
  ewbNumber: z.string().min(10, "E-Way Bill number is required").trim(),
  cancelReason: z.string().min(5, "Cancellation reason is required").trim(),
});

export type CancelEWayBillInput = z.infer<typeof cancelEWayBillSchema>;

