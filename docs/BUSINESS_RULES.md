# INVENTRA – Permanent Business Rules & Operational Logic

**Document Version**: 1.0  
**Operating Business**: AJAY ENTERPRISES  
**Software Brand**: INVENTRA  
**Classification**: Core Business Logic & Rule Engine Specification  
**Reference Document**: Master Blueprint v1.0 (`docs/references/INVENTRA_Master_Software_Blueprint_v1.0.pdf`)

---

## 1. The 20 Permanent Business Rules

The following rules represent permanent operational and architectural constraints. They must be enforced across all UI screens, backend APIs, and database transactions:

1. **Software Name**: The application is **INVENTRA**.
2. **Business Name**: The operating commercial entity is **AJAY ENTERPRISES**. All legal documents, invoices, vouchers, and WhatsApp notifications must represent AJAY ENTERPRISES. The INVENTRA logo is for application branding only.
3. **No QR Codes**: Strictly **NO** QR-code scanning or QR-based material tracking workflows. Centering materials are tracked via robust quantity/count movements.
4. **Owned Fleet Only**: All delivery and transport vehicles are **company-owned**. Do not implement third-party or hired-vehicle fleet management.
5. **Customer & Multi-Site Separation**: One customer can own or manage **unlimited independent construction sites**. Customer and Site are strictly separate entities.
6. **Site Independence**: Each site maintains its own site owner, contacts, address, delivery instructions, reference photos, and document attachments.
7. **Single Movement Documents**: Exactly one **Delivery Note (DN)** per dispatch. Exactly one **Material Return Note (MRN)** per return.
8. **Delivery Proof with GPS & Signature**: Every Delivery Note requires captured in-app photographs with embedded GPS metadata (coordinates, timestamp, accuracy) and receiver signature/acknowledgement.
9. **Automated WhatsApp Sharing**: Completed Delivery Notes and generated E-Way Bills must automatically be transmitted to configured authorised customer contacts via WhatsApp.
10. **Delivery Notes Are Not Invoices**: Delivery Notes represent material custody transfer, never an automated sale or tax invoice.
11. **Monthly Consolidated Rental Billing**: Rental billing is calculated on a monthly cycle derived from daily material balances across the month.
12. **Independent Delivery & Return Date Inclusion**: "Include Delivery Date" and "Include Return Date" are two completely separate Boolean settings. They must never be combined into a single toggle.
13. **Dual GST & Non-GST Customer Records**: Both GST-registered and unregistered/non-GST customers are fully supported in customer masters and ledgers.
14. **Customer Status Does Not Determine Taxability**: An unregistered or non-GST customer record does **not** make a transaction tax-free. Taxability is determined by the supply classification and accountant-configured tax rules.
15. **Strict Double-Entry General Ledger**: All financial transactions must generate balanced debits and credits in the General Ledger ($\sum \text{Debits} = \sum \text{Credits}$).
16. **Movement-Derived Inventory**: Stock quantities are calculated projections derived from an immutable, append-only movement ledger. Stock cannot be directly edited.
17. **Distinguishable Ownership Buckets**: Materials owned by AJAY ENTERPRISES, materials hired-in from third-party suppliers, and customer custody materials must remain strictly segregated.
18. **Immutability of Finalised Documents**: Finalised invoices, completed delivery notes, posted journal entries, and signed agreements cannot be deleted or silently edited.
19. **Configurable Company Profile**: Bank accounts, addresses, GSTIN, signatories, seals, and numbering sequences must be editable in settings and never hardcoded.
20. **Shared Central Entities**: All modules must use common customer, site, inventory, accounting, and permission records.

---

## 2. Customer & Multi-Site Master Logic

### 2.1 Multi-Site Architecture
In construction centering rental, builders operate across multiple project sites simultaneously.
- A **Customer** represents the billing entity (company, proprietor, or contractor) holding the financial relationship, credit limit, and legal tax identity.
- A **Construction Site** represents the physical delivery destination, possessing:
  - Distinct geographical address, state code, PIN code, and GPS coordinate point.
  - Distinct operational hours, access routes, and crane/unloading instructions.
  - Independent status: `ACTIVE`, `ON_HOLD`, `CLOSED_SETTLED`.

```mermaid
graph TD
    C[Customer: ABC Infratech Pvt Ltd]
    C --> S1[Site 1: Sky High Tower - Bangalore]
    C --> S2[Site 2: Green Valley Villas - Whitefield]
    C --> S3[Site 3: Metro Mall - Electronic City]
    
    S1 --> SO1[Site Owner: Landowner A]
    S1 --> SC1[Contacts: PM, Engineer, Storekeeper]
    S1 --> DOC1[Documents: Site Photos, Access Route]
    
    S2 --> SO2[Site Owner: ABC Infratech (Self)]
    S2 --> SC2[Contacts: Site Supervisor B]
```

### 2.2 Site Owner vs Customer Distinction
The property owner of a construction site is frequently not the builder renting the materials (e.g., Joint Development Agreements between landowners and developers).
- The system must capture whether the site owner is the customer or a distinct entity.
- If distinct, capture owner legal name, type, contact details, and optional consent/authorization documents.
- **Rule**: Never assume the property owner is the customer or an authorized material receiver without explicit authorization.

### 2.3 Site Contact Roles & Permissions
Site-specific contacts are external individuals with designated authorizations:
- `can_receive_goods`: Authorized to physically accept dispatches.
- `can_sign_delivery_notes`: Authorized to sign receiver acknowledgement on the mobile PWA.
- `can_request_returns`: Authorized to initiate material pickup requests.
- `can_approve_transfers`: Authorized to approve inter-site material transfers.
- `can_receive_invoices`: Authorized to receive monthly rental statements and invoices via WhatsApp/Email.

---

## 3. Material Ownership & Inventory Movement Logic

### 3.1 The Three Ownership Buckets
Centering rental businesses frequently supplement their own stock by hiring materials from other suppliers during peak construction seasons. INVENTRA enforces three segregated ownership buckets:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MATERIAL INVENTORY POOL                         │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ OWNED_AJAY_ENTERPRISES   │ HIRED_IN (3rd-Party)    │ THIRD_PARTY       │
│ • Capital assets         │ • Rented from supplier  │ • Customer stock  │
│ • Full equity ownership  │ • Incur hire cost       │   temporarily in  │
│ • Depreciated in GL      │ • Return liability      │   yard custody    │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

1. **Owned by AJAY ENTERPRISES**: Core capital assets.
2. **Hired-In (Third-Party Supplier)**: Materials leased by AJAY ENTERPRISES from another rental company. Must track supplier identity, daily hire cost, hire period start/end, and return obligations. Hired-in materials can be rented out to customers, but must remain distinguishable at all times to calculate gross rental margin and return liabilities.
3. **Third-Party Custody**: Customer-owned materials temporarily held in an AJAY ENTERPRISES yard for maintenance, cleaning, or storage.

### 3.2 The Stock Balance Equation
Inventory balances are never static database fields. They are calculated projections derived from the append-only `stock_movements` ledger:

$$\text{Closing Stock} = \text{Opening} + \text{Receipts (GRN)} + \text{Returns (MRN)} + \text{Transfers In} - \text{Dispatches (DN)} - \text{Transfers Out} - \text{Scrap/Damaged} \pm \text{Approved Adjustments}$$

- **Custody vs Sale**: A Delivery Note (DN) reduces warehouse available stock and increases customer-site custody stock. It is **never** a sale of goods.
- **No Negative Stock**: The system prohibits committing a dispatch that would cause warehouse available stock to become negative, unless an authorized manager override is logged with written justification.

---

## 4. Monthly Rental Billing Engine Specification

The monthly rental billing engine is the core commercial engine of INVENTRA.

### 4.1 Independent Delivery & Return Date Inclusion Rules
The inclusion or exclusion of the dispatch date and return date significantly impacts billable day calculations. INVENTRA maintains two separate Boolean rules:
- `include_delivery_date` (Boolean: `TRUE` / `FALSE`)
- `include_return_date` (Boolean: `TRUE` / `FALSE`)

#### Precedence Hierarchy:
$$\text{Line/Transaction Override} > \text{Site Rule} > \text{Customer Rule} > \text{Business Default}$$

#### The Four Combinations:
| Delivery Day Included? | Return Day Included? | Industry Application / Meaning |
| :---: | :---: | :--- |
| **TRUE** | **FALSE** | **Standard Centering Practice**: Bill from the day material arrives at site; stop billing on the day before return pickup (pickup day is free for return loading). |
| **TRUE** | **TRUE** | **Strict Full-Day Policy**: Both arrival day and departure day are billed. |
| **FALSE** | **TRUE** | **Unloading Grace Period**: Arrival day is free for truck unloading; rental starts next morning; return day is billed. |
| **FALSE** | **FALSE** | **Generous Contractor Terms**: Neither dispatch day nor return day is charged. |

### 4.2 Core Billing Formula & Interval Calculation
For each active customer, site, item variant, and ownership source:

$$\text{Rental Charge} = \sum_{\text{day} \in \text{Billing Period}} \left( \text{Quantity Held on day} \times \text{Effective Daily Rate} \right)$$

#### Interval Boundaries:
- **Delivery Date ($D$)**:
  - If `include_delivery_date == TRUE`: Rental accrual starts on date $D$.
  - If `include_delivery_date == FALSE`: Rental accrual starts on date $D + 1\text{ day}$.
- **Return Date ($R$)**:
  - If `include_return_date == TRUE`: Rental accrual ends on date $R$.
  - If `include_return_date == FALSE`: Rental accrual ends on date $R - 1\text{ day}$.
- **Cutoff Date**: For unreturned material at month-end, the interval ends at the billing period cutoff (e.g. 30th/31st of the month).

#### Golden Calculation Example:
- **Scenario**: 100 props delivered on Day 5. 20 props returned on Day 20. Month ends on Day 30.
- **Rule**: `include_delivery_date = TRUE`, `include_return_date = FALSE`.
- **Interval 1 (100 props)**:
  - Start: Day 5. End: Day 19 (Return day 20 is excluded for the 20 returned units).
  - Billable days: $19 - 5 + 1 = 15\text{ days}$.
  - Charge: $20\text{ props} \times 15\text{ days} \times \text{Rate}$.
- **Interval 2 (80 props remaining)**:
  - Start: Day 5. End: Day 30 (month cutoff).
  - Billable days: $30 - 5 + 1 = 26\text{ days}$.
  - Charge: $80\text{ props} \times 26\text{ days} \times \text{Rate}$.
- **Total Rental**: $(20 \times 15 \times \text{Rate}) + (80 \times 26 \times \text{Rate})$.

### 4.3 Same-Day Delivery and Return Edge Case
If material is delivered and returned on the very same day ($D = R$):
- If `include_delivery_date == TRUE` AND `include_return_date == TRUE`: Billable days = 1 day.
- If `include_delivery_date == TRUE` AND `include_return_date == FALSE`: Billable days = 0 days (or minimum 1-day rental if specified in the rental contract).
- The engine must strictly ensure that billable days $\ge 0$ and never produce a negative day count.

### 4.4 Duplicate Billing Prevention
To guarantee that no customer is billed twice for the same material interval:
- The `billing_coverages` table stores exact date ranges (`billed_start_date` to `billed_end_date`) linked to each `accrual_interval_id`.
- A database unique constraint (`accrual_interval_id, billed_start_date, billed_end_date`) physically prevents overlapping invoices.

---

## 5. Double-Entry Accounting Posting Matrix

Every commercial transaction in INVENTRA maps directly to balanced debits and credits in the General Ledger:

| Business Event | Debit Account | Credit Account | Statutory / Narration Note |
| :--- | :--- | :--- | :--- |
| **Rental Invoice Posted** | Customer Accounts Receivable | Rental Revenue Account<br/>Output CGST Payable<br/>Output SGST / IGST Payable | Recognized upon invoice finalization; splits GST liability based on place of supply. |
| **Customer Payment Received** | Cash / Bank Account | Customer Accounts Receivable (or Customer Advance Liability) | Bank UTR / Cheque reference recorded; allocated against outstanding invoices. |
| **Security Deposit Received** | Cash / Bank Account | Refundable Security Deposit Liability | Treated as balance-sheet liability, never recognized as revenue. |
| **Purchase Invoice Posted** | Capital Equipment / Expense<br/>Input CGST / SGST Credit | Supplier Accounts Payable | Verified against Goods Receipt Note (GRN) 3-way match. |
| **Labour Wages Accrued** | Direct Labour Expense | Wages Payable Liability | Accrued weekly/monthly based on verified supervisor attendance logs. |
| **Labour Wages Paid** | Wages Payable Liability | Cash / Bank Account | Settled via bank transfer or cash voucher with worker signature. |
| **Supplier Hire Bill** | Hired Material Rental Expense | Supplier Accounts Payable | Leased centering equipment cost recognized. |
| **Damage Recovery Invoice** | Customer Accounts Receivable | Asset Damage Recovery Income<br/>Output GST Payable | Billed after physical yard inspection and accountant approval. |
| **Security Deposit Refund** | Refundable Security Deposit Liability | Cash / Bank Account | Requires site closure clearance and manager sign-off. |

---

## 6. Document Immutability & Historical Snapshot Rules

When any document (Delivery Note, Material Return Note, Tax Invoice, Rental Agreement) transitions to a finalized status:
1. **Payload Serialization**: The system captures an immutable JSON snapshot of all referenced master data:
   - Company profile (trade name, registered address, GSTIN, bank details).
   - Customer profile & site address as of the document date.
   - Exact line items, descriptions, dimensions, quantities, and rates.
   - Signatory name, designation, and stamp asset URLs.
2. **Cryptographic Checksum**: A SHA-256 hash is computed over the serialized payload and the generated PDF file.
3. **No Direct Mutation**: The database record is marked `FINALIZED`. Any subsequent modification requires:
   - For Invoices: Official Credit Note or Debit Note.
   - For Delivery Notes: Authorized Delivery Discrepancy Note or MRN Adjustment.
   - For Journal Entries: Reversal entry with documented reason.

---

## 7. Site Closure & Final Settlement Checklist

Closing a customer construction site requires completing a strict, multi-step settlement protocol:
1. **Material Reconciliation**:
   - Total Dispatched Quantity must equal Total Returned Quantity + Total Settled Missing/Scrapped Quantity.
   - If material remains at the site, the site **cannot** be closed unless an authorized manager logs a formal exception with a named responsible party.
2. **Final Rental Billing**:
   - Issue a final pro-rata rental invoice covering the period up to the final return date.
3. **Damage & Loss Resolution**:
   - Complete all pending return inspections.
   - Issue recovery claims or debit notes for unreturned or destroyed items.
4. **Deposit & Financial Settlement**:
   - Reconcile total payments, security deposits held, and total invoices.
   - Refund the balance deposit or recover outstanding dues.
5. **Settlement Certificate**:
   - Generate the **Site Clearance & Final Settlement Certificate**, signed by AJAY ENTERPRISES and the Customer.

