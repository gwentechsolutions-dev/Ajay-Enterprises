import { z } from "zod";
import { IndianPinCodeSchema } from "./common";

export const generateEWayBillSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "TRANSFER_NOTE"]),
  documentId: z.string().uuid("Document ID is required"),
  vehicleNumber: z.string().min(5, "Vehicle registration number is required").toUpperCase().trim(),
  fromPincode: IndianPinCodeSchema,
  toPincode: IndianPinCodeSchema,
  distanceKm: z.coerce.number().int().positive("Distance must be greater than zero"),
  provider: z.enum(["WHITEBOOKS", "FYN"]).optional(),
});

export type GenerateEWayBillInput = z.infer<typeof generateEWayBillSchema>;

export const cancelEWayBillSchema = z.object({
  ewbNumber: z.string().optional(),
  cancelReason: z.string().min(5, "Cancellation reason is required (min 5 characters)").trim(),
  cancelReasonCode: z.enum(["1", "2", "3", "4"]).default("4"),
});

export type CancelEWayBillInput = z.infer<typeof cancelEWayBillSchema>;

export const updateVehicleSchema = z.object({
  newVehicleNumber: z.string().min(5, "Vehicle registration number is required").toUpperCase().trim(),
  fromPlace: z.string().min(2, "Current place is required").trim(),
  fromStateCode: z.coerce.number().int().positive("State code is required"),
  reasonCode: z.enum(["1", "2", "3"]).default("3"),
  reasonDescription: z.string().min(3, "Reason description is required").trim(),
  transMode: z.enum(["1", "2", "3", "4"]).default("1"),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const ewbSettingsSchema = z.object({
  activeProvider: z.enum(["WHITEBOOKS", "FYN"]),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
});

export type EwbSettingsInput = z.infer<typeof ewbSettingsSchema>;
