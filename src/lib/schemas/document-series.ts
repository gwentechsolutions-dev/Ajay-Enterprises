import { z } from "zod";

export const documentSeriesSchema = z.object({
  documentType: z.string().min(1, "Document type is required"),
  prefix: z.string().min(1, "Prefix is required (e.g. AE/DN/)"),
  fiscalYear: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Fiscal year must match format YYYY-YY (e.g. 2026-27)"),
  currentCounter: z.number().int().min(0, "Starting counter cannot be negative").default(0),
  padding: z.number().int().min(2).max(8).default(4),
  suffix: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type DocumentSeriesInput = z.infer<typeof documentSeriesSchema>;

export const financialYearSchema = z.object({
  yearCode: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Financial year code must be YYYY-YY (e.g. 2026-27)"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isCurrent: z.boolean().default(false),
  isClosed: z.boolean().default(false),
});

export type FinancialYearInput = z.infer<typeof financialYearSchema>;

