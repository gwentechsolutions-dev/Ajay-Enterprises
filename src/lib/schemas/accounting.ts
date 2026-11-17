import { z } from "zod";

// ==============================================================================
// INVENTRA ACCOUNTING SCHEMAS: PHASE 5
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

export const AccountCategoryEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

export const AccountSubcategoryEnum = z.enum([
  "CASH_IN_HAND",
  "BANK_ACCOUNT",
  "UPI_CLEARING",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "CUSTOMER_ADVANCES",
  "SUPPLIER_ADVANCES",
  "SECURITY_DEPOSIT_LIABILITY",
  "RENTAL_INCOME",
  "SALES_INCOME",
  "HIRING_INCOME",
  "SERVICE_INCOME",
  "PURCHASE_EXPENSE",
  "MATERIAL_REPAIR",
  "LABOUR_EXPENSE",
  "VEHICLE_EXPENSE",
  "OFFICE_EXPENSE",
  "GST_INPUT_TAX_CREDIT",
  "GST_OUTPUT_LIABILITY",
  "TDS_PAYABLE",
  "TDS_RECEIVABLE",
  "DEPRECIATION",
  "BAD_DEBTS",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
]);

// ------------------------------------------------------------------------------
// 1. Chart of Accounts Schema
// ------------------------------------------------------------------------------

export const createAccountSchema = z.object({
  accountCode: z.string().min(3, "Account code must be at least 3 characters").max(20),
  accountName: z.string().min(2, "Account name is required").max(100),
  accountCategory: AccountCategoryEnum,
  accountSubcategory: AccountSubcategoryEnum,
  parentAccountId: z.string().uuid().optional().nullable(),
  currency: z.string().default("INR"),
  openingBalance: z.coerce.number().default(0),
  openingBalanceType: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  isControlAccount: z.boolean().default(false),
  bankAccountId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// ------------------------------------------------------------------------------
// 2. Journal Entry & Line Schemas
// ------------------------------------------------------------------------------

export const journalLineSchema = z.object({
  accountId: z.string().uuid("Valid account is required"),
  description: z.string().optional().nullable(),
  debitAmount: z.coerce.number().min(0, "Debit cannot be negative").default(0),
  creditAmount: z.coerce.number().min(0, "Credit cannot be negative").default(0),
  customerId: z.string().uuid().optional().nullable(),
  customerSiteId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => (data.debitAmount > 0 && data.creditAmount === 0) || (data.creditAmount > 0 && data.debitAmount === 0),
  { message: "A journal line must have either debit or credit amount, not both." }
);

export const createJournalEntrySchema = z.object({
  journalNumber: z.string().optional(),
  journalType: z.enum([
    "GENERAL",
    "SALES",
    "PURCHASE",
    "RECEIPT",
    "PAYMENT",
    "CONTRA",
    "ADJUSTMENT",
    "REVERSAL",
    "YEAR_END_CLOSING",
  ]).default("GENERAL"),
  postingDate: z.string().optional(),
  accountingPeriodId: z.string().uuid().optional().nullable(),
  narration: z.string().min(3, "Narration is required"),
  referenceDocumentType: z.string().optional().nullable(),
  referenceDocumentId: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  supportingDocUrl: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, "Journal entry must have at least 2 lines"),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

// ------------------------------------------------------------------------------
// 3. Sales & Rental Invoicing Schemas
// ------------------------------------------------------------------------------

export const invoiceItemSchema = z.object({
  materialVariantId: z.string().uuid().optional().nullable(),
  itemType: z.enum(["RENTAL", "SALES", "SERVICE", "DAMAGE_CHARGE", "MISSING_CHARGE", "TRANSPORT", "OTHER"]).default("RENTAL"),
  itemDescription: z.string().min(2, "Description is required"),
  hsnSacCode: z.string().default("9973"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  uom: z.string().default("Nos."),
  unitRate: z.coerce.number().min(0, "Rate cannot be negative"),
  discountAmount: z.coerce.number().min(0).default(0),
  gstRatePercent: z.coerce.number().min(0).max(100).default(18),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceType: z.enum(["RENTAL", "SALES", "SERVICE", "HIRING_OUT"]),
  customerId: z.string().uuid("Customer is required"),
  customerSiteId: z.string().uuid().optional().nullable(),
  rentalStatementId: z.string().uuid().optional().nullable(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  placeOfSupply: z.string().length(2, "State code must be 2 digits").default("33"),
  customerGstin: z.string().optional().nullable(),
  customerPan: z.string().optional().nullable(),
  billingAddress: z.any().optional(),
  shippingAddress: z.any().optional(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "Invoice must contain at least one line item"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const generateRentalInvoiceFromStatementSchema = z.object({
  statementId: z.string().uuid("Valid rental statement ID is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

// ------------------------------------------------------------------------------
// 4. Credit & Debit Note Schemas
// ------------------------------------------------------------------------------

export const createCreditDebitNoteSchema = z.object({
  noteNumber: z.string().optional(),
  noteType: z.enum(["CREDIT_NOTE", "DEBIT_NOTE"]),
  invoiceId: z.string().uuid("Invoice reference is required"),
  noteDate: z.string().optional(),
  reason: z.enum([
    "RATE_DIFFERENCE",
    "DISCOUNT",
    "QUANTITY_ADJUSTMENT",
    "DAMAGE_WAIVER",
    "RETURN",
    "OTHER",
  ]),
  taxableAmount: z.coerce.number().positive("Taxable amount must be positive"),
  gstRatePercent: z.coerce.number().min(0).max(100).default(18),
  hsnSacCode: z.string().default("9973"),
  description: z.string().min(3, "Description is required"),
  remarks: z.string().optional().nullable(),
});

export type CreateCreditDebitNoteInput = z.infer<typeof createCreditDebitNoteSchema>;

// ------------------------------------------------------------------------------
// 5. Purchase Bill & Supplier Invoicing Schemas
// ------------------------------------------------------------------------------

export const purchaseBillItemSchema = z.object({
  materialVariantId: z.string().uuid().optional().nullable(),
  description: z.string().min(2, "Description is required"),
  hsnSacCode: z.string().default("7308"),
  quantity: z.coerce.number().positive(),
  uom: z.string().default("Nos."),
  unitRate: z.coerce.number().min(0),
  gstRatePercent: z.coerce.number().min(0).max(100).default(18),
});

export const createPurchaseBillSchema = z.object({
  billNumber: z.string().optional(),
  billType: z.enum(["MATERIAL_PURCHASE", "EXPENSE", "FREIGHT", "MAINTENANCE"]).default("MATERIAL_PURCHASE"),
  supplierId: z.string().uuid("Supplier is required"),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  goodsReceiptNoteId: z.string().uuid().optional().nullable(),
  supplierInvoiceNumber: z.string().min(1, "Supplier Invoice Number is required"),
  supplierInvoiceDate: z.string().min(1, "Supplier Invoice Date is required"),
  billDate: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  placeOfSupply: z.string().length(2).default("33"),
  itcEligibility: z.enum(["INPUT_GOODS", "INPUT_SERVICES", "CAPITAL_GOODS", "INELIGIBLE_SEC_17_5", "ELIGIBLE", "BLOCKED"]).default("INPUT_GOODS"),
  itcBlockReason: z.string().optional().nullable(),
  tdsSection: z.enum(["194C", "194Q", "194I", "194J", "NONE"]).default("NONE"),
  tdsPercent: z.coerce.number().min(0).max(30).default(0),
  remarks: z.string().optional().nullable(),
  supportingDocUrl: z.string().optional().nullable(),
  items: z.array(purchaseBillItemSchema).min(1, "Bill must contain at least one line item"),
});

export type CreatePurchaseBillInput = z.infer<typeof createPurchaseBillSchema>;

// ------------------------------------------------------------------------------
// 6. Customer Receipts & Payment Allocations
// ------------------------------------------------------------------------------

export const allocationItemSchema = z.object({
  invoiceId: z.string().uuid("Valid invoice ID is required"),
  amount: z.coerce.number().positive("Allocated amount must be positive"),
});

export const createPaymentReceiptSchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === "object") {
      if (!data.depositAccountId && data.receivingAccountId) {
        return { ...data, depositAccountId: data.receivingAccountId };
      }
    }
    return data;
  },
  z.object({
    receiptNumber: z.string().optional(),
    customerId: z.string().uuid("Customer is required"),
    paymentDate: z.string().optional(),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "NEFT_RTGS", "UPI", "CHEQUE"]),
    depositAccountId: z.string().uuid("Deposit bank/cash account is required"),
    receivingAccountId: z.string().uuid().optional(),
    amountReceived: z.coerce.number().positive("Amount received must be greater than zero"),
    transactionReference: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    chequeDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    supportingDocUrl: z.string().optional().nullable(),
    allocations: z.array(allocationItemSchema).optional(),
  })
);

export type CreatePaymentReceiptInput = z.infer<typeof createPaymentReceiptSchema>;

// ------------------------------------------------------------------------------
// 7. Supplier Payments
// ------------------------------------------------------------------------------

export const supplierAllocationItemSchema = z.object({
  purchaseBillId: z.string().uuid("Valid purchase bill ID is required"),
  amount: z.coerce.number().positive("Allocated amount must be positive"),
});

export const createSupplierPaymentSchema = z.object({
  paymentNumber: z.string().optional(),
  supplierId: z.string().uuid("Supplier is required"),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "NEFT_RTGS", "UPI", "CASH", "CHEQUE"]),
  disbursingAccountId: z.string().uuid("Disbursing account is required"),
  amountPaid: z.coerce.number().positive("Amount paid must be greater than zero"),
  transactionReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(supplierAllocationItemSchema).optional(),
});

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

// ------------------------------------------------------------------------------
// 8. Banking Contra & Transfers
// ------------------------------------------------------------------------------

export const createContraTransactionSchema = z.object({
  fromAccountId: z.string().uuid("Source account is required"),
  toAccountId: z.string().uuid("Destination account is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  transactionDate: z.string().optional(),
  referenceNumber: z.string().optional().nullable(),
  description: z.string().min(3, "Description is required"),
});

export type CreateContraTransactionInput = z.infer<typeof createContraTransactionSchema>;

// ------------------------------------------------------------------------------
// 9. Accounting Period & Financial Year Closing
// ------------------------------------------------------------------------------

export const lockPeriodSchema = z.object({
  periodId: z.string().uuid("Period ID is required"),
  isLocked: z.boolean(),
  notes: z.string().optional().nullable(),
});

export const closeFinancialYearSchema = z.object({
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/, "Must be format YYYY-YY (e.g. 2025-26)"),
  retainedEarningsAccountId: z.string().uuid("Retained earnings account is required"),
  remarks: z.string().optional().nullable(),
});

