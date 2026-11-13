-- ==============================================================================
-- INVENTRA – Production Supabase Security Policies (RLS) & Private Storage
-- Target Project: Inventra_Centering_Site (xewkpocahshdckvrzpmt)
-- Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
-- ==============================================================================
-- Architectural Directives:
-- 1. Zero-Trust Access: Direct client-side reads/writes to sensitive business 
--    tables (CompanyProfile, BankAccount, DocumentSeries, AuditEvent, etc.) are BLOCKED.
-- 2. Server-Authorized Access: All sensitive queries and mutations execute via Next.js 
--    server API routes and Server Actions using the server-side service role, which 
--    bypasses RLS by design and enforces INVENTRA RBAC in application logic.
-- 3. Storage Privacy: The 'inventra-private-documents' bucket is strictly private. 
--    No broad authenticated SELECT access. Downloads require server-authorized signed URLs.
-- 4. Audit Immutability Guards:
--    - Row-level trigger blocks UPDATE and DELETE.
--    - Statement-level trigger blocks TRUNCATE.
--    - Dangerous DML privileges revoked from public, anon, and authenticated roles.
--    - Note: Immutability is transactional and application-level; it does not protect 
--      against PostgreSQL superusers or table owners with ALTER TABLE / DDL authority.
-- 5. Non-Recursive RLS: Role and assignment lookups use STABLE SECURITY DEFINER functions 
--    to prevent infinite policy recursion between User and dependent tables.
-- 6. Granular Facility Scoping: Branch and Warehouse visibility is restricted to authorized
--    management roles or users assigned to that specific branch/warehouse.
-- 7. 100% Idempotency: All statements use IF EXISTS / IF NOT EXISTS and DROP-before-CREATE.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable Row Level Security (RLS) on all 12 core tables
-- ------------------------------------------------------------------------------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignatoryAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Drop existing policies to ensure 100% idempotent re-execution
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read own profile" ON "User";
DROP POLICY IF EXISTS "Users can read own role permissions" ON "RolePermission";
DROP POLICY IF EXISTS "Authenticated users can read permissions" ON "RolePermission";
DROP POLICY IF EXISTS "Authenticated users can read active branches" ON "Branch";
DROP POLICY IF EXISTS "Authorized users can read branches" ON "Branch";
DROP POLICY IF EXISTS "Authenticated users can read active warehouses" ON "Warehouse";
DROP POLICY IF EXISTS "Authorized users can read warehouses" ON "Warehouse";
DROP POLICY IF EXISTS "Authenticated users can read active financial years" ON "FinancialYear";

-- Clean up any legacy redundant service_role policies (service_role has BYPASSRLS)
DROP POLICY IF EXISTS "Service role full access on User" ON "User";
DROP POLICY IF EXISTS "Service role full access on RolePermission" ON "RolePermission";
DROP POLICY IF EXISTS "Service role full access on CompanyProfile" ON "CompanyProfile";
DROP POLICY IF EXISTS "Service role full access on CompanyAddress" ON "CompanyAddress";
DROP POLICY IF EXISTS "Service role full access on BankAccount" ON "BankAccount";
DROP POLICY IF EXISTS "Service role full access on CompanyDocument" ON "CompanyDocument";
DROP POLICY IF EXISTS "Service role full access on SignatoryAsset" ON "SignatoryAsset";
DROP POLICY IF EXISTS "Service role full access on Branch" ON "Branch";
DROP POLICY IF EXISTS "Service role full access on Warehouse" ON "Warehouse";
DROP POLICY IF EXISTS "Service role full access on DocumentSeries" ON "DocumentSeries";
DROP POLICY IF EXISTS "Service role full access on FinancialYear" ON "FinancialYear";
DROP POLICY IF EXISTS "Service role full access on AuditEvent" ON "AuditEvent";

-- ------------------------------------------------------------------------------
-- 3. Non-Recursive Lookup Helper Functions
-- Bypasses User RLS via SECURITY DEFINER to prevent recursive-policy evaluation loops.
-- Uses empty search_path and parameterless invocation via auth.uid().
-- ------------------------------------------------------------------------------

-- Retrieve calling user's assigned role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public."User"
    WHERE "supabaseId" = (SELECT auth.uid())
    LIMIT 1;
$$;

-- Retrieve calling user's assigned branch ID
CREATE OR REPLACE FUNCTION public.get_auth_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT "branchId" FROM public."User"
    WHERE "supabaseId" = (SELECT auth.uid())
    LIMIT 1;
$$;

-- Retrieve calling user's assigned warehouse ID
CREATE OR REPLACE FUNCTION public.get_auth_user_warehouse_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT "warehouseId" FROM public."User"
    WHERE "supabaseId" = (SELECT auth.uid())
    LIMIT 1;
$$;

-- Secure function execution privileges (authenticated only; anon/public blocked)
REVOKE EXECUTE ON FUNCTION public.get_auth_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_auth_user_branch_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_branch_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_auth_user_warehouse_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_warehouse_id() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Targeted Authenticated Client Read Policies
-- Direct client writes to ALL tables are strictly blocked (no INSERT/UPDATE/DELETE).
-- ------------------------------------------------------------------------------

-- User: Authenticated users can read ONLY their own user profile row (strict supabaseId bridge)
CREATE POLICY "Authenticated users can read own profile" ON "User"
    FOR SELECT TO authenticated
    USING ("supabaseId" = (SELECT auth.uid()));

-- RolePermission: Authenticated users can read ONLY permissions for their own assigned role
-- Uses get_auth_user_role() to guarantee zero recursion against the User table policy.
CREATE POLICY "Users can read own role permissions" ON "RolePermission"
    FOR SELECT TO authenticated
    USING ("role" = public.get_auth_user_role());

-- Branch: Authorized management roles or users assigned to that specific branch
CREATE POLICY "Authorized users can read branches" ON "Branch"
    FOR SELECT TO authenticated
    USING (
        "isActive" = true 
        AND (
            public.get_auth_user_role() IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'DELIVERY_MANAGER', 'AUDITOR')
            OR "id" = public.get_auth_user_branch_id()
        )
    );

-- Warehouse: Authorized management roles or users assigned to that specific warehouse/yard
-- Protects warehouse GPS locations and yard contact details from unauthorized staff.
CREATE POLICY "Authorized users can read warehouses" ON "Warehouse"
    FOR SELECT TO authenticated
    USING (
        "isActive" = true 
        AND (
            public.get_auth_user_role() IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'DELIVERY_MANAGER', 'AUDITOR')
            OR "id" = public.get_auth_user_warehouse_id()
        )
    );

-- FinancialYear: Authenticated users can read current and open financial years for date checks
CREATE POLICY "Authenticated users can read active financial years" ON "FinancialYear"
    FOR SELECT TO authenticated
    USING ("isCurrent" = true OR "isClosed" = false);

-- Note on Sensitive Tables:
-- CompanyProfile, CompanyAddress, BankAccount, CompanyDocument, SignatoryAsset,
-- DocumentSeries, and AuditEvent intentionally have ZERO client-facing policies.
-- They can ONLY be read or written via authenticated Next.js backend API routes
-- using server-side INVENTRA RBAC validation.

-- ------------------------------------------------------------------------------
-- 5. AuditEvent Immutability Guards (Triggers & Privilege Revocation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: INVENTRA AuditEvent logs are append-only and cannot be updated, deleted, or truncated.';
END;
$$ LANGUAGE plpgsql;

-- Row-level trigger: blocks UPDATE and DELETE for every row
DROP TRIGGER IF EXISTS trg_prevent_audit_modification ON "AuditEvent";
CREATE TRIGGER trg_prevent_audit_modification
    BEFORE UPDATE OR DELETE ON "AuditEvent"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Statement-level trigger: blocks TRUNCATE at the statement level
DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON "AuditEvent";
CREATE TRIGGER trg_prevent_audit_truncate
    BEFORE TRUNCATE ON "AuditEvent"
    FOR EACH STATEMENT
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Defense-in-depth: explicitly revoke TRUNCATE, UPDATE, DELETE privileges from application client roles
REVOKE TRUNCATE, UPDATE, DELETE ON "AuditEvent" FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. Supabase Private Storage Bucket Configuration
-- Bucket: inventra-private-documents (Strictly private, max 10MB limit)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inventra-private-documents',
    'inventra-private-documents',
    false,
    10485760, -- 10MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

-- ------------------------------------------------------------------------------
-- 7. Storage Security Policies
-- Drop any legacy broad policies on storage.objects
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read private documents with valid token" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access on storage" ON storage.objects;

-- SECURITY DIRECTIVE:
-- NO direct SELECT policy is granted to 'authenticated' or 'anon' on 'inventra-private-documents'.
-- All downloads MUST proceed through INVENTRA's server endpoint (/api/v1/storage/download),
-- where the server verifies the user's session, INVENTRA RBAC, and document ownership before
-- generating a short-lived signed URL or streaming the authorized file.
-- Service role operations operate via backend server credentials with native bypass.
