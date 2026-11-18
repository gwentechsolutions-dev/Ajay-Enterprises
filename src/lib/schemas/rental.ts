import { z } from "zod";

// ==============================================================================
// 1. Rental Agreement Schemas
// ==============================================================================

export const rentalAgreementItemSchema = z.object({
  materialVariantId: z.string().uuid("Invalid material variant ID"),
  agreedDailyRate: z.coerce.number().min(0, "Agreed daily rate cannot be negative"),
  quantity: z.coerce.number().min(0).optional().nullable(),
  securityDepositRate: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const createRentalAgreementSchema = z.object({
  agreementNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer Site is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  billingFrequency: z.enum(["MONTHLY", "CUSTOM"]).default("MONTHLY"),
  billingCycleDay: z.coerce.number().int().min(1).max(31).default(1),
  depositAmount: z.coerce.number().min(0).default(0),
  depositStatus: z.enum(["PENDING", "PARTIALLY_PAID", "FULLY_PAID", "REFUNDED"]).default("PENDING"),
  paymentTerms: z.string().optional().nullable(),
  specialTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(rentalAgreementItemSchema).min(1, "At least one material rate item is required"),
});

export type CreateRentalAgreementInput = z.infer<typeof createRentalAgreementSchema>;

// ==============================================================================
// 2. Rental Calculation & Monthly Statement Schemas
// ==============================================================================

export const baseCalculateStatementSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  billingMode: z.enum(["SITE_WISE", "CONSOLIDATED"]).default("SITE_WISE"),
  customerSiteId: z.string().uuid().optional().nullable(),
  customerSiteIds: z.array(z.string().uuid()).optional(),
  rentalAgreementId: z.string().uuid().optional().nullable(),
  periodStartDate: z.string().min(1, "Period start date is required"),
  periodEndDate: z.string().min(1, "Period end date is required"),
  includeDamageCharges: z.boolean().default(true),
  includeMissingCharges: z.boolean().default(true),
  adjustments: z.coerce.number().default(0),
  previousBalanceInformational: z.coerce.number().default(0),
  remarks: z.string().optional().nullable(),
});

export const calculateStatementSchema = baseCalculateStatementSchema.refine(
  (data) => {
    if (data.billingMode === "SITE_WISE") {
      return !!data.customerSiteId;
    }
    return true;
  },
  {
    message: "customerSiteId is required for SITE_WISE billing",
    path: ["customerSiteId"],
  }
);

export type CalculateStatementInput = z.infer<typeof calculateStatementSchema>;

export const createRentalStatementSchema = baseCalculateStatementSchema
  .extend({
    statementNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.billingMode === "SITE_WISE") {
        return !!data.customerSiteId;
      }
      return true;
    },
    {
      message: "customerSiteId is required for SITE_WISE billing",
      path: ["customerSiteId"],
    }
  );

export type CreateRentalStatementInput = z.infer<typeof createRentalStatementSchema>;

// ==============================================================================
// 3. Damage and Loss Assessment Schemas
// ==============================================================================

export const createDamageLossSchema = z.object({
  assessmentNumber: z.string().optional(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer Site is required"),
  materialReturnNoteId: z.string().uuid().optional().nullable(),
  materialVariantId: z.string().uuid("Material variant is required"),
  assessmentType: z.enum(["DAMAGED_REPAIRABLE", "DAMAGED_SCRAP", "MISSING"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  condition: z.string().default("DAMAGED"),
  assessmentDate: z.string().optional(),
  approvedChargeAmount: z.coerce.number().min(0, "Approved charge amount cannot be negative"),
  remarks: z.string().optional().nullable(),
  photographs: z.array(z.string()).optional(),
});

export type CreateDamageLossInput = z.infer<typeof createDamageLossSchema>;

export const damageLossItemInputSchema = z.object({
  materialVariantId: z.string().uuid("Material variant is required"),
  assessmentType: z.enum(["DAMAGED_REPAIRABLE", "DAMAGED_SCRAP", "MISSING"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  condition: z.string().default("DAMAGED"),
  approvedChargeAmount: z.coerce.number().min(0, "Charge amount must be positive or zero"),
  remarks: z.string().optional().nullable(),
  photographs: z.array(z.string()).optional(),
});

export type DamageLossItemInput = z.infer<typeof damageLossItemInputSchema>;

export const createDamageLossBatchSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer Site is required"),
  materialReturnNoteId: z.string().uuid().optional().nullable(),
  assessmentDate: z.string().optional(),
  items: z.array(damageLossItemInputSchema).min(1, "At least one material item is required"),
});

export type CreateDamageLossBatchInput = z.infer<typeof createDamageLossBatchSchema>;

// ==============================================================================
// 4. Rental Deposit Transaction Schemas
// ==============================================================================

export const createRentalDepositSchema = z.object({
  depositNumber: z.string().optional(),
  rentalAgreementId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid("Customer Site is required"),
  transactionType: z.enum(["DEPOSIT_RECEIVED", "DEPOSIT_ADJUSTMENT", "DEPOSIT_REFUND"]),
  amount: z.coerce.number().positive("Deposit amount must be positive"),
  receiptDate: z.string().optional(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  refundEligibility: z.boolean().default(false),
  refundAmount: z.coerce.number().min(0).optional().nullable(),
});

export type CreateRentalDepositInput = z.infer<typeof createRentalDepositSchema>;

// ==============================================================================
// 5. Site Closure & Final Settlement Schemas
// ==============================================================================

export const checkSiteClosureSchema = z.object({
  customerSiteId: z.string().uuid("Customer Site is required"),
});

export const createSiteClosureSchema = z.object({
  customerSiteId: z.string().uuid("Customer Site is required"),
  closureDate: z.string().optional(),
  ownerApprovedException: z.boolean().default(false),
  exceptionReason: z.string().optional().nullable(),
  customerAcknowledgement: z
    .object({
      name: z.string(),
      phone: z.string(),
      designation: z.string().optional(),
      signatureUrl: z.string().optional(),
      date: z.string().optional(),
    })
    .optional()
    .nullable(),
  remarks: z.string().optional().nullable(),
});

export type CreateSiteClosureInput = z.infer<typeof createSiteClosureSchema>;
