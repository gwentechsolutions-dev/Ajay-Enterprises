import { z } from "zod";

export const WORKER_CATEGORIES = [
  "LOADING_UNLOADING",
  "WAREHOUSE_LABOUR",
  "DRIVERS",
  "MATERIAL_HANDLING",
  "REPAIR_MAINTENANCE",
  "GENERAL_LABOUR",
  "SKILLED",
  "SUPERVISOR",
  "OTHER",
] as const;

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "PAID_LEAVE",
  "UNPAID_LEAVE",
  "HOLIDAY",
] as const;

export const WAGE_TYPES = ["DAILY", "MONTHLY"] as const;
export const PAYMENT_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

// 1. Worker Schemas
export const createLabourWorkerSchema = z.object({
  workerCode: z.string().optional(),
  name: z.string().min(2, "Worker name is required"),
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  category: z.enum(WORKER_CATEGORIES).default("GENERAL_LABOUR"),
  skillTrade: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  wageType: z.enum(WAGE_TYPES).default("DAILY"),
  dailyWage: z.coerce.number().min(0).default(0),
  monthlySalary: z.coerce.number().min(0).default(0),
  paymentFrequency: z.enum(PAYMENT_FREQUENCIES).default("MONTHLY"),
  assignedSupervisorId: z.string().uuid().optional().nullable().or(z.literal("")),
  branchId: z.string().uuid().optional().nullable().or(z.literal("")),
  idDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  notes: z.string().optional().nullable(),
});

export const updateLabourWorkerSchema = createLabourWorkerSchema.partial();

// 2. Attendance Schemas
export const recordAttendanceItemSchema = z.object({
  workerId: z.string().uuid("Worker ID is required"),
  attendanceDate: z.string().min(4, "Attendance date is required"),
  branchId: z.string().uuid().optional().nullable().or(z.literal("")),
  customerSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  status: z.enum(ATTENDANCE_STATUSES).default("PRESENT"),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  overtimeHours: z.coerce.number().min(0).max(16).default(0),
  supervisorRemarks: z.string().optional().nullable(),
});

export const bulkAttendanceSchema = z.object({
  attendanceDate: z.string().min(4, "Attendance date is required"),
  branchId: z.string().uuid().optional().nullable().or(z.literal("")),
  customerSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  records: z.array(recordAttendanceItemSchema).min(1, "At least one record is required"),
});

// 3. Labour Advance Schema
export const createLabourAdvanceSchema = z.object({
  advanceNumber: z.string().optional(),
  workerId: z.string().uuid("Worker ID is required"),
  advanceDate: z.string().optional(),
  amount: z.coerce.number().positive("Advance amount must be greater than 0"),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI"]).default("CASH"),
  paymentReference: z.string().optional().nullable(),
  paidFromAccountId: z.string().uuid().optional().nullable(),
  purpose: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
  remarks: z.string().optional().nullable(),
});

// 4. Wage Calculation & Settlement Schema
export const calculateWageSettlementSchema = z.object({
  workerId: z.string().uuid("Worker ID is required"),
  periodStart: z.string().min(4, "Start date is required"),
  periodEnd: z.string().min(4, "End date is required"),
  overtimeRatePerHour: z.coerce.number().min(0).optional(),
  halfDayFactor: z.coerce.number().min(0).max(1).default(0.5),
  bonusAmount: z.coerce.number().min(0).default(0),
  otherDeductions: z.coerce.number().min(0).default(0),
  advanceDeduction: z.coerce.number().min(0).optional(),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(false),
  paidFromAccountId: z.string().uuid().optional().nullable(),
});

// 5. Labour Payment Schema
export const recordLabourPaymentSchema = z.object({
  workerId: z.string().uuid("Worker ID is required"),
  wageSettlementId: z.string().uuid().optional().nullable().or(z.literal("")),
  paymentDate: z.string().optional(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI"]).default("CASH"),
  paymentReference: z.string().optional().nullable(),
  paidFromAccountId: z.string().uuid().optional().nullable(),
  receiptDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
});

