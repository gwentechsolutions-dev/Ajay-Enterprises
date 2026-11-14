import { z } from "zod";

export const VEHICLE_CATEGORIES = [
  "TWO_WHEELER",
  "CAR",
  "VAN",
  "PICKUP",
  "TRUCK",
  "TRACTOR",
  "OTHER",
] as const;

export const FUEL_TYPES = [
  "PETROL",
  "DIESEL",
  "CNG",
  "ELECTRIC",
  "HYBRID",
] as const;

export const VEHICLE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_MAINTENANCE",
  "SOLD",
  "RETIRED",
] as const;

export const TRIP_PURPOSES = [
  "DELIVERY",
  "RETURN_PICKUP",
  "SITE_TRANSFER",
  "MAINTENANCE",
  "OTHER",
] as const;

export const TRIP_STATUSES = [
  "PLANNED",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
] as const;

export const SERVICE_CATEGORIES = [
  "REGULAR_SERVICE",
  "ENGINE_REPAIR",
  "TYRES",
  "BATTERY",
  "BRAKE_SYSTEM",
  "ELECTRICAL",
  "BODYWORK",
  "INSURANCE_REPAIR",
  "OTHER",
] as const;

export const EXPENSE_CATEGORIES = [
  "FUEL",
  "REPAIR_MAINTENANCE",
  "INSURANCE",
  "ROAD_TAX_PERMIT",
  "TOLL",
  "PARKING",
  "DRIVER_ALLOWANCE",
  "OTHER",
] as const;

// 1. Vehicle Schemas
export const createVehicleSchema = z.object({
  vehicleNumber: z
    .string()
    .min(5, "Vehicle registration number must be at least 5 characters")
    .transform((val) => val.toUpperCase().trim()),
  category: z.enum(VEHICLE_CATEGORIES).default("TRUCK"),
  make: z.string().min(2, "Make is required"),
  model: z.string().min(1, "Model is required"),
  variant: z.string().optional().nullable(),
  fuelType: z.enum(FUEL_TYPES).default("DIESEL"),
  chassisNumber: z.string().optional().nullable(),
  engineNumber: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseValue: z.coerce.number().min(0).optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  insuranceStartDate: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  fitnessExpiryDate: z.string().optional().nullable(),
  pollutionExpiryDate: z.string().optional().nullable(),
  permitExpiryDate: z.string().optional().nullable(),
  rcDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  insuranceDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  permitDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  branchId: z.string().uuid().optional().nullable().or(z.literal("")),
  defaultDriverId: z.string().uuid().optional().nullable().or(z.literal("")),
  currentOdometer: z.coerce.number().min(0).default(0),
  status: z.enum(VEHICLE_STATUSES).default("ACTIVE"),
  notes: z.string().optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

// 2. Driver Schemas
export const createDriverSchema = z.object({
  driverCode: z.string().optional(),
  name: z.string().min(2, "Driver name is required"),
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  licenseNumber: z
    .string()
    .min(6, "Valid driving licence number is required")
    .transform((val) => val.toUpperCase().trim()),
  licenseClass: z.string().optional().nullable(),
  licenseExpiryDate: z.string().min(4, "Licence expiry date is required"),
  joiningDate: z.string().optional().nullable(),
  assignedVehicleId: z.string().uuid().optional().nullable().or(z.literal("")),
  salaryType: z.enum(["MONTHLY", "DAILY", "TRIP_BASED"]).default("MONTHLY"),
  salaryAmount: z.coerce.number().min(0).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  licenseDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  idDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

export const updateDriverSchema = createDriverSchema.partial();

// 3. Vehicle Trip Schemas
export const createVehicleTripSchema = z.object({
  tripNumber: z.string().optional(),
  vehicleId: z.string().uuid("Vehicle is required"),
  driverId: z.string().uuid().optional().nullable().or(z.literal("")),
  originWarehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
  originAddress: z.string().optional().nullable(),
  destinationSiteId: z.string().uuid().optional().nullable().or(z.literal("")),
  destinationAddress: z.string().optional().nullable(),
  tripDate: z.string().optional(),
  departureTime: z.string().optional().nullable(),
  startOdometer: z.coerce.number().min(0, "Start odometer is required"),
  tripPurpose: z.enum(TRIP_PURPOSES).default("DELIVERY"),
  deliveryNoteIds: z.array(z.string().uuid()).optional().default([]),
  remarks: z.string().optional().nullable(),
});

export const completeVehicleTripSchema = z.object({
  endOdometer: z.coerce.number().min(0, "Ending odometer is required"),
  arrivalTime: z.string().optional().nullable(),
  fuelUsedLitres: z.coerce.number().min(0).optional().nullable(),
  tripExpenses: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

// 4. Fuel Log Schema
export const createVehicleFuelLogSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  driverId: z.string().uuid().optional().nullable().or(z.literal("")),
  fuelDate: z.string().optional(),
  fuelType: z.enum(FUEL_TYPES).default("DIESEL"),
  fuelStation: z.string().optional().nullable(),
  quantityLitres: z.coerce.number().positive("Quantity must be greater than 0"),
  pricePerUnit: z.coerce.number().positive("Price per unit must be greater than 0"),
  odometerReading: z.coerce.number().min(0, "Odometer reading is required"),
  isFullTank: z.boolean().default(true),
  receiptDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
  paidFromAccountId: z.string().uuid().optional().nullable(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("CASH"),
});

// 5. Vehicle Maintenance Schema
export const createVehicleMaintenanceSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  serviceCategory: z.enum(SERVICE_CATEGORIES).default("REGULAR_SERVICE"),
  serviceDate: z.string().optional(),
  odometerReading: z.coerce.number().min(0, "Odometer reading is required"),
  serviceProvider: z.string().optional().nullable(),
  descriptionOfWork: z.string().min(3, "Description of work is required"),
  partsCost: z.coerce.number().min(0).default(0),
  labourCost: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  invoiceDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  nextServiceDate: z.string().optional().nullable(),
  nextServiceOdometer: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
  postToAccounts: z.boolean().default(true),
  paidFromAccountId: z.string().uuid().optional().nullable(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("BANK_TRANSFER"),
});

// 6. Vehicle Expense Schema
export const createVehicleExpenseSchema = z.object({
  vehicleId: z.string().uuid("Vehicle is required"),
  tripId: z.string().uuid().optional().nullable().or(z.literal("")),
  expenseCategory: z.enum(EXPENSE_CATEGORIES).default("OTHER"),
  expenseDate: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  taxAmount: z.coerce.number().min(0).default(0),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]).default("CASH"),
  paymentReference: z.string().optional().nullable(),
  paidFromAccountId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  itcEligibility: z.enum(["ELIGIBLE", "INELIGIBLE_SEC_17_5", "BLOCKED"]).default("INELIGIBLE_SEC_17_5"),
  receiptDocumentUrl: z.string().url().optional().nullable().or(z.literal("")),
  description: z.string().min(3, "Description is required"),
});

