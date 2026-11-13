# INVENTRA – PERMANENT AGENT & DEVELOPER INSTRUCTIONS

> **CRITICAL DIRECTIVE**: This document is the permanent single source of truth for all AI agents, software architects, and full-stack engineers working on **INVENTRA**. All instructions, architectural constraints, business rules, security models, and design standards defined herein are permanent and non-negotiable. No agent or developer may contradict, bypass, or alter these core tenets.

---

## 1. Project Identity & Context

- **Software Product Name**: `INVENTRA`
- **Operating Business Identity**: `AJAY ENTERPRISES`
- **Industry & Domain**: Construction Centering Material Rental, Inventory, Asset & Operations ERP
- **Visual Branding**: Navy (`#0B1E36`, `#0F172A`) and Industrial Safety Orange (`#F26522`, `#EA580C`), derived directly from the official INVENTRA logo (`assets/inventra-logo.png`).
- **Legal Context**: Indian GST regime, double-entry financial accounting, Companies Act compliance, E-Way Bill statutory rules, Information Technology Act digital signature framework.

---

## 2. The 20 Permanent Business Rules (Non-Negotiable)

Every agent working on this codebase must strictly adhere to these twenty foundational rules:

1. **Software Name**: The application is **INVENTRA**. The operating business is **AJAY ENTERPRISES**. Invoices, Delivery Notes, and legal documents must display the editable AJAY ENTERPRISES company identity. The INVENTRA logo is for software branding and must not replace the legal business identity.
2. **Business Identity**: All legal, tax, and trading operations belong to **AJAY ENTERPRISES**.
3. **No QR Codes**: **Strictly NO QR code scanning, QR code asset tagging, or QR-based material identification workflows.** Material tracking is bulk/quantity-based with optional batch/lot references.
4. **Company-Owned Fleet Only**: **All vehicles are company-owned.** Do not implement hired-vehicle or third-party vehicle management. The fleet module manages AJAY ENTERPRISES-owned vehicles and drivers.
5. **Multi-Site Customer Architecture**: A single customer can have **unlimited construction sites**. Customer and Site are distinct database entities.
6. **Independent Site Profiles**: Each construction site maintains its own property owner details, site contacts, delivery instructions, site reference photos, and documents.
7. **Single Movement Documents**: Exactly one **Delivery Note (DN)** records each dispatch. Exactly one **Material Return Note (MRN)** records each return.
8. **GPS Camera Proof & Acknowledgement**: Delivery Notes require captured site photographs with embedded GPS metadata (timestamp, latitude, longitude, accuracy) and receiver acknowledgement (name, phone, designation, signature).
9. **Automated WhatsApp Document Delivery**: Completed delivery documents and linked E-Way Bills must be automatically transmitted via WhatsApp to configured authorised site contacts once integration is enabled.
10. **Delivery Notes Are Not Invoices**: Delivery Notes represent material custody transfer, not a sale or financial invoice.
11. **Monthly Consolidated Rental Billing**: Rental billing is calculated monthly using actual daily material movement history. Customers with multiple sites may receive consolidated or site-wise invoices.
12. **Independent Delivery/Return Date Inclusion Rules**: **"Include Delivery Date"** and **"Include Return Date"** are two completely independent Boolean configurations. They must never be coupled. Precedence hierarchy: `Material Line Override > Site Override > Customer Override > Business Default`.
13. **Dual GST & Non-GST Support**: Both GST-registered and unregistered/non-GST customers must be supported with complete ledger tracking.
14. **Customer Status Does Not Dictate Taxability**: An unregistered or non-GST customer record does **not** automatically make a transaction tax-exempt. Taxability is determined by the accountant-configured tax rules for the supply.
15. **Strict Double-Entry General Ledger**: All financial events (invoices, receipts, payments, credit/debit notes, wage accruals, damage claims) post balanced debits and credits to the General Ledger (`SUM(debits) == SUM(credits)`).
16. **Movement-Derived Inventory**: Physical and site stock balances are **never** directly editable. Stock is mathematically derived from an immutable, append-only movement ledger.
17. **Distinguishable Material Ownership**: Materials owned by AJAY ENTERPRISES, materials hired-in from third-party owners, and customer custody materials must remain strictly segregated in separate ownership buckets.
18. **Immutability of Finalised Financial Documents**: Finalised invoices, posted journal entries, completed delivery notes, and signed agreements **cannot be deleted or silently modified**. Corrections require authorised reversal, replacement, or adjustment entries.
19. **Configurable Company Profile & Document Assets**: Company details, addresses, bank accounts, authorised signatures, company stamp/seal, and document number series must be fully configurable and never hardcoded.
20. **Shared Central Entities**: All modules must reference shared Customer, Site, Inventory, Accounting, and Permission records. Never duplicate core entities across modules.

---

## 3. Explicit Prohibitions & Anti-Patterns

Agents are strictly forbidden from implementing the following:
- ❌ **NO QR Code scanning or camera barcode readers** for materials.
- ❌ **NO Hired-vehicle or market transporter fleet management** (company fleet only).
- ❌ **NO Live GPS tracking of materials** (materials do not have IoT trackers; GPS is point-in-time proof captured on delivery/return photos).
- ❌ **NO Mock or pretend transactions** in production code.
- ❌ **NO Hardcoded rates, taxes, or business information** (all must be master-data driven).
- ❌ **NO Editable financial or stock balances** (all must be computed projections).
- ❌ **NO Native browser dropdowns** (`<select>`) in primary interfaces.
- ❌ **NO Silent deletion or overwriting of posted documents**.
- ❌ **NO Premature external API claims** (mark sandbox/real integrations accurately).

---

## 4. Technical Architecture Conventions

### 4.1 System Pattern: Modular Monolith
INVENTRA is built as a **Modular Monolith** using TypeScript. Business domains are cleanly decoupled into modular directories with explicit interfaces, shared database access, and clear dependency boundaries.

### 4.2 Approved Technology Stack
- **Framework**: **Next.js 15+** (App Router, Server Actions, API Routes, React 19, TypeScript).
- **Managed Cloud Platform**: **Supabase** (Managed PostgreSQL 16+, PostGIS, Supabase Auth, Supabase Storage).
- **Database**: **Supabase Managed PostgreSQL 16+** with **PostGIS** extension for spatial coordinates, geofencing, and location heatmaps. Dual connection strategy: Connection Pooler (Port 6543, transaction mode / pgbouncer) for application runtime, and Direct Connection (Port 5432) for Prisma migrations.
- **ORM / Query Engine**: **Prisma ORM** with strict schema typing, transactional support (`$transaction`), explicit decimal types (`DECIMAL(15, 2)` / `DECIMAL(10, 7)`), and `previewFeatures = ["postgresqlExtensions"]`. Prisma remains the sole ORM for server-side business logic.
- **Authentication**: **Supabase Auth** integrated with Next.js SSR via `@supabase/ssr` and Next.js middleware. Users are linked between Supabase `auth.users.id` and INVENTRA `User.supabaseId`. No secondary password hashing database is maintained.
- **Authorization**: **INVENTRA Custom RBAC** (9 corporate roles, 15 modules, 8 actions) enforced server-side via `requirePermission`, backed by PostgreSQL Row Level Security (RLS) policies and immutable triggers on audit events.
- **UI & Component System**: **Tailwind CSS v3.4+ / v4**, **Radix UI** primitives, **shadcn/ui** patterns, **Lucide Icons**, **TanStack Table** for rich data grids.
- **Form & Validation**: **React Hook Form** + **Zod** for isomorphic client and server validation.
- **State Management**: **TanStack Query (React Query)** for client-side asynchronous state caching.
- **File Storage**: **Supabase Storage** with private bucket (`inventra-private-documents`), server-authorized upload/download, SHA-256 checksum verification, MIME whitelisting, 10MB limits, and short-lived pre-signed download URLs.
- **Background Jobs**: Transactional Outbox Pattern with PostgreSQL-backed job queue ensuring zero lost events.
- **Offline PWA Engine**: Service Worker caching, IndexedDB local draft storage for delivery and warehouse staff.

### 4.3 Numbering & Primary Keys
- **Internal IDs**: **UUIDv7** (time-sortable, 128-bit collision-resistant, database index-friendly).
- **Human-Readable Document Numbers**: Format: `PREFIX-YYYY-NNNN` (e.g., `DN-2026-0001`, `MRN-2026-0001`, `INV-2026-0001`, `STN-2026-0001`, `REC-2026-0001`). Managed by a concurrency-safe `DocumentSeries` counter per financial year.

### 4.4 Numeric & Monetary Precision
- **Monetary amounts**: `DECIMAL(15, 2)` (INR currency). **Never use floating-point numbers.**
- **Material quantities & dimensions**: `DECIMAL(12, 3)` (supports fractional metric units where needed).
- All arithmetic must use integer cents/paise or decimal-safe libraries (`decimal.js` / BigNumber).

---

## 5. UI/UX & Form Design Standards

1. **Brand Palette**:
   - Deep Navy Primary: `#0B1E36` (Sidebar, Headers, Primary Buttons)
   - Slate Secondary: `#1E293B`, `#334155`, `#64748B` (Body text, borders, subtle accents)
   - Industrial Safety Orange Accent: `#F26522` / `#EA580C` (Highlights, call-to-actions, active indicators)
   - Neutral Light Background: `#F8FAFC`, `#FFFFFF`
   - Status Colors: Emerald Green (`#10B981`), Amber Warning (`#F59E0B`), Crimson Error (`#EF4444`).
2. **Form Dropdown Standard**:
   - Native `<select>` elements are strictly prohibited for primary forms.
   - Use **searchable comboboxes** (Command + Popover) with autocomplete, keyboard navigation, clear buttons, and empty state prompts.
   - For multiple selection, use searchable tag/pill inputs with clear-all functionality.
3. **Form Validation Ergonomics**:
   - Every input must feature clear labels, required `*` indicators, helpful placeholders, and inline error messages beneath the input.
   - Buttons must show spinner loading states and disable during submission to prevent double-posting.
   - Complete server-side validation using matching Zod schemas.

---

## 6. Document Immutability & Snapshot Rule

When a document reaches a finalized state (`ISSUED`, `POSTED`, `COMPLETED`):
1. **Freeze State**: The system must serialize and store a complete JSON snapshot (`snapshot_payload`) of all relevant company profile data, addresses, customer details, tax rates, line items, signatory details, and template versions.
2. **Render PDF**: Generate the static PDF document, calculate its SHA-256 checksum (`document_hash`), and store it privately.
3. **Audit Log**: Record actor, timestamp, client IP, action, and hash in `AuditEvent`.
4. **No In-Place Edits**: Any correction must proceed through formal adjustment workflows (Credit Note, Debit Note, MRN Adjustment, Journal Reversal).

---

## 7. Role-Based Access & Portal Structure

INVENTRA operates as one unified system with 5 tailored portal views:
- **Owner / Super Admin**: Executive dashboard, profit/loss, financial ledgers, audit logs, company settings, approvals.
- **Office / Accountant**: Customer/site management, quotations, agreements, monthly rental billing, invoicing, payments, GST reports.
- **Warehouse Staff**: PO receipts, GRNs, dispatch picking/loading, return inspection, maintenance/repairs, stock counts.
- **Delivery Personnel (Mobile PWA)**: Assigned deliveries/pickups, GPS site photo capture, receiver acknowledgement, offline queuing.
- **Labour Supervisor (Mobile PWA)**: Worker roster, daily site attendance, overtime, site allocation.

Permissions use **RBAC + Granular Record Scope**:
- Scope levels: `ALL_BUSINESS`, `ASSIGNED_WAREHOUSE`, `ASSIGNED_SITE`, `ASSIGNED_DELIVERY`.
- Authorised customer site contacts are **external parties**, not internal system users, with explicit token-based action links.

---

## 8. Development Workflow & Phase Gates

Development follows a strict phased plan. **Do not jump phases.**
- **Phase 0**: Project Foundation, Architecture, Standards & Blueprint Sign-off (**COMPLETED**)
- **Phase 1**: Core Platform, Authentication, RBAC, Company Profile, Document Series, Audit & Storage (**COMPLETED**)
- **Phase 1.5**: Supabase Architecture Alignment (PostgreSQL, PostGIS, Supabase Auth SSR, Supabase Storage, RLS) (**COMPLETED**)
- **Phase 2**: Master Data, Inventory Movement Ledger, PO/GRN, Movement Documents (DN/MRN/STN/HDN/HRN), Delivery & Warehouse Portals
- **Phase 3**: Rental Billing Engine, Daily Accrual, Date Inclusion Rules, Monthly Consolidated Billing & Payment Allocation
- **Phase 4**: Double-Entry General Ledger, Chart of Accounts, Subledgers, GST & Financial Statements
- **Phase 5**: External Integrations (FYN E-Way Bill, WhatsApp Business, eSign) & PDF Document Engine
- **Phase 6**: Management Intelligence, Owner Analytics, Interactive Location Heatmap, Fleet & Labour Ops
- **Phase 7**: Opening Balances Cutover, Staff Training, Pilot Deployment & Production Go-Live

---

## 9. Alignment with Documentation

All architecture and implementation choices must strictly conform to the documents in `docs/`:
- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_DESIGN.md`
- `docs/BUSINESS_RULES.md`
- `docs/UI_UX_STANDARDS.md`
- `docs/API_STANDARDS.md`
- `docs/SECURITY_STANDARDS.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/references/INVENTRA_Master_Software_Blueprint_v1.0.pdf`

