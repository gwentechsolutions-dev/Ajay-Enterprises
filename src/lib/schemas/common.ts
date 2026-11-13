import { z } from "zod";

export const IndianMobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number (e.g. 9876543210)");

export const OptionalIndianMobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
  .optional()
  .or(z.literal(""));

export const IndianPANSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)");

export const OptionalIndianPANSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)")
  .optional()
  .or(z.literal(""));

export const IndianGSTINSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "Invalid GSTIN format (15 characters, e.g. 29ABCDE1234F1Z5)"
  );

export const OptionalIndianGSTINSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "Invalid GSTIN format (15 characters, e.g. 29ABCDE1234F1Z5)"
  )
  .optional()
  .or(z.literal(""));

export const IndianIFSCCodeSchema = z
  .string()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC Code format (e.g. SBIN0001234, HDFC0000001)");

export const IndianPinCodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{5}$/, "Invalid 6-digit Indian PIN Code (e.g. 560001)");

