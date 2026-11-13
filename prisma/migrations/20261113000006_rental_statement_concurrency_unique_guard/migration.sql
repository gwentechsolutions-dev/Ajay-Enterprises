-- Migration 20261113000006: Rental Statement Concurrency & Unique Period Protection
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP

-- Prevent duplicate or concurrent statements for the exact same customer, site (or consolidated null), and period
CREATE UNIQUE INDEX IF NOT EXISTS "RentalStatement_unique_active_period"
ON "RentalStatement" (
  "customerId",
  COALESCE("customerSiteId", '00000000-0000-0000-0000-000000000000'::uuid),
  "periodStartDate",
  "periodEndDate"
)
WHERE "status" NOT IN ('CANCELLED');

