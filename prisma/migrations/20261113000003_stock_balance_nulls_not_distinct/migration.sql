-- Migration: 20261113000003_stock_balance_nulls_not_distinct
-- Description: Enforce NULLS NOT DISTINCT on StockBalance unique location index
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP

DROP INDEX IF EXISTS "StockBalance_warehouseId_siteId_materialVariantId_ownership_key";

CREATE UNIQUE INDEX "StockBalance_warehouseId_siteId_materialVariantId_ownership_key"
ON "StockBalance"("warehouseId", "siteId", "materialVariantId", "ownershipType", "locationType")
NULLS NOT DISTINCT;
