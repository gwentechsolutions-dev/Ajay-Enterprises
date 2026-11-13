# INVENTRA – Phase 4: Rental Management & Monthly Billing Engine
## Implementation & Verification Report

**Software Product**: `INVENTRA`  
**Operating Business**: `AJAY ENTERPRISES`  
**Phase**: Phase 4 – Rental Management & Monthly Billing Engine  
**Status**: **COMPLETED & VERIFIED**  
**Database**: Supabase PostgreSQL 17 (Session Pooler & Direct)  
**ORM**: Prisma ORM 6.19.3  
**Framework**: Next.js 15 (App Router, Server Actions, React 19, TypeScript)  
**Test Suite**: 107/107 Tests Passing (0 Failures across 39 Suites)

---

## 1. Executive Summary

Phase 4 delivers the complete core commercial rental engine for **INVENTRA** (`AJAY ENTERPRISES`), bridging the gap between material logistics (Delivery Notes & Material Return Notes from Phase 3) and statutory billing.

The module implements:
1. **Rental Agreement Management**: Multi-site rate schedules, agreed daily rates, deposit requirements, billing cycle configurations, and renewal tracking.
2. **Batch-Level Material Rental Tracking**: Live equipment custody tracking per delivery batch, maintaining historical delivery dates, rates, and FIFO-based return deductions.
3. **Deterministic Daily Rental Calculation Engine**: Strict `Eligible Qty × Daily Rate` daily accruals with independent `includeDeliveryDate` and `includeReturnDate` flags, zero IEEE 754 floating-point drift (`DECIMAL(15, 2)` / `DECIMAL(12, 3)`), and day-by-day auditable calculation logs.
4. **Monthly Rental Statements**: Site-wise and consolidated billing modes, opening/closing held balances, delivery additions, return reductions, billable day counts, damage/loss charges, and finalized snapshot freeze.
5. **Damage & Loss Recovery**: Assessments for repairable damage, scrap write-offs, and missing material replacement value recovery.
6. **Rental Deposit Accounting**: Security deposit receipts, deductions/adjustments, and refund balance tracking.
7. **Customer Site Closure Settlement**: Pre-closure audit enforcing zero unreturned stock before site closure, protected by an Owner Exception Approval guard.

---

## 2. Architecture & Database Design

### 2.1 Prisma Schema & Database Models

The Phase 4 database migration (`20261113000005_phase4_rental_management_billing`) was deployed to Supabase PostgreSQL, introducing 11 normalized models:

| Model | Purpose | Key Constraints & Relations |
| :--- | :--- | :--- |
| `RentalAgreement` | Master commercial agreement per customer site | Linked to `Customer`, `CustomerSite`. Unique `agreementNumber`. |
| `RentalAgreementItem` | Agreed daily rental rates per material variant | Linked to `MaterialVariant`. Strict decimal precision. |
| `RentalBatch` | Individual delivery equipment tracking bucket | Linked to `DeliveryNote`, `DeliveryNoteItem`. Tracks `deliveredQty`, `returnedQty`, `damagedQty`, `missingQty`, `currentHeldQty`, and `applicableDailyRate`. |
| `RentalReturnAllocation` | FIFO linkage of returns to delivery batches | Links `MaterialReturnNoteItem` to `RentalBatch`. Tracks return date and return-date inclusion. |
| `RentalStatement` | Monthly financial statement | Status lifecycle: `DRAFT` → `CALCULATED` → `REVIEWED` → `APPROVED` → `FINALIZED`. Supports `SITE_WISE` and `CONSOLIDATED` modes. Immutable JSON `snapshotPayload` when finalized. |
| `RentalStatementItem` | Material-level billing summary within statement | Opening held, new deliveries, returns, closing held, billable days, gross rental amount. |
| `RentalStatementDayDetail` | Day-by-day auditable billing log | Date, active held quantity, applicable rate, and calculated day cost. |
| `RentalStatementSiteSummary` | Site-level breakdown for consolidated statements | Site name, gross rental, damage charges, missing charges, and net site payable. |
| `DamageLossAssessment` | Formal charges for damaged or lost equipment | `DAMAGED_REPAIRABLE`, `DAMAGED_SCRAP`, `MISSING`. Requires photographs and remarks. |
| `RentalDepositTransaction` | Security deposit tracking | `RECEIPT`, `ADJUSTMENT_RENT`, `ADJUSTMENT_DAMAGE`, `REFUND`. Tracks running balance. |
| `SiteClosureSettlement` | Pre-closure audit and settlement record | Document format `SET-YYYY-NNNN`. Enforces zero unreturned stock unless approved by Owner. |

---

## 3. Core Engine Implementations

### 3.1 Daily Rental Calculator (`src/lib/rentals/calculator.ts`)
- **Mathematical Precision**: Employs integer paise scaling / `Prisma.Decimal` to eliminate standard IEEE 754 floating-point drift.
- **Independent Date Inclusion Rules**:
  - `includeDeliveryDate` determines whether the calendar day of dispatch is billable.
  - `includeReturnDate` determines whether the calendar day of physical return is billable.
  - Both flags operate independently without coupling.
- **Daily Splitting for Partial Returns**: When a portion of a batch is returned mid-month, the calculator dynamically splits the period, billing the full delivered quantity until return day, and the remaining held quantity thereafter.

### 3.2 Field Stock Tracking & Dispatch Hooks (`src/lib/rentals/tracking.ts`)
- **Automated Batch Creation**: Integrated directly into `POST /api/v1/delivery-notes/[id]/dispatch`. Upon dispatch, an immutable `RentalBatch` (`RB-YYYY-NNNN`) is created for each line item.
- **Automated FIFO Return Allocation**: Integrated into `POST /api/v1/return-notes`. When materials are returned, the oldest active delivery batches for that site and variant are reduced first.
- **Ledger Reconciliation**: Reconciles rental batch held balances against physical warehouse and site `StockBalance` records.

### 3.3 Site Closure Pre-Audit Engine (`src/lib/rentals/settlement.ts`)
- Audits all open `RentalBatch` records for the site.
- If `currentHeldQty > 0`, standard site closure is **strictly rejected**.
- An Owner/Admin can authorize an **Owner Exception Closure** only by supplying an explicit, mandatory justification recorded in `AuditEvent`.

---

## 4. RESTful API Endpoints Implemented

| Endpoint | Method | RBAC Action | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/rentals/dashboard` | `GET` | `rentals:view` | Accrual metrics, active sites, held materials summary |
| `/api/v1/rentals/agreements` | `GET`, `POST` | `rentals:view / create` | List and create rental agreements with item rates |
| `/api/v1/rentals/agreements/[id]` | `GET` | `rentals:view` | Agreement details, items, rate schedules |
| `/api/v1/rentals/agreements/[id]/approve` | `POST` | `rentals:approve` | Approve draft rental agreements |
| `/api/v1/rentals/held-stock` | `GET` | `rentals:view` | Active field stock across customer sites and batches |
| `/api/v1/rentals/held-stock/reconcile` | `POST` | `rentals:create` | Reconcile batch held balances with StockBalance |
| `/api/v1/rentals/statements/calculate` | `POST` | `rentals:view` | Dry-run preview calculation for period |
| `/api/v1/rentals/statements` | `GET`, `POST` | `rentals:view / create` | Generate and list monthly statements |
| `/api/v1/rentals/statements/[id]` | `GET` | `rentals:view` | Detailed statement view with daily logs |
| `/api/v1/rentals/statements/[id]/approve` | `POST` | `rentals:approve` | Approve calculated statements |
| `/api/v1/rentals/statements/[id]/finalize` | `POST` | `rentals:finalize` | Freeze snapshot and finalize statement |
| `/api/v1/rentals/statements/[id]/print` | `GET` | `rentals:view` | Printable A4 statement for customer delivery |
| `/api/v1/rentals/damage-loss` | `GET`, `POST` | `rentals:view / create` | Record damage, scrap, or missing material claims |
| `/api/v1/rentals/damage-loss/[id]/approve`| `POST` | `rentals:approve` | Approve damage/loss assessment |
| `/api/v1/rentals/deposits` | `GET`, `POST` | `rentals:view / create` | Record security deposit receipts and adjustments |
| `/api/v1/rentals/deposits/[id]/refund` | `POST` | `rentals:approve` | Authorize deposit refund |
| `/api/v1/rentals/closures` | `GET`, `POST` | `rentals:view / create` | Site closure settlement execution |
| `/api/v1/rentals/closures/check` | `POST` | `rentals:view` | Pre-closure audit of unreturned materials |

---

## 5. UI Portal Screens Implemented

1. **Rental Dashboard** (`/rentals`): Overview of active equipment in the field, monthly rental accruals, unbilled sites, and quick action cards.
2. **Rental Agreements** (`/rentals/agreements`): Agreement creation wizard, multi-variant rate table, deposit tracking, status badges, and approval actions.
3. **Field Held Stock Tracker** (`/rentals/held-stock`): Filter by customer, site, and variant. Drill down into individual delivery batches and FIFO allocations. Reconcile button for stock audits.
4. **Monthly Statements Generator** (`/rentals/statements`): Period picker, Site-Wise vs Consolidated toggle, live dry-run calculation preview, approve/finalize workflow, and A4 print view.
5. **Damage & Loss Claims** (`/rentals/damage-loss`): Record repairable damage, scrap write-offs, or missing stock with photo links and replacement values.
6. **Site Closures & Settlements** (`/rentals/closures`): Pre-closure audit checklist, unreturned material warning banner, Owner Exception Override with mandatory explanation, and final settlement records.
7. **Sidebar Integration**: Added "Rental & Billing Engine" navigation group under `src/components/layout/sidebar.tsx`.

---

## 6. Verification & Automated Test Suite

A comprehensive test suite was executed covering all **20 specified Phase 4 scenarios** in `tests/phase4-rentals.test.js`:

| # | Scenario Tested | Result |
| :---: | :--- | :---: |
| 1 | `includeDeliveryDate = true` charges dispatch calendar date | **PASS** |
| 2 | `includeDeliveryDate = false` excludes dispatch calendar date | **PASS** |
| 3 | `includeReturnDate = true` charges physical return calendar date | **PASS** |
| 4 | `includeReturnDate = false` excludes return calendar date | **PASS** |
| 5 | Same-day delivery & return with both flags `true` = 1 billable day | **PASS** |
| 6 | Same-day delivery & return with both flags `false` = 0 billable days | **PASS** |
| 7 | Partial return dynamically splits daily rental accrual without rate loss | **PASS** |
| 8 | Multiple deliveries to same site maintain distinct delivery dates and rates | **PASS** |
| 9 | FIFO return deduction exhausts oldest delivery batch first | **PASS** |
| 10 | Agreement `agreedDailyRate` strictly overrides Material Variant default rate | **PASS** |
| 11 | Subsequent master catalog rate edits do not mutate active batch rates | **PASS** |
| 12 | Decimal arithmetic eliminates standard IEEE 754 floating-point drift | **PASS** |
| 13 | Strict segregation of `OWNED` and `HIRED_IN` material tracking buckets | **PASS** |
| 14 | Site-Wise statement requires `customerSiteId` and computes site total | **PASS** |
| 15 | Consolidated statement aggregates multiple sites into unified customer total | **PASS** |
| 16 | Duplicate billing validation blocks overlapping statement periods | **PASS** |
| 17 | Finalized statement freezes snapshot and strictly forbids in-place mutation | **PASS** |
| 18 | Damage and missing claims compute separate charges outside rental rate | **PASS** |
| 19 | Rental deposit adjustment reduces outstanding net settlement balance | **PASS** |
| 20 | Pre-closure audit blocks site closure if materials unreturned without Owner Override | **PASS** |

### Test Runner Summary:
- **Total Tests Passed**: **107 / 107**
- **Suites Passed**: **39 / 39**
- **Failures**: **0**
- **TypeScript Typecheck (`npx tsc --noEmit`)**: **0 Errors**

---

## 7. Business Rule Compliance Checklist

| Rule | Requirement | Verification Status |
| :--- | :--- | :---: |
| **Rule 1** | Operating business identity is `AJAY ENTERPRISES`; software is `INVENTRA` | **COMPLIANT** |
| **Rule 3** | Strictly NO QR codes or camera barcode scanning | **COMPLIANT** |
| **Rule 4** | Company fleet only | **COMPLIANT** |
| **Rule 5 & 6** | Multi-site customer architecture with independent site profiles | **COMPLIANT** |
| **Rule 10** | Delivery Notes & MRNs are operational custody transfer documents, not invoices | **COMPLIANT** |
| **Rule 11** | Monthly consolidated and site-wise rental billing based on actual movement history | **COMPLIANT** |
| **Rule 12** | Independent `includeDeliveryDate` and `includeReturnDate` flags | **COMPLIANT** |
| **Rule 16** | Stock is movement-derived; stock balances are never directly edited | **COMPLIANT** |
| **Rule 17** | Distinguishable material ownership (`OWNED` vs `HIRED_IN`) | **COMPLIANT** |
| **Rule 18** | Immutability of finalized financial documents (`snapshotPayload` freeze) | **COMPLIANT** |
| **Rule 19** | Configurable company profile and document series (`AGR`, `STM`, `DLA`, `DEP`, `SET`, `RB`) | **COMPLIANT** |
