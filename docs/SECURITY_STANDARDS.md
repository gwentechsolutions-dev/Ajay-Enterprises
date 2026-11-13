# INVENTRA – Security Architecture & Compliance Standards

**Document Version**: 1.0  
**Operating Business**: AJAY ENTERPRISES  
**Software Brand**: INVENTRA  
**Compliance Baseline**: Indian IT Act, Indian GST Rules, Companies Act Retention Standards  
**Security Model**: Zero-Trust, Least-Privilege RBAC + Granular Record Scope  
**Reference Document**: Master Blueprint v1.0 (`docs/references/INVENTRA_Master_Software_Blueprint_v1.0.pdf`)

---

## 1. Threat Modeling & ERP Risk Profile

As a commercial ERP managing multi-crore capital assets, rental contracts, cash/bank flows, and statutory tax obligations, INVENTRA is subject to specific threat vectors:

| Threat Vector | Potential Impact | INVENTRA Architectural Countermeasure |
| :--- | :--- | :--- |
| **Silent Document Alteration** | Disputed billing, audit failure, tax non-compliance | Immutable document snapshots with SHA-256 checksums; reversal-only accounting entries; audit event logging. |
| **Unauthorized Stock Write-off** | Theft or pilferage of centering props/plates | Mandatory dual-approval workflow for stock adjustments; physical count variance approval controls. |
| **GPS Evidence Spoofing** | Driver falsely marking delivery without reaching site | Dual validation of hardware GPS coordinates, accuracy threshold checks ($\le 50\text{m}$), and comparison with registered site coordinates. |
| **KYC / Bank Detail Leak** | Identity theft, fraud, regulatory penalties | Private S3 object storage; short-lived pre-signed URLs; AES-256 encryption for sensitive tax/bank data; role-restricted downloads. |
| **Concurrent Dispatches Over-committing Stock** | Negative warehouse balances, operational gridlock | Row-level database locks (`SELECT ... FOR UPDATE`) during dispatch confirmation within atomic transactions. |
| **Duplicate E-Way Bill Generation** | Commercial penalty from tax authorities | Idempotency keys and reconciliation verification before retrying FYN Gateway EWB generation. |

---

## 2. Authentication, Session & Supabase Security

1. **Authentication via Supabase Auth**:
   - Password hashing, salting, credential verification, and account recovery are managed by **Supabase Auth**.
   - INVENTRA application database never stores plaintext passwords or custom password hashes (`passwordHash` removed).
   - Strict password complexity enforcement (minimum 8 characters, requiring uppercase, lowercase, and numbers).
   - Rate limiting and brute-force protection managed at the Supabase Auth edge.
2. **Session Architecture (@supabase/ssr)**:
   - Secure, `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS in production) session cookies managed via `@supabase/ssr`.
   - Seamless server-side token verification and automatic refresh in Next.js middleware.
   - User profile identity linked via `auth.users.id <-> User.supabaseId`.
   - Inactive or deactivated accounts are blocked server-side regardless of token validity.
3. **Database Row Level Security (RLS)**:
   - Row Level Security (RLS) is enabled across all ERP tables.
   - Server-side Next.js route handlers and server actions operate via the backend service role key, enforcing INVENTRA RBAC in application logic before executing database transactions.
   - Direct client writes to sensitive ERP tables are blocked.
   - Append-only immutability trigger prevents any UPDATE or DELETE mutations on `AuditEvent` logs.
4. **Private Object Storage Security (Supabase Storage)**:
   - All files, signatory assets, KYC documents, and GST certificates are stored in private Supabase Storage buckets (`inventra-private-documents`).
   - Server-side authorization enforces MIME whitelisting (`image/png`, `image/jpeg`, `image/webp`, `application/pdf`) and 10MB size limits.
   - Files are addressed via UUID-derived paths and SHA-256 checksums.
   - Client access uses short-lived pre-signed download URLs (default 300s TTL). Public bucket access is strictly disabled.

---

## 3. Role-Based Access Control (RBAC) & Record-Level Scopes

INVENTRA employs a **Dual-Layer Access Control Model**: Role-Based Permissions + Granular Record-Level Scope.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ACCESS CONTROL EVALUATION                       │
├────────────────────────────────────────────────────────────────────────┤
│  1. Does the User Role possess the Permission? (e.g. `dn:confirm`)     │
│       ├── NO  ──> HTTP 403 Forbidden                                   │
│       └── YES ──> Proceed to Step 2                                    │
│  2. Does the User Scope encompass the Target Record?                   │
│       ├── ALL_BUSINESS       ──> Access Granted                        │
│       ├── ASSIGNED_WAREHOUSE ──> Matches record warehouse?             │
│       ├── ASSIGNED_SITE      ──> Matches record customer site?         │
│       └── ASSIGNED_DELIVERY  ──> Matches assigned driver/vehicle ID?   │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Portal Role Permissions Matrix

| Module / Action | Owner / Super Admin | Office / Operations | Accountant | Warehouse Staff | Delivery Personnel | Labour Supervisor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Executive Dashboard & P&L** | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Company Profile & Bank Setup** | ✅ Full | ❌ Denied | 👁 View Only | ❌ Denied | ❌ Denied | ❌ Denied |
| **Customer & Site Master** | ✅ Full | ✅ Create/Edit | 👁 View Only | 👁 View Only | 👁 Assigned Only | ❌ Denied |
| **Item Master & Rental Rates** | ✅ Full | 👁 View Only | 👁 View Only | 👁 View Only | ❌ Denied | ❌ Denied |
| **Delivery Note: Create/Stage** | ✅ Full | ✅ Full | ❌ Denied | ✅ Pick/Load | ❌ Denied | ❌ Denied |
| **Delivery Note: Complete Proof** | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied | ✅ Assigned Only | ❌ Denied |
| **Return Note: Inspection/Posting**| ✅ Full | 👁 View Only | ❌ Denied | ✅ Inspect/Post | ❌ Denied | ❌ Denied |
| **Rental Billing Engine Run** | ✅ Full | ❌ Denied | ✅ Execute | ❌ Denied | ❌ Denied | ❌ Denied |
| **Invoice Finalize & Posting** | ✅ Full | ❌ Denied | ✅ Finalize | ❌ Denied | ❌ Denied | ❌ Denied |
| **General Ledger & Journals** | ✅ Full | ❌ Denied | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied |
| **FYN E-Way Bill Generation** | ✅ Full | ✅ Generate | ✅ Generate | ❌ Denied | ❌ Denied | ❌ Denied |
| **Stock Count Variance Approval** | ✅ Approval | ❌ Denied | ❌ Denied | 📝 Count Input | ❌ Denied | ❌ Denied |
| **Labour Attendance & Wages** | ✅ Full | ❌ Denied | 👁 View Only | ❌ Denied | ❌ Denied | ✅ Daily Roster |

---

## 4. Document Immutability & Tamper-Evident Auditing

### 4.1 Historical Document Snapshot Rules
To ensure legal and tax defensibility:
- When any commercial or movement document (Tax Invoice, Delivery Note, Material Return Note, Stock Transfer Note) is marked `FINALIZED` or `ISSUED`:
  1. The server serializes the entire document context into an immutable JSONB `snapshot_payload`.
  2. The PDF document is rendered and stored in private S3 storage.
  3. A cryptographic **SHA-256** checksum is calculated and stored in `document_hash`.
  4. Subsequent edits to the record are blocked by database trigger and backend middleware.
  5. If an issued invoice requires amendment, it must be adjusted via a formally issued **Credit Note** or **Debit Note**.

### 4.2 Comprehensive System Audit Trail (`audit_events`)
All critical operations are logged in an append-only audit log:
- **Captured Attributes**: `actor_user_id`, `actor_ip_address`, `actor_user_agent`, `action`, `entity_type`, `entity_id`, `before_state`, `after_state`, `change_reason`, `timestamp`.
- **Monitored Events**:
  - Stock adjustments and count reconciliations.
  - Delivery Note completion and receiver signature.
  - Invoice issuance, cancellation, or credit note creation.
  - Manual journal entries and period locks.
  - KYC/PAN/bank account downloads or changes.
  - FYN E-Way Bill generation and cancellation.

---

## 5. Storage Security & File Upload Hardening

All uploaded files (site photos, receiver signatures, customer PAN/GST certificates, signed lease agreements) undergo strict validation:

1. **Private S3 Storage**:
   - Buckets have **Block All Public Access** permanently enabled.
   - Files are accessed exclusively via **time-limited pre-signed URLs** (default expiration: 15 minutes).
2. **Multi-Stage Upload Validation**:
   - **MIME-Type Whitelisting**: Strictly allow `image/jpeg`, `image/png`, `application/pdf`.
   - **Magic-Byte Inspection**: Server validates the binary file header to prevent renamed executable payloads.
   - **File Size Limits**: Maximum 10MB per document/photo; maximum 2MB for signatures/stamps.
   - **Filename Sanitization**: Files are saved under randomized UUIDv7 keys in S3 (e.g. `s3://inventra-private/sites/site_id/uuidv7.jpg`), stripping original client filenames.

---

## 6. GPS Proof & Anti-Spoofing Mitigations

Field delivery photos serve as legal evidence of custody transfer. INVENTRA enforces anti-spoofing measures:

1. **Hardware Geolocation Capture**:
   - Geolocation is read directly from `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`.
   - The capture timestamp is taken from the server-synchronized clock, not the client's local system clock.
2. **Accuracy Validation**:
   - GPS readings with reported horizontal accuracy $> 100\text{ meters}$ prompt the driver to move to an open area for a clearer satellite fix.
3. **Site Distance Discrepancy Detection**:
   - The server computes the distance between the photo GPS coordinates and the registered site coordinates using PostGIS:
     ```sql
     ST_Distance(captured_location, site_registered_location)
     ```
   - If the discrepancy exceeds $500\text{ meters}$, the delivery is accepted but automatically flagged as `GPS_DISCREPANCY_FLAGGED` on the Office Manager's dashboard for verification.

---

## 7. Data Retention & Statutory Compliance

Under the **Indian Companies Act, 2013** and **GST Act, 2017**:
- All financial books of account, invoices, vouchers, credit/debit notes, and movement registers must be retained in an accessible, verifiable state for **at least 8 financial years**.
- Database backups are archived with write-once-read-many (WORM) storage retention policies to prevent accidental or malicious deletion.

