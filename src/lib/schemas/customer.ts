import { z } from "zod";
import {
  IndianMobileSchema,
  OptionalIndianMobileSchema,
  OptionalIndianPANSchema,
  OptionalIndianGSTINSchema,
  IndianPinCodeSchema,
} from "./common";

export const customerSchema = z.object({
  customerCode: z.string().min(2, "Customer code is required").toUpperCase().trim(),
  name: z.string().min(2, "Customer or Company name is required").trim(),
  customerType: z.enum(["INDIVIDUAL", "COMPANY", "CONTRACTOR"]).default("COMPANY"),
  legalBusinessName: z.string().optional().nullable(),
  primaryMobile: IndianMobileSchema,
  alternateMobile: OptionalIndianMobileSchema,
  whatsappNumber: OptionalIndianMobileSchema,
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  pan: OptionalIndianPANSchema,
  gstStatus: z.enum(["REGISTERED", "UNREGISTERED", "COMPOSITION"]).default("UNREGISTERED"),
  gstin: OptionalIndianGSTINSchema,
  billingAddress: z.string().min(5, "Billing address must be at least 5 characters").trim(),
  communicationAddress: z.string().optional().nullable(),
  state: z.string().min(2, "State is required").trim(),
  stateCode: z.string().min(2, "State code is required").trim(),
  pinCode: IndianPinCodeSchema.optional().nullable().or(z.literal("")),
  businessType: z.string().optional().nullable(),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  paymentTermsDays: z.coerce.number().int().min(0).default(30),
  openingBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const customerSiteSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  siteCode: z.string().min(2, "Site code is required").toUpperCase().trim(),
  siteName: z.string().min(2, "Site name is required").trim(),
  fullAddress: z.string().min(5, "Full site address is required").trim(),
  state: z.string().min(2, "State is required").trim(),
  stateCode: z.string().min(2, "State code is required").trim(),
  district: z.string().min(2, "District is required").trim(),
  city: z.string().min(2, "City is required").trim(),
  pinCode: IndianPinCodeSchema,
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  siteOwnerName: z.string().optional().nullable(),
  siteOwnerContact: OptionalIndianMobileSchema,
  siteInCharge: z.string().optional().nullable(),
  siteContactDetails: z.string().optional().nullable(),
  projectType: z.string().optional().nullable(),
  deliveryInstructions: z.string().optional().nullable(),
  openingDate: z.string().optional(),
  expectedClosingDate: z.string().optional().nullable(),
  actualClosingDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "CLOSED"]).default("ACTIVE"),
  internalRemarks: z.string().optional().nullable(),
});

export type CustomerSiteInput = z.infer<typeof customerSiteSchema>;

export const contactPersonSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  name: z.string().min(2, "Contact name is required").trim(),
  mobile: IndianMobileSchema,
  alternateMobile: OptionalIndianMobileSchema,
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  designation: z.string().min(2, "Designation is required").trim(),
  contactType: z.enum(["PRIMARY", "BILLING", "SITE_INCHARGE", "RECEIVER", "OWNER"]).default("SITE_INCHARGE"),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  canReceiveDeliveryNotes: z.boolean().default(true),
  canAcknowledgeDeliveries: z.boolean().default(true),
  canReceiveReturnNotes: z.boolean().default(true),
  canReceiveInvoices: z.boolean().default(false),
  canReceivePaymentReminders: z.boolean().default(false),
  canReceiveWhatsApp: z.boolean().default(true),
});

export type ContactPersonInput = z.infer<typeof contactPersonSchema>;
