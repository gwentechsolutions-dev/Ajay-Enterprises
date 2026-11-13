import { z } from "zod";
import { IndianMobileSchema, IndianPinCodeSchema } from "./common";

export const branchSchema = z.object({
  branchCode: z
    .string()
    .min(2, "Branch code must be at least 2 characters")
    .max(10, "Branch code too long")
    .regex(/^[A-Z0-9_-]+$/, "Branch code must be uppercase alphanumeric (e.g. BR-01)"),
  name: z.string().min(2, "Branch name is required"),
  branchType: z.enum(["MAIN_OFFICE", "REGIONAL_OFFICE", "YARD_BRANCH"]).default("MAIN_OFFICE"),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pinCode: IndianPinCodeSchema,
  contactPerson: z.string().min(2, "Contact person is required"),
  mobile: IndianMobileSchema,
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type BranchInput = z.infer<typeof branchSchema>;

export const warehouseSchema = z.object({
  warehouseCode: z
    .string()
    .min(2, "Warehouse code must be at least 2 characters")
    .max(10, "Warehouse code too long")
    .regex(/^[A-Z0-9_-]+$/, "Warehouse code must be uppercase alphanumeric (e.g. WH-01)"),
  name: z.string().min(2, "Warehouse name is required"),
  branchId: z.string().uuid("Please select a parent branch"),
  warehouseType: z.enum(["MAIN_YARD", "SECONDARY_YARD", "SATELLITE_YARD"]).default("MAIN_YARD"),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pinCode: IndianPinCodeSchema,
  contactPerson: z.string().min(2, "Contact person is required"),
  mobile: IndianMobileSchema,
  gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
  storageCapacitySqFt: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

