-- ==============================================================================
-- INVENTRA - PostgreSQL Migration 02: Phase 2 Master Data & Inventory Management
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
-- Target: Supabase Managed PostgreSQL with PostGIS
-- ==============================================================================

-- 1. Extend Warehouse with Storage Capacity
ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "storageCapacitySqFt" DECIMAL(12,2);

-- 2. Material Master Management (Hierarchical Catalogue)
CREATE TABLE IF NOT EXISTS "MaterialCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" UUID NOT NULL,
    "typeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialVariant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "materialCode" TEXT NOT NULL,
    "materialTypeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "description" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'Nos.',
    "defaultRentalRate" DECIMAL(15,2) NOT NULL,
    "purchaseCost" DECIMAL(15,2),
    "replacementValue" DECIMAL(15,2),
    "minimumStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "preferredSupplierId" UUID,
    "ownershipClassification" TEXT NOT NULL DEFAULT 'OWNED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialRateHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "materialVariantId" UUID NOT NULL,
    "rentalRate" DECIMAL(15,2) NOT NULL,
    "previousRate" DECIMAL(15,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRateHistory_pkey" PRIMARY KEY ("id")
);

-- 3. Customer Master & Multi-Site Construction Management
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" TEXT NOT NULL DEFAULT 'COMPANY',
    "legalBusinessName" TEXT,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "pan" TEXT,
    "gstStatus" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "gstin" TEXT,
    "billingAddress" TEXT NOT NULL,
    "communicationAddress" TEXT,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pinCode" TEXT,
    "businessType" TEXT,
    "creditLimit" DECIMAL(15,2),
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerSite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "siteCode" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "siteName" TEXT NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "siteOwnerName" TEXT,
    "siteOwnerContact" TEXT,
    "siteInCharge" TEXT,
    "siteContactDetails" TEXT,
    "projectType" TEXT,
    "deliveryInstructions" TEXT,
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedClosingDate" TIMESTAMP(3),
    "actualClosingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "internalRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContactPerson" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID,
    "siteId" UUID,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "designation" TEXT NOT NULL,
    "contactType" TEXT NOT NULL DEFAULT 'SITE_INCHARGE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveDeliveryNotes" BOOLEAN NOT NULL DEFAULT true,
    "canAcknowledgeDeliveries" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveReturnNotes" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveInvoices" BOOLEAN NOT NULL DEFAULT false,
    "canReceivePaymentReminders" BOOLEAN NOT NULL DEFAULT false,
    "canReceiveWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL,
    "siteId" UUID,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- 4. Supplier Master
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "gstStatus" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "gstin" TEXT,
    "pan" TEXT,
    "billingAddress" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "supplierType" TEXT NOT NULL DEFAULT 'MANUFACTURER',
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creditTermsDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "internalRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplierId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- 5. Inventory Movement Ledger & Stock Balances
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movementNumber" TEXT NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'Nos.',
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "movementType" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceLocationType" TEXT NOT NULL,
    "sourceWarehouseId" UUID,
    "sourceSiteId" UUID,
    "destinationLocationType" TEXT NOT NULL,
    "destinationWarehouseId" UUID,
    "destinationSiteId" UUID,
    "customerId" UUID,
    "supplierId" UUID,
    "referenceDocumentType" TEXT,
    "referenceDocumentId" TEXT,
    "batchOrLotNumber" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "unitCost" DECIMAL(15,2),
    "replacementValue" DECIMAL(15,2),
    "responsibleUserId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "reversedMovementId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockBalance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouseId" UUID,
    "siteId" UUID,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "locationType" TEXT NOT NULL,
    "availableQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "maintenanceQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "missingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- 6. Physical Stock Verification & Reconciliation
CREATE TABLE IF NOT EXISTS "StockAudit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditNumber" TEXT NOT NULL,
    "warehouseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "conductedById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockAuditItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockAuditId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "expectedQty" DECIMAL(12,3) NOT NULL,
    "physicalQty" DECIMAL(12,3) NOT NULL,
    "differenceQty" DECIMAL(12,3) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "adjustmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "adjustmentMovementId" UUID,
    "remarks" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAuditItem_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialCategory_categoryCode_key" ON "MaterialCategory"("categoryCode");
CREATE INDEX IF NOT EXISTS "MaterialCategory_categoryCode_idx" ON "MaterialCategory"("categoryCode");

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialType_typeCode_key" ON "MaterialType"("typeCode");
CREATE INDEX IF NOT EXISTS "MaterialType_typeCode_idx" ON "MaterialType"("typeCode");
CREATE INDEX IF NOT EXISTS "MaterialType_categoryId_idx" ON "MaterialType"("categoryId");

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialVariant_materialCode_key" ON "MaterialVariant"("materialCode");
CREATE INDEX IF NOT EXISTS "MaterialVariant_materialCode_idx" ON "MaterialVariant"("materialCode");
CREATE INDEX IF NOT EXISTS "MaterialVariant_materialTypeId_idx" ON "MaterialVariant"("materialTypeId");
CREATE INDEX IF NOT EXISTS "MaterialVariant_ownershipClassification_idx" ON "MaterialVariant"("ownershipClassification");

CREATE INDEX IF NOT EXISTS "MaterialRateHistory_materialVariantId_idx" ON "MaterialRateHistory"("materialVariantId");
CREATE INDEX IF NOT EXISTS "MaterialRateHistory_effectiveFrom_idx" ON "MaterialRateHistory"("effectiveFrom");

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_customerCode_key" ON "Customer"("customerCode");
CREATE INDEX IF NOT EXISTS "Customer_customerCode_idx" ON "Customer"("customerCode");
CREATE INDEX IF NOT EXISTS "Customer_primaryMobile_idx" ON "Customer"("primaryMobile");
CREATE INDEX IF NOT EXISTS "Customer_pan_idx" ON "Customer"("pan");
CREATE INDEX IF NOT EXISTS "Customer_gstin_idx" ON "Customer"("gstin");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSite_siteCode_key" ON "CustomerSite"("siteCode");
CREATE INDEX IF NOT EXISTS "CustomerSite_siteCode_idx" ON "CustomerSite"("siteCode");
CREATE INDEX IF NOT EXISTS "CustomerSite_customerId_idx" ON "CustomerSite"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerSite_status_idx" ON "CustomerSite"("status");

CREATE INDEX IF NOT EXISTS "ContactPerson_customerId_idx" ON "ContactPerson"("customerId");
CREATE INDEX IF NOT EXISTS "ContactPerson_siteId_idx" ON "ContactPerson"("siteId");
CREATE INDEX IF NOT EXISTS "ContactPerson_mobile_idx" ON "ContactPerson"("mobile");

CREATE INDEX IF NOT EXISTS "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerDocument_siteId_idx" ON "CustomerDocument"("siteId");

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
CREATE INDEX IF NOT EXISTS "Supplier_supplierCode_idx" ON "Supplier"("supplierCode");
CREATE INDEX IF NOT EXISTS "Supplier_primaryMobile_idx" ON "Supplier"("primaryMobile");
CREATE INDEX IF NOT EXISTS "Supplier_gstin_idx" ON "Supplier"("gstin");

CREATE INDEX IF NOT EXISTS "SupplierDocument_supplierId_idx" ON "SupplierDocument"("supplierId");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovement_movementNumber_key" ON "InventoryMovement"("movementNumber");
CREATE INDEX IF NOT EXISTS "InventoryMovement_movementNumber_idx" ON "InventoryMovement"("movementNumber");
CREATE INDEX IF NOT EXISTS "InventoryMovement_materialVariantId_idx" ON "InventoryMovement"("materialVariantId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");
CREATE INDEX IF NOT EXISTS "InventoryMovement_ownershipType_idx" ON "InventoryMovement"("ownershipType");
CREATE INDEX IF NOT EXISTS "InventoryMovement_movementDate_idx" ON "InventoryMovement"("movementDate");
CREATE INDEX IF NOT EXISTS "InventoryMovement_sourceWarehouseId_idx" ON "InventoryMovement"("sourceWarehouseId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_destinationWarehouseId_idx" ON "InventoryMovement"("destinationWarehouseId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_sourceSiteId_idx" ON "InventoryMovement"("sourceSiteId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_destinationSiteId_idx" ON "InventoryMovement"("destinationSiteId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_customerId_idx" ON "InventoryMovement"("customerId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_status_idx" ON "InventoryMovement"("status");

CREATE INDEX IF NOT EXISTS "StockBalance_warehouseId_idx" ON "StockBalance"("warehouseId");
CREATE INDEX IF NOT EXISTS "StockBalance_siteId_idx" ON "StockBalance"("siteId");
CREATE INDEX IF NOT EXISTS "StockBalance_materialVariantId_idx" ON "StockBalance"("materialVariantId");
CREATE INDEX IF NOT EXISTS "StockBalance_ownershipType_idx" ON "StockBalance"("ownershipType");
CREATE INDEX IF NOT EXISTS "StockBalance_locationType_idx" ON "StockBalance"("locationType");
CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_warehouseId_siteId_materialVariantId_ownership_key" ON "StockBalance"("warehouseId", "siteId", "materialVariantId", "ownershipType", "locationType");

CREATE UNIQUE INDEX IF NOT EXISTS "StockAudit_auditNumber_key" ON "StockAudit"("auditNumber");
CREATE INDEX IF NOT EXISTS "StockAudit_auditNumber_idx" ON "StockAudit"("auditNumber");
CREATE INDEX IF NOT EXISTS "StockAudit_warehouseId_idx" ON "StockAudit"("warehouseId");
CREATE INDEX IF NOT EXISTS "StockAudit_status_idx" ON "StockAudit"("status");

CREATE INDEX IF NOT EXISTS "StockAuditItem_stockAuditId_idx" ON "StockAuditItem"("stockAuditId");
CREATE INDEX IF NOT EXISTS "StockAuditItem_materialVariantId_idx" ON "StockAuditItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "StockAuditItem_adjustmentStatus_idx" ON "StockAuditItem"("adjustmentStatus");

-- ------------------------------------------------------------------------------
-- Foreign Key Constraints
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialType_categoryId_fkey') THEN
        ALTER TABLE "MaterialType" ADD CONSTRAINT "MaterialType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialVariant_materialTypeId_fkey') THEN
        ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialVariant_preferredSupplierId_fkey') THEN
        ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRateHistory_materialVariantId_fkey') THEN
        ALTER TABLE "MaterialRateHistory" ADD CONSTRAINT "MaterialRateHistory_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRateHistory_changedById_fkey') THEN
        ALTER TABLE "MaterialRateHistory" ADD CONSTRAINT "MaterialRateHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerSite_customerId_fkey') THEN
        ALTER TABLE "CustomerSite" ADD CONSTRAINT "CustomerSite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactPerson_customerId_fkey') THEN
        ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactPerson_siteId_fkey') THEN
        ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_customerId_fkey') THEN
        ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_siteId_fkey') THEN
        ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierDocument_supplierId_fkey') THEN
        ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_materialVariantId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_sourceWarehouseId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_destinationWarehouseId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_sourceSiteId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sourceSiteId_fkey" FOREIGN KEY ("sourceSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_destinationSiteId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_destinationSiteId_fkey" FOREIGN KEY ("destinationSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_customerId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_supplierId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_responsibleUserId_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_approvedById_fkey') THEN
        ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_warehouseId_fkey') THEN
        ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_siteId_fkey') THEN
        ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_materialVariantId_fkey') THEN
        ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAudit_warehouseId_fkey') THEN
        ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAudit_conductedById_fkey') THEN
        ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAudit_approvedById_fkey') THEN
        ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAuditItem_stockAuditId_fkey') THEN
        ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_stockAuditId_fkey" FOREIGN KEY ("stockAuditId") REFERENCES "StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAuditItem_materialVariantId_fkey') THEN
        ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Enable Row Level Security (RLS) on all 14 Phase 2 tables (Zero-Trust Security)
-- ------------------------------------------------------------------------------

ALTER TABLE "MaterialCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialRateHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerSite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockAuditItem" ENABLE ROW LEVEL SECURITY;
