import { z } from "zod";

export const REPAIR_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const REPAIR_STATUSES = [
  "REPORTED",
  "UNDER_INSPECTION",
  "APPROVED_FOR_REPAIR",
  "IN_REPAIR",
  "AWAITING_PARTS",
  "REPAIR_COMPLETED",
  "QUALITY_CHECK",
  "RETURNED_TO_AVAILABLE_STOCK",
  "WRITTEN_OFF",
] as const;

export const REPAIR_ACTIONS = [
  "INSPECTED",
  "STARTED_WORK",
  "PARTS_REPLACED",
  "WELDING_DONE",
  "QUALITY_CHECKED",
  "RELEASED_TO_STOCK",
  "SCRAPPED",
] as const;

// 1. Create Material Repair Job
export const createMaterialRepairJobSchema = z.object({
  jobCode: z.string().optional(),
  warehouseId: z.string().uuid("Warehouse is required"),
  materialVariantId: z.string().uuid("Material variant is required"),
  ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  mrnId: z.string().uuid().optional().nullable().or(z.literal("")),
  rentalBatchId: z.string().uuid().optional().nullable().or(z.literal("")),
  totalQuantity: z.coerce.number().positive("Quantity must be greater than 0"),
  damageDescription: z.string().min(3, "Damage description is required"),
  damagePhotoUrl: z.string().url().optional().nullable().or(z.literal("")),
  priority: z.enum(REPAIR_PRIORITIES).default("MEDIUM"),
  assignedTechnicianId: z.string().uuid().optional().nullable().or(z.literal("")),
  targetDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// 2. Add Repair Progress Log
export const addRepairLogSchema = z.object({
  action: z.enum(REPAIR_ACTIONS),
  notes: z.string().min(2, "Notes are required"),
  technicianName: z.string().optional().nullable(),
  partsUsed: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
});

// 3. Complete Material Repair (Supports Partial Completion)
export const completeMaterialRepairSchema = z.object({
  repairedQuantity: z.coerce.number().positive("Repaired quantity must be greater than 0"),
  partsCost: z.coerce.number().min(0).default(0),
  labourCost: z.coerce.number().min(0).default(0),
  externalVendorCost: z.coerce.number().min(0).default(0),
  repairVendor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  postToInventory: z.boolean().default(true),
  postToAccounts: z.boolean().default(true),
  paidFromAccountId: z.string().uuid().optional().nullable(),
});

// 4. Scrap / Write-Off Damaged Material
export const scrapMaterialRepairSchema = z.object({
  scrappedQuantity: z.coerce.number().positive("Scrapped quantity must be greater than 0"),
  reason: z.string().min(3, "Reason for scrap write-off is required"),
  scrapValueRecovered: z.coerce.number().min(0).default(0),
  postToInventory: z.boolean().default(true),
  postToAccounts: z.boolean().default(true),
  depositToAccountId: z.string().uuid().optional().nullable(),
});

