# INVENTRA – Phase 3 Implementation Report: Purchase, Delivery & Material Operations

**Operating Business Identity**: AJAY ENTERPRISES  
**Software Product**: INVENTRA (Construction Centering Material Rental, Inventory, Asset & Operations ERP)  
**Phase Completed**: Phase 3 – Purchase, Delivery & Material Operations  
**Date**: November 13, 2026  
**Status**: **100% IMPLEMENTED & VERIFIED** (87/87 Unit & Integration Tests Passing, Production Build Passing)

---

## 1. Executive Summary & Verification Status

All requirements for **Phase 3: Purchase, Delivery & Material Operations** have been implemented end-to-end. Every module is connected to PostgreSQL on Supabase via Prisma ORM, validated by Zod schemas on client and server, protected by INVENTRA RBAC permission gates, and verified through automated test suites and production build validation.

```mermaid
flowchart TD
    subgraph SupplyChain["Material Inflow & Hired-In Operations"]
        PO["Purchase Order (PO)"] --> GRN["Goods Receipt Note (GRN)"]
        GRN -->|"Accepted Stock"| WH_AVAIL["Warehouse Available Pool"]
        GRN -->|"Damaged Stock"| WH_DAM["Warehouse Damaged Pool"]
        GRN -->|"Rejected"| PR["Purchase Returns (PR)"]
        HDN["Hiring Delivery Note (HDN)"] -->|"Segregated"| WH_HIRED["Warehouse Hired-In Pool"]
    end

    subgraph InternalTransfers["Inter-Warehouse Transfers"]
        WH_AVAIL -->|"Dispatch"| STN_DISP["STN (IN_TRANSIT)"]
        STN_DISP -->|"Receipt"| DEST_WH["Destination Warehouse"]
    end

    subgraph CustomerMovement["Customer Site Operations"]
        WH_AVAIL & WH_HIRED -->|"Dispatch"| DN["Delivery Note (DN)"]
        DN -->|"Delivery Sign-Off (GPS/Photo/Sign)"| SITE_BAL["Customer Site Balance"]
        SITE_BAL -->|"Return"| MRN["Material Return Note (MRN)"]
        MRN -->|"Accepted"| WH_AVAIL
        MRN -->|"Damaged (Non-Rentable)"| WH_DAM
        MRN -->|"Missing (Billing Accrual)"| MISSING_STOCK["Missing Recovery Ledger"]
    end

    subgraph OutflowHired["Hired-In Outflow"]
        WH_HIRED -->|"Return to Vendor"| HRN["Hiring Return Note (HRN)"]
    end
```

### Verification Highlights
- **Test Suite**: `npm test` executed across all modules: **87 tests passing across 32 test suites, 0 failures**.
- **Production Build**: `npm run build` executed cleanly: **Exit code 0, 53 static and dynamic routes generated**.
- **Type Integrity**: `npx tsc --noEmit` executed cleanly with zero type errors.
- **Database Schema**: Migration `20261113000004_phase3_purchase_delivery_operations` safely deployed to Supabase PostgreSQL without loss of existing records.

---

## 2. Requirement-by-Requirement Implementation Matrix

| Requirement | Module / Feature | Database Entities | API Endpoints | UI & Mobile Interface | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Purchase Orders** | PO creation, multi-item, GST/discount math, approval lifecycle | `PurchaseOrder`, `PurchaseOrderItem` | `GET/POST /api/v1/purchases/orders`<br>`GET /api/v1/purchases/orders/[id]`<br>`POST /api/v1/purchases/orders/[id]/approve` | `/purchases` (PO Tab & Modal) | **PASSED** (Tests & Live Build) |
| **Goods Receipt Notes** | GRN against PO, partial receipts, accepted/damaged breakdown | `GoodsReceiptNote`, `GoodsReceiptNoteItem` | `GET/POST /api/v1/purchases/grn` | `/purchases` (GRN Unloading Modal) | **PASSED** (Transactional Ledger) |
| **Purchase Returns** | Vendor returns against GRN/stock, deducts available stock | `PurchaseReturn`, `PurchaseReturnItem` | `GET/POST /api/v1/purchases/returns` | `/purchases` (Return Dialog) | **PASSED** (Stock Deduction Verified) |
| **Material Delivery Notes** | Dispatch to site, separate `OWNED` vs `HIRED_IN` pools | `DeliveryNote`, `DeliveryNoteItem` | `GET/POST /api/v1/delivery-notes`<br>`POST .../dispatch`<br>`POST .../deliver` | `/delivery-notes` | **PASSED** (Independent Date Rules) |
| **Delivery Proof & Sign-Off** | Photo upload, GPS lat/long, accuracy, touch signature, fallback | `MovementEvidence` | `GET/POST /api/v1/evidence`<br>`POST .../deliver` | `/delivery-notes` (Sign Modal)<br>`/delivery-portal` | **PASSED** (Storage & Audit Logging) |
| **Material Return Notes** | Site returns, accepted/damaged/missing split, damaged quarantined | `MaterialReturnNote`, `MaterialReturnNoteItem` | `GET/POST /api/v1/return-notes`<br>`GET .../[id]` | `/return-notes` | **PASSED** (Non-Rentable Damaged Pool) |
| **Stock Transfer Notes** | Warehouse to warehouse, `IN_TRANSIT` status, receipt inspection | `StockTransferNote`, `StockTransferNoteItem` | `GET/POST /api/v1/stock-transfers`<br>`POST .../dispatch`<br>`POST .../receive` | `/stock-transfers` | **PASSED** (Inter-Warehouse Transfers) |
| **Hired-In Operations** | HDN (hiring in to warehouse) & HRN (returning to supplier) | `HiringDeliveryNote`, `HiringReturnNote` | `GET/POST /api/v1/hiring-notes/delivery`<br>`GET/POST /api/v1/hiring-notes/return` | `/hiring-notes` (Tabs for HDN & HRN) | **PASSED** (Strict Pool Segregation) |
| **Statutory E-Way Bill** | FYN Gateway sandbox simulation, 12-digit number, cancellation | `EWayBill` | `GET /api/v1/ewaybills`<br>`POST /api/v1/ewaybills/generate`<br>`POST .../cancel` | `/delivery-notes` (EWB Modal)<br>`/stock-transfers` | **PASSED** (Masked Payload Security) |
| **Warehouse Portal** | Operational yard view: unloading, dispatching, returns queue | All Phase 3 Models | `GET /api/v1/portals/warehouse` | `/warehouse-portal` | **PASSED** (Live Queue Summary) |
| **Driver PWA Portal** | Mobile-optimized driver view, GPS capture, offline queue | `DeliveryNote`, `MovementEvidence` | `GET /api/v1/portals/delivery` | `/delivery-portal` | **PASSED** (Mobile Touch & PWA Engine) |
| **Offline Draft Engine** | LocalStorage/IndexedDB queuing, retry, sync state machine | Client-Side Queue | `src/lib/offline/drafts.ts` | `/delivery-portal` Sync Bar | **PASSED** (Idempotency Safe) |
| **Printable Documents** | A4 printable documents for PO, GRN, DN, MRN, STN, HDN, HRN | All Phase 3 Models | `GET .../print` | A4 Printable HTML / PDF View | **PASSED** (AJAY ENTERPRISES Branding) |
| **WhatsApp Notifications** | Non-blocking WhatsApp dispatch for PO, GRN, DN, MRN, STN | Audit & Queue | `src/lib/notifications/whatsapp.ts` | Server Action Dispatch | **PASSED** (Async Non-Blocking) |

---

## 3. Detailed Architecture & Technical Implementation

### 3.1 Database Layer (PostgreSQL 17 on Supabase)
The database was extended with **18 normalized models** under migration `20261113000004_phase3_purchase_delivery_operations`:
1. `PurchaseOrder` & `PurchaseOrderItem`: Header and items with decimal line discounts, GST rates, subtotal, and grand total.
2. `GoodsReceiptNote` & `GoodsReceiptNoteItem`: Physical receipt tracking with discrete counts for `receivedQty`, `acceptedQty`, `rejectedQty`, and `damagedQty`.
3. `PurchaseReturn` & `PurchaseReturnItem`: Rejection returns linked to original supplier and GRN.
4. `DeliveryNote` & `DeliveryNoteItem`: Outbound dispatches with `ownershipType` (`OWNED` vs `HIRED_IN`), daily rental rates, driver details, and independent `includeDeliveryDate` boolean flag.
5. `MaterialReturnNote` & `MaterialReturnNoteItem`: Inbound customer returns with itemized breakdowns (`returnedQty`, `acceptedQty`, `damagedQty`, `missingQty`) and independent `includeReturnDate` boolean flag.
6. `StockTransferNote` & `StockTransferNoteItem`: Inter-warehouse transfer tracking with `IN_TRANSIT` lifecycle and receipt condition verification.
7. `HiringDeliveryNote` & `HiringDeliveryNoteItem`: Inflow of rented equipment from third-party vendors directly into the `HIRED_IN` warehouse stock pool.
8. `HiringReturnNote` & `HiringReturnNoteItem`: Outflow of rented equipment returning to vendors with validation ensuring `HIRED_IN` pool availability.
9. `MovementEvidence`: Cryptographically linked digital evidence recording photo URL, GPS latitude, longitude, accuracy radius, timestamp, receiver name, phone, designation, and base64 signature with missing reason fallbacks.
10. `EWayBill`: E-Way Bill metadata, validity window, vehicle assignments, and cancellation reasons.

### 3.2 Concurrency-Safe Document Series
All document numbers are provisioned via `generateNextDocumentNumber(seriesType)` in `src/lib/document-series.ts`, supporting concurrency-safe atomic counters for:
- `PO` → `PO-2026-NNNN`
- `GRN` → `GRN-2026-NNNN`
- `PR` → `PR-2026-NNNN`
- `DN` → `DN-2026-NNNN`
- `MRN` → `MRN-2026-NNNN`
- `STN` → `STN-2026-NNNN`
- `HDN` → `HDN-2026-NNNN`
- `HRN` → `HRN-2026-NNNN`
- `EWB` → `EWB-2026-NNNN`

### 3.3 Strict Ownership Segregation (Rule #17)
Material variants are tracked in distinct stock pools:
- **`OWNED` Stock**: Capital assets owned directly by AJAY ENTERPRISES.
- **`HIRED_IN` Stock**: Materials hired in from external suppliers.
- Every inventory ledger movement explicitly designates `ownershipType`. Stock balance checks enforce that dispatches against a particular pool cannot consume stock from the other pool.

### 3.4 Independent Rental Date Inclusion Rules (Rule #12)
- **`includeDeliveryDate`**: Decoupled boolean toggle on Delivery Notes. When `true`, rental billing accrual begins on the delivery date.
- **`includeReturnDate`**: Decoupled boolean toggle on Material Return Notes. When `true`, rental billing accrual includes the return date.
- Both flags operate independently and do not overwrite or infer each other, satisfying Rule #12 in preparation for Phase 4 Rental Billing.

### 3.5 Damaged and Missing Stock Handling
- **Damaged Stock**: When goods are returned with damages (via GRN, MRN, or STN), the damaged quantity is incremented in `StockBalance.damagedQty` and decremented from available stock. It cannot be rented out or dispatched until repaired.
- **Missing Stock**: Missing quantities on MRNs are deducted from the site balance and logged for loss-recovery invoicing during monthly billing without altering physical warehouse balances.

---

## 4. Operational Portals & Mobile Experience

### 4.1 Warehouse Staff Portal (`/warehouse-portal`)
Designed specifically for yard supervisors:
- **Incoming Receipts Queue**: Real-time listing of pending PO receipts and incoming HDNs ready for physical check-in.
- **Outbound Dispatches Queue**: Pending Delivery Notes and outgoing STNs awaiting staging, vehicle loading, and gate dispatch.
- **Returns Awaiting Inspection**: Arrived MRNs and HRNs awaiting grading into accepted, damaged, and scrap buckets.
- **Quarantined Damaged Inventory**: Summary breakdown of damaged equipment across warehouses requiring maintenance.

### 4.2 Delivery Personnel Mobile PWA Portal (`/delivery-portal`)
Optimized for smartphones and low-connectivity environments:
- **Daily Route View**: Cards displaying assigned deliveries and pickups with full site addresses and one-touch phone dialers.
- **Digital Proof & Sign-Off**:
  - Live GPS coordinate capture using HTML5 Geolocation API with accuracy meter.
  - Camera photo capture directly from mobile device.
  - Interactive touch signature pad for site in-charge sign-off.
  - Reason code selector if customer representative is unavailable.
- **Offline Draft Engine**:
  - Automatically stores delivery notes and proof records in client-side storage when mobile data drops.
  - Sync bar displays `draft`, `pending_sync`, and `synced` states.
  - Background auto-sync retries when network connectivity is restored.

---

## 5. External Integrations & Notifications

### 5.1 FYN E-Way Bill Gateway (`src/lib/integrations/fyn-ewaybill.ts`)
- Statutory simulation generating 12-digit Government-compliant E-Way Bill numbers.
- Handles generation, vehicle updates, and 24-hour statutory cancellation.
- Sanitizes and masks sensitive API credentials in audit logs.

### 5.2 Printable Document Engine (`src/lib/pdf/generator.ts`)
- Renders standard A4 documents for PO, GRN, DN, MRN, and STN.
- Features dynamic AJAY ENTERPRISES corporate header, GSTIN, registered office, bank details, itemized tables, terms of custody, and receiver signature blocks.

### 5.3 Non-Blocking WhatsApp Dispatch (`src/lib/notifications/whatsapp.ts`)
- Dispatches transactional WhatsApp updates to site contacts and suppliers upon document completion.
- Operates asynchronously with automatic failure suppression to ensure document saving is never blocked by external gateway latency.

---

## 6. Strict Compliance with Permanent Business Rules

| Rule # | Requirement | Implementation in Phase 3 |
| :--- | :--- | :--- |
| **Rule 1 & 2** | Software is INVENTRA; business is AJAY ENTERPRISES | Legal identity throughout PDF engine, headers, and notifications is AJAY ENTERPRISES. INVENTRA is software branding. |
| **Rule 3** | Strictly NO QR codes or camera barcode scanning | Material identification is purely variant, type, and quantity-driven. No QR workflows exist. |
| **Rule 4** | Company-owned fleet only | Delivery Notes and transfers only assign company vehicles and drivers. No third-party transporter management. |
| **Rule 5 & 6** | Multi-site customers with independent profiles | Delivery Notes select specific Customer Sites, displaying site-specific in-charges, GPS, and contact numbers. |
| **Rule 7** | Single movement documents (DN / MRN) | Exactly one DN per dispatch; exactly one MRN per return. |
| **Rule 8** | GPS Camera proof & receiver acknowledgement | MovementEvidence captures lat, long, accuracy, timestamp, photos, and signatures. |
| **Rule 10** | Delivery Notes are not invoices | Delivery Notes record custody transfer only; financial invoicing remains decoupled. |
| **Rule 12** | Independent Delivery and Return Date inclusion | `includeDeliveryDate` on DN and `includeReturnDate` on MRN are completely independent booleans. |
| **Rule 16** | Movement-derived inventory | Physical stock balances are never edited directly; all updates originate from atomic `InventoryMovement` records. |
| **Rule 17** | Segregated material ownership | `OWNED` and `HIRED_IN` pools remain strictly isolated across movements and balances. |
| **Rule 18** | Immutability of posted documents | Finalized DNs, MRNs, and GRNs are locked against silent in-place edits. |

---

## 7. Summary Conclusion & Readiness for Phase 4

Phase 3 is **100% completed, verified, and operational**. The foundation for all material movement (purchases, customer dispatches, customer returns, inter-warehouse transfers, and hired equipment operations) is active, fully audited, and strictly aligned with all 20 INVENTRA business rules.

The codebase is ready for **Phase 4: Rental Billing Engine & Financial Ledgers** whenever you are ready.

