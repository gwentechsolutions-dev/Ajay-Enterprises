import { z } from "zod";
import {
  IndianMobileSchema,
  OptionalIndianMobileSchema,
  OptionalIndianPANSchema,
  OptionalIndianGSTINSchema,
  IndianIFSCCodeSchema,
  IndianPinCodeSchema,
} from "./common";

export const companyProfileSchema = z.object({
  legalName: z.string().min(2, "Legal business name is required"),
  tradeName: z.string().min(2, "Trade name is required"),
  entityType: z.enum(["PROPRIETORSHIP", "PARTNERSHIP", "PVT_LTD", "LTD", "LLP", "OTHER"]),
  establishmentDate: z.string().optional().or(z.literal("")),
  businessCategory: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  primaryMobile: IndianMobileSchema,
  alternateMobile: OptionalIndianMobileSchema,
  whatsappNumber: IndianMobileSchema,
  officialEmail: z.string().email("Invalid official email address"),
  alternateEmail: z.string().email("Invalid alternate email").optional().or(z.literal("")),
  contactPerson: z.string().min(2, "Contact person name is required"),
  telephone: z.string().optional().or(z.literal("")),
  pan: OptionalIndianPANSchema,
  gstin: OptionalIndianGSTINSchema,
  gstLegalName: z.string().optional().or(z.literal("")),
  gstTradeName: z.string().optional().or(z.literal("")),
  gstType: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]).default("REGULAR"),
  gstState: z.string().optional().or(z.literal("")),
  gstStateCode: z.string().max(2, "State code must be 2 digits (e.g. 29)").optional().or(z.literal("")),
  gstRegistrationDate: z.string().optional().or(z.literal("")),
  logoAssetUrl: z.string().optional().or(z.literal("")),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const companyAddressSchema = z.object({
  addressType: z.enum(["REGISTERED", "HEAD_OFFICE", "BILLING", "CORRESPONDENCE", "YARD"]),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  areaLocality: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  district: z.string().min(2, "District is required"),
  state: z.string().min(2, "State is required"),
  stateCode: z.string().length(2, "State code must be 2 digits (e.g. 29 for Karnataka)"),
  pinCode: IndianPinCodeSchema,
  country: z.string().default("India"),
  isDefaultBilling: z.boolean().default(false),
  isDefaultCorrespondence: z.boolean().default(false),
});

export type CompanyAddressInput = z.infer<typeof companyAddressSchema>;

export const bankAccountSchema = z
  .object({
    bankName: z.string().min(2, "Bank name is required"),
    accountHolderName: z.string().min(2, "Account holder name is required"),
    accountNumber: z
      .string()
      .min(9, "Account number must be at least 9 digits")
      .max(25, "Account number too long")
      .regex(/^[0-9A-Za-z]+$/, "Account number must be alphanumeric"),
    confirmAccountNumber: z.string().min(1, "Please confirm the account number"),
    ifscCode: IndianIFSCCodeSchema,
    branchName: z.string().optional().or(z.literal("")),
    accountType: z.enum(["CURRENT", "SAVINGS", "OVERDRAFT"]),
    upiId: z
      .string()
      .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Invalid UPI ID format (e.g. ajay@okaxis)")
      .optional()
      .or(z.literal("")),
    qrAssetUrl: z.string().optional().or(z.literal("")),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Account numbers do not match",
    path: ["confirmAccountNumber"],
  });

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const signatorySchema = z.object({
  name: z.string().min(2, "Signatory full name is required"),
  designation: z.string().min(2, "Designation is required (e.g. Proprietor, Managing Partner)"),
  signatureAssetUrl: z.string().min(1, "Signature image upload is required"),
  stampAssetUrl: z.string().optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.string().min(1, "Valid from date is required"),
  validUntil: z.string().optional().or(z.literal("")),
});

export type SignatoryInput = z.infer<typeof signatorySchema>;

