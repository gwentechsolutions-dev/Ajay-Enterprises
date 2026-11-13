import { z } from "zod";

export const materialCategorySchema = z.object({
  categoryCode: z.string().min(2, "Category code must be at least 2 characters").toUpperCase().trim(),
  name: z.string().min(2, "Category name must be at least 2 characters").trim(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type MaterialCategoryInput = z.infer<typeof materialCategorySchema>;

export const materialTypeSchema = z.object({
  categoryId: z.string().uuid("Valid category is required"),
  typeCode: z.string().min(2, "Type code must be at least 2 characters").toUpperCase().trim(),
  name: z.string().min(2, "Type name must be at least 2 characters").trim(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type MaterialTypeInput = z.infer<typeof materialTypeSchema>;

export const materialVariantSchema = z.object({
  materialTypeId: z.string().uuid("Valid material type is required"),
  materialCode: z.string().min(2, "Material code is required").toUpperCase().trim(),
  name: z.string().min(2, "Material name is required").trim(),
  size: z.string().min(1, "Size or dimension specification is required").trim(),
  description: z.string().optional().nullable(),
  uom: z.string().default("Nos."),
  defaultRentalRate: z.coerce.number().min(0, "Rental rate cannot be negative"),
  purchaseCost: z.coerce.number().min(0, "Purchase cost cannot be negative").optional().nullable(),
  replacementValue: z.coerce.number().min(0, "Replacement value cannot be negative").optional().nullable(),
  minimumStock: z.coerce.number().min(0, "Minimum stock cannot be negative").default(0),
  preferredSupplierId: z.string().uuid().optional().nullable().or(z.literal("")),
  ownershipClassification: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  isActive: z.boolean().default(true),
});

export type MaterialVariantInput = z.infer<typeof materialVariantSchema>;

export const updateRateSchema = z.object({
  rentalRate: z.coerce.number().min(0, "Rental rate cannot be negative"),
  reason: z.string().min(3, "Reason for rate change is required").trim(),
  effectiveFrom: z.string().optional(),
});

export type UpdateRateInput = z.infer<typeof updateRateSchema>;
