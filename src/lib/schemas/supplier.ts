import { z } from "zod";
import {
  IndianMobileSchema,
  OptionalIndianMobileSchema,
  OptionalIndianPANSchema,
  OptionalIndianGSTINSchema,
  IndianPinCodeSchema,
  IndianIFSCCodeSchema,
} from "./common";

export const supplierSchema = z.object({
  supplierCode: z.string().min(2, "Supplier code is required").toUpperCase().trim(),
  name: z.string().min(2, "Supplier name is required").trim(),
  contactPerson: z.string().min(2, "Contact person is required").trim(),
  primaryMobile: IndianMobileSchema,
  alternateMobile: OptionalIndianMobileSchema,
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  gstStatus: z.enum(["REGISTERED", "UNREGISTERED", "COMPOSITION"]).default("UNREGISTERED"),
  gstin: OptionalIndianGSTINSchema,
  pan: OptionalIndianPANSchema,
  billingAddress: z.string().min(5, "Billing address must be at least 5 characters").trim(),
  state: z.string().min(2, "State is required").trim(),
  stateCode: z.string().min(2, "State code is required").trim(),
  pinCode: IndianPinCodeSchema,
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: IndianIFSCCodeSchema.optional().nullable().or(z.literal("")),
  supplierType: z.enum(["MANUFACTURER", "TRADER", "HIRE_VENDOR", "SERVICE_PROVIDER"]).default("MANUFACTURER"),
  openingBalance: z.coerce.number().default(0),
  creditTermsDays: z.coerce.number().int().min(0).default(30),
  isActive: z.boolean().default(true),
  internalRemarks: z.string().optional().nullable(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

