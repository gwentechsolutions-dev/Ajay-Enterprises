-- AlterTable
ALTER TABLE "AccountingPeriod" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BankTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChartOfAccount" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditDebitNote" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditDebitNoteItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinancialYearClosing" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HsnSacMaster" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JournalEntryLine" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentAllocation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentReceipt" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseBill" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseBillItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupplierPayment" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupplierPaymentAllocation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TaxRateMaster" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TRUCK',
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "chassisNumber" TEXT,
    "engineNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseValue" DECIMAL(15,2),
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "insuranceStartDate" TIMESTAMP(3),
    "insuranceExpiryDate" TIMESTAMP(3),
    "fitnessExpiryDate" TIMESTAMP(3),
    "pollutionExpiryDate" TIMESTAMP(3),
    "permitExpiryDate" TIMESTAMP(3),
    "rcDocumentUrl" TEXT,
    "insuranceDocumentUrl" TEXT,
    "permitDocumentUrl" TEXT,
    "photoUrl" TEXT,
    "branchId" UUID,
    "defaultDriverId" UUID,
    "currentOdometer" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" UUID NOT NULL,
    "driverCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "address" TEXT,
    "emergencyContact" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "licenseClass" TEXT,
    "licenseExpiryDate" TIMESTAMP(3) NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedVehicleId" UUID,
    "salaryType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "salaryAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "licenseDocumentUrl" TEXT,
    "idDocumentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverVehicleAssignment" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "assignedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedTo" TIMESTAMP(3),
    "reason" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverVehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTrip" (
    "id" UUID NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "originWarehouseId" UUID,
    "originAddress" TEXT,
    "destinationSiteId" UUID,
    "destinationAddress" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departureTime" TIMESTAMP(3),
    "arrivalTime" TIMESTAMP(3),
    "startOdometer" DECIMAL(10,2) NOT NULL,
    "endOdometer" DECIMAL(10,2),
    "distanceKm" DECIMAL(10,2),
    "tripPurpose" TEXT NOT NULL DEFAULT 'DELIVERY',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "fuelUsedLitres" DECIMAL(8,2),
    "tripExpenses" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleTripDeliveryNote" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "deliveryNoteId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleTripDeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleFuelLog" (
    "id" UUID NOT NULL,
    "logNumber" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "fuelDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "fuelStation" TEXT,
    "quantityLitres" DECIMAL(10,2) NOT NULL,
    "pricePerUnit" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(15,2) NOT NULL,
    "odometerReading" DECIMAL(10,2) NOT NULL,
    "isFullTank" BOOLEAN NOT NULL DEFAULT true,
    "distanceSinceLast" DECIMAL(10,2),
    "mileageKmPerLitre" DECIMAL(8,2),
    "costPerKm" DECIMAL(10,2),
    "receiptDocumentUrl" TEXT,
    "remarks" TEXT,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleFuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenanceRecord" (
    "id" UUID NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "serviceCategory" TEXT NOT NULL DEFAULT 'REGULAR_SERVICE',
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometerReading" DECIMAL(10,2) NOT NULL,
    "serviceProvider" TEXT,
    "descriptionOfWork" TEXT NOT NULL,
    "partsCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "invoiceDocumentUrl" TEXT,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceOdometer" DECIMAL(10,2),
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleExpense" (
    "id" UUID NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "tripId" UUID,
    "expenseCategory" TEXT NOT NULL DEFAULT 'OTHER',
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "paymentReference" TEXT,
    "paidFromAccountId" UUID,
    "supplierId" UUID,
    "itcEligibility" TEXT NOT NULL DEFAULT 'INELIGIBLE_SEC_17_5',
    "receiptDocumentUrl" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "journalEntryId" UUID,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourWorker" (
    "id" UUID NOT NULL,
    "workerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "address" TEXT,
    "emergencyContact" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL_LABOUR',
    "skillTrade" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wageType" TEXT NOT NULL DEFAULT 'DAILY',
    "dailyWage" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "monthlySalary" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "assignedSupervisorId" UUID,
    "branchId" UUID,
    "idDocumentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourAttendance" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "branchId" UUID,
    "customerSiteId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "overtimeHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "supervisorRemarks" TEXT,
    "recordedById" UUID,
    "approvedById" UUID,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourAdvance" (
    "id" UUID NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "workerId" UUID NOT NULL,
    "advanceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "paymentReference" TEXT,
    "paidFromAccountId" UUID,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "recoveredAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(15,2) NOT NULL,
    "approvedById" UUID,
    "journalEntryId" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourWageSettlement" (
    "id" UUID NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "workerId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "daysPresent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "halfDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "daysLeave" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "baseWageAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "overtimeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advanceDeduction" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourWageSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourPayment" (
    "id" UUID NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "workerId" UUID NOT NULL,
    "wageSettlementId" UUID,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "paymentReference" TEXT,
    "paidFromAccountId" UUID,
    "receiptDocumentUrl" TEXT,
    "journalEntryId" UUID,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRepairJob" (
    "id" UUID NOT NULL,
    "jobCode" TEXT NOT NULL,
    "warehouseId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "mrnId" UUID,
    "rentalBatchId" UUID,
    "totalQuantity" DECIMAL(12,3) NOT NULL,
    "repairedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrappedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "remainingQuantity" DECIMAL(12,3) NOT NULL,
    "damageDescription" TEXT NOT NULL,
    "damagePhotoUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedTechnicianId" UUID,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "partsCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "externalVendorCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "repairVendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "qualityApprovedById" UUID,
    "qualityApprovedAt" TIMESTAMP(3),
    "journalEntryId" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRepairJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRepairLog" (
    "id" UUID NOT NULL,
    "repairJobId" UUID NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "technicianName" TEXT,
    "partsUsed" TEXT,
    "cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRepairLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_branchId_idx" ON "Vehicle"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_driverCode_key" ON "Driver"("driverCode");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_licenseNumber_key" ON "Driver"("licenseNumber");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE INDEX "Driver_mobileNumber_idx" ON "Driver"("mobileNumber");

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_driverId_idx" ON "DriverVehicleAssignment"("driverId");

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_vehicleId_idx" ON "DriverVehicleAssignment"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTrip_tripNumber_key" ON "VehicleTrip"("tripNumber");

-- CreateIndex
CREATE INDEX "VehicleTrip_vehicleId_idx" ON "VehicleTrip"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleTrip_driverId_idx" ON "VehicleTrip"("driverId");

-- CreateIndex
CREATE INDEX "VehicleTrip_status_idx" ON "VehicleTrip"("status");

-- CreateIndex
CREATE INDEX "VehicleTrip_tripDate_idx" ON "VehicleTrip"("tripDate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTripDeliveryNote_tripId_deliveryNoteId_key" ON "VehicleTripDeliveryNote"("tripId", "deliveryNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleFuelLog_logNumber_key" ON "VehicleFuelLog"("logNumber");

-- CreateIndex
CREATE INDEX "VehicleFuelLog_vehicleId_idx" ON "VehicleFuelLog"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleFuelLog_fuelDate_idx" ON "VehicleFuelLog"("fuelDate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMaintenanceRecord_recordNumber_key" ON "VehicleMaintenanceRecord"("recordNumber");

-- CreateIndex
CREATE INDEX "VehicleMaintenanceRecord_vehicleId_idx" ON "VehicleMaintenanceRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleMaintenanceRecord_serviceDate_idx" ON "VehicleMaintenanceRecord"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleExpense_expenseNumber_key" ON "VehicleExpense"("expenseNumber");

-- CreateIndex
CREATE INDEX "VehicleExpense_vehicleId_idx" ON "VehicleExpense"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleExpense_expenseDate_idx" ON "VehicleExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "VehicleExpense_status_idx" ON "VehicleExpense"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LabourWorker_workerCode_key" ON "LabourWorker"("workerCode");

-- CreateIndex
CREATE INDEX "LabourWorker_status_idx" ON "LabourWorker"("status");

-- CreateIndex
CREATE INDEX "LabourWorker_branchId_idx" ON "LabourWorker"("branchId");

-- CreateIndex
CREATE INDEX "LabourAttendance_attendanceDate_idx" ON "LabourAttendance"("attendanceDate");

-- CreateIndex
CREATE INDEX "LabourAttendance_status_idx" ON "LabourAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LabourAttendance_workerId_attendanceDate_key" ON "LabourAttendance"("workerId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "LabourAdvance_advanceNumber_key" ON "LabourAdvance"("advanceNumber");

-- CreateIndex
CREATE INDEX "LabourAdvance_workerId_idx" ON "LabourAdvance"("workerId");

-- CreateIndex
CREATE INDEX "LabourAdvance_advanceDate_idx" ON "LabourAdvance"("advanceDate");

-- CreateIndex
CREATE INDEX "LabourAdvance_status_idx" ON "LabourAdvance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LabourWageSettlement_settlementNumber_key" ON "LabourWageSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "LabourWageSettlement_workerId_idx" ON "LabourWageSettlement"("workerId");

-- CreateIndex
CREATE INDEX "LabourWageSettlement_periodStart_periodEnd_idx" ON "LabourWageSettlement"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "LabourWageSettlement_status_idx" ON "LabourWageSettlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LabourPayment_paymentNumber_key" ON "LabourPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "LabourPayment_workerId_idx" ON "LabourPayment"("workerId");

-- CreateIndex
CREATE INDEX "LabourPayment_paymentDate_idx" ON "LabourPayment"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRepairJob_jobCode_key" ON "MaterialRepairJob"("jobCode");

-- CreateIndex
CREATE INDEX "MaterialRepairJob_warehouseId_idx" ON "MaterialRepairJob"("warehouseId");

-- CreateIndex
CREATE INDEX "MaterialRepairJob_materialVariantId_idx" ON "MaterialRepairJob"("materialVariantId");

-- CreateIndex
CREATE INDEX "MaterialRepairJob_status_idx" ON "MaterialRepairJob"("status");

-- CreateIndex
CREATE INDEX "MaterialRepairJob_ownershipType_idx" ON "MaterialRepairJob"("ownershipType");

-- CreateIndex
CREATE INDEX "MaterialRepairLog_repairJobId_idx" ON "MaterialRepairLog"("repairJobId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_accountCode_idx" ON "ChartOfAccount"("accountCode");

-- CreateIndex
CREATE INDEX "CreditDebitNote_noteNumber_idx" ON "CreditDebitNote"("noteNumber");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_journalNumber_idx" ON "JournalEntry"("journalNumber");

-- CreateIndex
CREATE INDEX "PaymentReceipt_receiptNumber_idx" ON "PaymentReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "PurchaseBill_billNumber_idx" ON "PurchaseBill"("billNumber");

-- CreateIndex
CREATE INDEX "SupplierPayment_paymentNumber_idx" ON "SupplierPayment"("paymentNumber");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_originWarehouseId_fkey" FOREIGN KEY ("originWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTrip" ADD CONSTRAINT "VehicleTrip_destinationSiteId_fkey" FOREIGN KEY ("destinationSiteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTripDeliveryNote" ADD CONSTRAINT "VehicleTripDeliveryNote_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTripDeliveryNote" ADD CONSTRAINT "VehicleTripDeliveryNote_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFuelLog" ADD CONSTRAINT "VehicleFuelLog_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenanceRecord" ADD CONSTRAINT "VehicleMaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenanceRecord" ADD CONSTRAINT "VehicleMaintenanceRecord_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "VehicleTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourWorker" ADD CONSTRAINT "LabourWorker_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourAttendance" ADD CONSTRAINT "LabourAttendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "LabourWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourAttendance" ADD CONSTRAINT "LabourAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourAttendance" ADD CONSTRAINT "LabourAttendance_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourAdvance" ADD CONSTRAINT "LabourAdvance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "LabourWorker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourAdvance" ADD CONSTRAINT "LabourAdvance_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourWageSettlement" ADD CONSTRAINT "LabourWageSettlement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "LabourWorker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourWageSettlement" ADD CONSTRAINT "LabourWageSettlement_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPayment" ADD CONSTRAINT "LabourPayment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "LabourWorker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPayment" ADD CONSTRAINT "LabourPayment_wageSettlementId_fkey" FOREIGN KEY ("wageSettlementId") REFERENCES "LabourWageSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPayment" ADD CONSTRAINT "LabourPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_mrnId_fkey" FOREIGN KEY ("mrnId") REFERENCES "MaterialReturnNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_rentalBatchId_fkey" FOREIGN KEY ("rentalBatchId") REFERENCES "RentalBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "LabourWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairJob" ADD CONSTRAINT "MaterialRepairJob_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRepairLog" ADD CONSTRAINT "MaterialRepairLog_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "MaterialRepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "JournalEntry_refDoc_idx" RENAME TO "JournalEntry_referenceDocumentType_referenceDocumentId_idx";

-- RenameIndex
ALTER INDEX "PurchaseBill_supplier_invoice_key" RENAME TO "PurchaseBill_supplierId_supplierInvoiceNumber_key";
