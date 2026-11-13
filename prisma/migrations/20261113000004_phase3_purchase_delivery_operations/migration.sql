-- Migration: 20261113000004_phase3_purchase_delivery_operations
-- Description: Phase 3 Purchase, Delivery Notes, Return Notes, Stock Transfers, Hiring Notes, Evidence & E-Way Bill
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP

-- 1. Purchase Orders & Items
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "poNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "deliveryWarehouseId" UUID NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "termsAndConditions" TEXT,
    "createdById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitRate" DECIMAL(15,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- 2. Goods Receipt Note (GRN) & Items
CREATE TABLE IF NOT EXISTS "GoodsReceiptNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" UUID,
    "supplierId" UUID NOT NULL,
    "receivingWarehouseId" UUID NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierInvoiceNumber" TEXT,
    "supplierInvoiceDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoodsReceiptNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "poItemId" UUID,
    "orderedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "receivedQty" DECIMAL(12,3) NOT NULL,
    "acceptedQty" DECIMAL(12,3) NOT NULL,
    "rejectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(15,2),
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "GoodsReceiptNoteItem_pkey" PRIMARY KEY ("id")
);

-- 3. Purchase Returns & Items
CREATE TABLE IF NOT EXISTS "PurchaseReturn" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "grnId" UUID,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseReturnItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseReturnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(15,2),
    "reason" TEXT,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- 4. Material Delivery Note (DN) & Items
CREATE TABLE IF NOT EXISTS "DeliveryNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dnNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "sourceWarehouseId" UUID NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "driverName" TEXT,
    "driverPhone" TEXT,
    "vehicleNumber" TEXT,
    "transportMode" TEXT DEFAULT 'COMPANY_VEHICLE',
    "eWayBillNumber" TEXT,
    "contactPersonId" UUID,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "receiverDesignation" TEXT,
    "receiverSignatureUrl" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "gpsAccuracy" DECIMAL(8,2),
    "photoUrl" TEXT,
    "missingEvidenceReason" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "dispatchedById" UUID,
    "dispatchedAt" TIMESTAMP(3),
    "deliveredById" UUID,
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deliveryNoteId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "dailyRate" DECIMAL(15,2),
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "DeliveryNoteItem_pkey" PRIMARY KEY ("id")
);

-- 5. Material Return Note (MRN) & Items
CREATE TABLE IF NOT EXISTS "MaterialReturnNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mrnNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "customerSiteId" UUID NOT NULL,
    "receivingWarehouseId" UUID NOT NULL,
    "referenceDeliveryNoteId" UUID,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "driverName" TEXT,
    "driverPhone" TEXT,
    "vehicleNumber" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "receiverSignatureUrl" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "photoUrl" TEXT,
    "missingEvidenceReason" TEXT,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReturnNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialReturnNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mrnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "returnedQty" DECIMAL(12,3) NOT NULL,
    "acceptedQty" DECIMAL(12,3) NOT NULL,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "missingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "MaterialReturnNoteItem_pkey" PRIMARY KEY ("id")
);

-- 6. Stock Transfer Note (STN) & Items
CREATE TABLE IF NOT EXISTS "StockTransferNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stnNumber" TEXT NOT NULL,
    "sourceWarehouseId" UUID NOT NULL,
    "destinationWarehouseId" UUID NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "eWayBillNumber" TEXT,
    "dispatchedById" UUID,
    "dispatchedAt" TIMESTAMP(3),
    "receivedById" UUID,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockTransferNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "dispatchedQty" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "shortageQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "StockTransferNoteItem_pkey" PRIMARY KEY ("id")
);

-- 7. Hiring Delivery Note (HDN) & Items
CREATE TABLE IF NOT EXISTS "HiringDeliveryNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hdnNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "receivingWarehouseId" UUID NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierReference" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringDeliveryNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HiringDeliveryNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hdnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "dailyHiringRate" DECIMAL(15,2) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "HiringDeliveryNoteItem_pkey" PRIMARY KEY ("id")
);

-- 8. Hiring Return Note (HRN) & Items
CREATE TABLE IF NOT EXISTS "HiringReturnNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hrnNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "sourceWarehouseId" UUID NOT NULL,
    "referenceHdnId" UUID,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringReturnNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HiringReturnNoteItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hrnId" UUID NOT NULL,
    "materialVariantId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,

    CONSTRAINT "HiringReturnNoteItem_pkey" PRIMARY KEY ("id")
);

-- 9. Movement Evidence & Acknowledgement
CREATE TABLE IF NOT EXISTS "MovementEvidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentType" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "deliveryNoteId" UUID,
    "returnNoteId" UUID,
    "transferNoteId" UUID,
    "photoUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileChecksum" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "gpsAccuracy" DECIMAL(8,2),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" UUID,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "receiverDesignation" TEXT,
    "receiverSignatureUrl" TEXT,
    "missingEvidenceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementEvidence_pkey" PRIMARY KEY ("id")
);

-- 10. E-Way Bill Integration (FYN Gateway)
CREATE TABLE IF NOT EXISTS "EWayBill" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ewbNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "deliveryNoteId" UUID,
    "transferNoteId" UUID,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "vehicleNumber" TEXT,
    "fromPincode" TEXT,
    "toPincode" TEXT,
    "distanceKm" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "fynReferenceId" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id")
);

-- Unique & Lookup Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_branchId_idx" ON "PurchaseOrder"("branchId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_deliveryWarehouseId_idx" ON "PurchaseOrder"("deliveryWarehouseId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_materialVariantId_idx" ON "PurchaseOrderItem"("materialVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceiptNote_grnNumber_key" ON "GoodsReceiptNote"("grnNumber");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_grnNumber_idx" ON "GoodsReceiptNote"("grnNumber");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_purchaseOrderId_idx" ON "GoodsReceiptNote"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_supplierId_idx" ON "GoodsReceiptNote"("supplierId");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_receivingWarehouseId_idx" ON "GoodsReceiptNote"("receivingWarehouseId");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_status_idx" ON "GoodsReceiptNote"("status");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_receiptDate_idx" ON "GoodsReceiptNote"("receiptDate");

CREATE INDEX IF NOT EXISTS "GoodsReceiptNoteItem_grnId_idx" ON "GoodsReceiptNoteItem"("grnId");
CREATE INDEX IF NOT EXISTS "GoodsReceiptNoteItem_materialVariantId_idx" ON "GoodsReceiptNoteItem"("materialVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseReturn_prNumber_key" ON "PurchaseReturn"("prNumber");
CREATE INDEX IF NOT EXISTS "PurchaseReturn_prNumber_idx" ON "PurchaseReturn"("prNumber");
CREATE INDEX IF NOT EXISTS "PurchaseReturn_supplierId_idx" ON "PurchaseReturn"("supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseReturn_warehouseId_idx" ON "PurchaseReturn"("warehouseId");
CREATE INDEX IF NOT EXISTS "PurchaseReturn_status_idx" ON "PurchaseReturn"("status");

CREATE INDEX IF NOT EXISTS "PurchaseReturnItem_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseReturnId");
CREATE INDEX IF NOT EXISTS "PurchaseReturnItem_materialVariantId_idx" ON "PurchaseReturnItem"("materialVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryNote_dnNumber_key" ON "DeliveryNote"("dnNumber");
CREATE INDEX IF NOT EXISTS "DeliveryNote_dnNumber_idx" ON "DeliveryNote"("dnNumber");
CREATE INDEX IF NOT EXISTS "DeliveryNote_customerId_idx" ON "DeliveryNote"("customerId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_customerSiteId_idx" ON "DeliveryNote"("customerSiteId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_sourceWarehouseId_idx" ON "DeliveryNote"("sourceWarehouseId");
CREATE INDEX IF NOT EXISTS "DeliveryNote_status_idx" ON "DeliveryNote"("status");
CREATE INDEX IF NOT EXISTS "DeliveryNote_deliveryDate_idx" ON "DeliveryNote"("deliveryDate");

CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_deliveryNoteId_idx" ON "DeliveryNoteItem"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_materialVariantId_idx" ON "DeliveryNoteItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "DeliveryNoteItem_ownershipType_idx" ON "DeliveryNoteItem"("ownershipType");

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialReturnNote_mrnNumber_key" ON "MaterialReturnNote"("mrnNumber");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_mrnNumber_idx" ON "MaterialReturnNote"("mrnNumber");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_customerId_idx" ON "MaterialReturnNote"("customerId");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_customerSiteId_idx" ON "MaterialReturnNote"("customerSiteId");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_receivingWarehouseId_idx" ON "MaterialReturnNote"("receivingWarehouseId");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_status_idx" ON "MaterialReturnNote"("status");
CREATE INDEX IF NOT EXISTS "MaterialReturnNote_returnDate_idx" ON "MaterialReturnNote"("returnDate");

CREATE INDEX IF NOT EXISTS "MaterialReturnNoteItem_mrnId_idx" ON "MaterialReturnNoteItem"("mrnId");
CREATE INDEX IF NOT EXISTS "MaterialReturnNoteItem_materialVariantId_idx" ON "MaterialReturnNoteItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "MaterialReturnNoteItem_ownershipType_idx" ON "MaterialReturnNoteItem"("ownershipType");

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransferNote_stnNumber_key" ON "StockTransferNote"("stnNumber");
CREATE INDEX IF NOT EXISTS "StockTransferNote_stnNumber_idx" ON "StockTransferNote"("stnNumber");
CREATE INDEX IF NOT EXISTS "StockTransferNote_sourceWarehouseId_idx" ON "StockTransferNote"("sourceWarehouseId");
CREATE INDEX IF NOT EXISTS "StockTransferNote_destinationWarehouseId_idx" ON "StockTransferNote"("destinationWarehouseId");
CREATE INDEX IF NOT EXISTS "StockTransferNote_status_idx" ON "StockTransferNote"("status");
CREATE INDEX IF NOT EXISTS "StockTransferNote_transferDate_idx" ON "StockTransferNote"("transferDate");

CREATE INDEX IF NOT EXISTS "StockTransferNoteItem_stnId_idx" ON "StockTransferNoteItem"("stnId");
CREATE INDEX IF NOT EXISTS "StockTransferNoteItem_materialVariantId_idx" ON "StockTransferNoteItem"("materialVariantId");
CREATE INDEX IF NOT EXISTS "StockTransferNoteItem_ownershipType_idx" ON "StockTransferNoteItem"("ownershipType");

CREATE UNIQUE INDEX IF NOT EXISTS "HiringDeliveryNote_hdnNumber_key" ON "HiringDeliveryNote"("hdnNumber");
CREATE INDEX IF NOT EXISTS "HiringDeliveryNote_hdnNumber_idx" ON "HiringDeliveryNote"("hdnNumber");
CREATE INDEX IF NOT EXISTS "HiringDeliveryNote_supplierId_idx" ON "HiringDeliveryNote"("supplierId");
CREATE INDEX IF NOT EXISTS "HiringDeliveryNote_receivingWarehouseId_idx" ON "HiringDeliveryNote"("receivingWarehouseId");
CREATE INDEX IF NOT EXISTS "HiringDeliveryNote_status_idx" ON "HiringDeliveryNote"("status");

CREATE INDEX IF NOT EXISTS "HiringDeliveryNoteItem_hdnId_idx" ON "HiringDeliveryNoteItem"("hdnId");
CREATE INDEX IF NOT EXISTS "HiringDeliveryNoteItem_materialVariantId_idx" ON "HiringDeliveryNoteItem"("materialVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "HiringReturnNote_hrnNumber_key" ON "HiringReturnNote"("hrnNumber");
CREATE INDEX IF NOT EXISTS "HiringReturnNote_hrnNumber_idx" ON "HiringReturnNote"("hrnNumber");
CREATE INDEX IF NOT EXISTS "HiringReturnNote_supplierId_idx" ON "HiringReturnNote"("supplierId");
CREATE INDEX IF NOT EXISTS "HiringReturnNote_sourceWarehouseId_idx" ON "HiringReturnNote"("sourceWarehouseId");
CREATE INDEX IF NOT EXISTS "HiringReturnNote_status_idx" ON "HiringReturnNote"("status");

CREATE INDEX IF NOT EXISTS "HiringReturnNoteItem_hrnId_idx" ON "HiringReturnNoteItem"("hrnId");
CREATE INDEX IF NOT EXISTS "HiringReturnNoteItem_materialVariantId_idx" ON "HiringReturnNoteItem"("materialVariantId");

CREATE INDEX IF NOT EXISTS "MovementEvidence_documentType_documentId_idx" ON "MovementEvidence"("documentType", "documentId");
CREATE INDEX IF NOT EXISTS "MovementEvidence_deliveryNoteId_idx" ON "MovementEvidence"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "MovementEvidence_returnNoteId_idx" ON "MovementEvidence"("returnNoteId");
CREATE INDEX IF NOT EXISTS "MovementEvidence_transferNoteId_idx" ON "MovementEvidence"("transferNoteId");

CREATE UNIQUE INDEX IF NOT EXISTS "EWayBill_ewbNumber_key" ON "EWayBill"("ewbNumber");
CREATE INDEX IF NOT EXISTS "EWayBill_ewbNumber_idx" ON "EWayBill"("ewbNumber");
CREATE INDEX IF NOT EXISTS "EWayBill_documentType_documentId_idx" ON "EWayBill"("documentType", "documentId");
CREATE INDEX IF NOT EXISTS "EWayBill_deliveryNoteId_idx" ON "EWayBill"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "EWayBill_transferNoteId_idx" ON "EWayBill"("transferNoteId");
CREATE INDEX IF NOT EXISTS "EWayBill_status_idx" ON "EWayBill"("status");

-- Foreign Key Constraints (Idempotent block)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_supplierId_fkey') THEN
        ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_branchId_fkey') THEN
        ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_deliveryWarehouseId_fkey') THEN
        ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_deliveryWarehouseId_fkey" FOREIGN KEY ("deliveryWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_purchaseOrderId_fkey') THEN
        ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_materialVariantId_fkey') THEN
        ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptNote_purchaseOrderId_fkey') THEN
        ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptNote_supplierId_fkey') THEN
        ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptNote_receivingWarehouseId_fkey') THEN
        ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_receivingWarehouseId_fkey" FOREIGN KEY ("receivingWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptNoteItem_grnId_fkey') THEN
        ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReturn_supplierId_fkey') THEN
        ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReturn_warehouseId_fkey') THEN
        ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReturn_grnId_fkey') THEN
        ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReturnItem_purchaseReturnId_fkey') THEN
        ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseReturnItem_materialVariantId_fkey') THEN
        ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNote_customerId_fkey') THEN
        ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNote_customerSiteId_fkey') THEN
        ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNote_sourceWarehouseId_fkey') THEN
        ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNote_contactPersonId_fkey') THEN
        ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "ContactPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNoteItem_deliveryNoteId_fkey') THEN
        ALTER TABLE "DeliveryNoteItem" ADD CONSTRAINT "DeliveryNoteItem_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "DeliveryNoteItem" ADD CONSTRAINT "DeliveryNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNote_customerId_fkey') THEN
        ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNote_customerSiteId_fkey') THEN
        ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_customerSiteId_fkey" FOREIGN KEY ("customerSiteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNote_receivingWarehouseId_fkey') THEN
        ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_receivingWarehouseId_fkey" FOREIGN KEY ("receivingWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNote_referenceDeliveryNoteId_fkey') THEN
        ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_referenceDeliveryNoteId_fkey" FOREIGN KEY ("referenceDeliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNoteItem_mrnId_fkey') THEN
        ALTER TABLE "MaterialReturnNoteItem" ADD CONSTRAINT "MaterialReturnNoteItem_mrnId_fkey" FOREIGN KEY ("mrnId") REFERENCES "MaterialReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialReturnNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "MaterialReturnNoteItem" ADD CONSTRAINT "MaterialReturnNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferNote_sourceWarehouseId_fkey') THEN
        ALTER TABLE "StockTransferNote" ADD CONSTRAINT "StockTransferNote_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferNote_destinationWarehouseId_fkey') THEN
        ALTER TABLE "StockTransferNote" ADD CONSTRAINT "StockTransferNote_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferNoteItem_stnId_fkey') THEN
        ALTER TABLE "StockTransferNoteItem" ADD CONSTRAINT "StockTransferNoteItem_stnId_fkey" FOREIGN KEY ("stnId") REFERENCES "StockTransferNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "StockTransferNoteItem" ADD CONSTRAINT "StockTransferNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringDeliveryNote_supplierId_fkey') THEN
        ALTER TABLE "HiringDeliveryNote" ADD CONSTRAINT "HiringDeliveryNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringDeliveryNote_receivingWarehouseId_fkey') THEN
        ALTER TABLE "HiringDeliveryNote" ADD CONSTRAINT "HiringDeliveryNote_receivingWarehouseId_fkey" FOREIGN KEY ("receivingWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringDeliveryNoteItem_hdnId_fkey') THEN
        ALTER TABLE "HiringDeliveryNoteItem" ADD CONSTRAINT "HiringDeliveryNoteItem_hdnId_fkey" FOREIGN KEY ("hdnId") REFERENCES "HiringDeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringDeliveryNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "HiringDeliveryNoteItem" ADD CONSTRAINT "HiringDeliveryNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringReturnNote_supplierId_fkey') THEN
        ALTER TABLE "HiringReturnNote" ADD CONSTRAINT "HiringReturnNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringReturnNote_sourceWarehouseId_fkey') THEN
        ALTER TABLE "HiringReturnNote" ADD CONSTRAINT "HiringReturnNote_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringReturnNote_referenceHdnId_fkey') THEN
        ALTER TABLE "HiringReturnNote" ADD CONSTRAINT "HiringReturnNote_referenceHdnId_fkey" FOREIGN KEY ("referenceHdnId") REFERENCES "HiringDeliveryNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringReturnNoteItem_hrnId_fkey') THEN
        ALTER TABLE "HiringReturnNoteItem" ADD CONSTRAINT "HiringReturnNoteItem_hrnId_fkey" FOREIGN KEY ("hrnId") REFERENCES "HiringReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HiringReturnNoteItem_materialVariantId_fkey') THEN
        ALTER TABLE "HiringReturnNoteItem" ADD CONSTRAINT "HiringReturnNoteItem_materialVariantId_fkey" FOREIGN KEY ("materialVariantId") REFERENCES "MaterialVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MovementEvidence_deliveryNoteId_fkey') THEN
        ALTER TABLE "MovementEvidence" ADD CONSTRAINT "MovementEvidence_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MovementEvidence_returnNoteId_fkey') THEN
        ALTER TABLE "MovementEvidence" ADD CONSTRAINT "MovementEvidence_returnNoteId_fkey" FOREIGN KEY ("returnNoteId") REFERENCES "MaterialReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MovementEvidence_transferNoteId_fkey') THEN
        ALTER TABLE "MovementEvidence" ADD CONSTRAINT "MovementEvidence_transferNoteId_fkey" FOREIGN KEY ("transferNoteId") REFERENCES "StockTransferNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EWayBill_deliveryNoteId_fkey') THEN
        ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EWayBill_transferNoteId_fkey') THEN
        ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_transferNoteId_fkey" FOREIGN KEY ("transferNoteId") REFERENCES "StockTransferNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Enable Row Level Security (RLS) on all Phase 3 tables
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoodsReceiptNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoodsReceiptNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReturn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReturnItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialReturnNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialReturnNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockTransferNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockTransferNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HiringDeliveryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HiringDeliveryNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HiringReturnNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HiringReturnNoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MovementEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EWayBill" ENABLE ROW LEVEL SECURITY;

