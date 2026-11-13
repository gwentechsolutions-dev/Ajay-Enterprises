# INVENTRA – UI/UX Design System & Component Standards

**Document Version**: 1.0  
**Operating Business**: AJAY ENTERPRISES  
**Software Brand**: INVENTRA  
**Visual Identity Reference**: Official INVENTRA Logo (`assets/inventra-logo.png`)  
**Design Paradigm**: Modern SaaS ERP, Accessible, Mobile-First PWA for Field Staff  
**Reference Document**: Master Blueprint v1.0 (`docs/references/INVENTRA_Master_Software_Blueprint_v1.0.pdf`)

---

## 1. Visual Brand Identity & Color System

The visual design system of INVENTRA is anchored in the official **INVENTRA** logo, pairing industrial authority with high-contrast usability for construction operations.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INVENTRA COLOR PALETTE                          │
├───────────────────┬───────────────────┬──────────────────┬─────────────┤
│   Primary Navy    │   Accent Orange   │  Neutral Slate   │   Emerald   │
│     #0B1E36       │      #F26522      │     #64748B      │   #10B981   │
│ (Brand Authority) │(Action/Attention) │  (Text/Borders)  │  (Success)  │
└───────────────────┴───────────────────┴──────────────────┴─────────────┘
```

### 1.1 Color Tokens & CSS Variables

```css
:root {
  /* Brand Primary: Deep Industrial Navy */
  --color-primary-950: #050d18;
  --color-primary-900: #0b1e36; /* Brand Primary Base */
  --color-primary-800: #132f54;
  --color-primary-700: #1b4173;
  --color-primary-600: #25589a;
  --color-primary-100: #e2eaf4;
  --color-primary-50:  #f0f4f9;

  /* Brand Accent: Construction Safety Orange */
  --color-accent-600:  #d84f11;
  --color-accent-500:  #f26522; /* Brand Accent Base */
  --color-accent-400:  #f8824a;
  --color-accent-100:  #fee8dc;
  --color-accent-50:   #fff5f0;

  /* Neutrals: Cool Slate */
  --color-slate-900:   #0f172a; /* Primary Typography */
  --color-slate-700:   #334155; /* Secondary Typography */
  --color-slate-500:   #64748b; /* Muted Text & Icons */
  --color-slate-300:   #cbd5e1; /* Borders & Dividers */
  --color-slate-100:   #f1f5f9; /* Table Headers / Card BG */
  --color-slate-50:    #f8fafc; /* Canvas / Application BG */
  --color-white:       #ffffff;

  /* Semantic Feedback Tokens */
  --color-success:     #10b981; /* Confirmed Dispatches / Good Stock */
  --color-warning:     #f59e0b; /* In Repair / Overdue Invoices */
  --color-danger:      #ef4444; /* Missing Stock / Scrapped / Errors */
  --color-info:        #0284c7; /* In Transit / Info Callouts */
}
```

---

## 2. Typography & Spatial Hierarchy

- **Primary Font Family**: `Inter`, `Plus Jakarta Sans`, or system sans-serif.
- **Monospace Font Family**: `JetBrains Mono` or `Fira Code` (strictly for document numbers like `DN-2026-0001`, GSTINs, PANs, and currency amounts).

### Type Scale
- **H1 / Page Titles**: `text-2xl font-bold tracking-tight text-slate-900` (24px / 1.5rem)
- **H2 / Section Headings**: `text-lg font-semibold text-slate-800` (18px / 1.125rem)
- **H3 / Card Titles**: `text-sm font-semibold uppercase tracking-wider text-slate-500` (12px / 0.75rem)
- **Body Regular**: `text-sm font-normal text-slate-700 leading-relaxed` (14px / 0.875rem)
- **Muted / Helper Text**: `text-xs text-slate-500` (12px / 0.75rem)
- **Table Data Cells**: `text-sm text-slate-800 tabular-nums`

---

## 3. Mandatory Dropdown & Form Component Standards

### 3.1 Strict Prohibition of Native Dropdowns
> **MANDATORY DIRECTIVE**: Outdated native browser dropdowns (`<select>`) are strictly prohibited across all primary application interfaces. All selections must use modern, accessible, styled combobox components.

### 3.2 Searchable Combobox (`SearchableCombobox`)
Used for selecting customers, construction sites, material variants, vehicles, and accounts.
- **UX Behaviors**:
  - Displays a clean button displaying the currently selected value or placeholder.
  - Clicking opens an animated Popover containing a live search input (`CommandInput`).
  - Filtering is instantaneous and debounced.
  - Highlights matching query substrings.
  - Supports keyboard navigation (Up/Down arrow keys, Enter to select, Escape to dismiss).
  - Displays a clear button `(X)` to reset selection when nullable.
  - Displays a helpful empty state: *"No matching item found. Create new item?"*.

```tsx
// Architectural Specification: SearchableCombobox Component Interface
interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string; // e.g., Site address or Item HSN
  badge?: string;    // e.g., "Active", "Registered"
  disabled?: boolean;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}
```

### 3.3 Multi-Select Tag Input (`MultiSelectCombobox`)
Used for selecting multiple site contacts, material categories, or document filters.
- Selected items appear as removable pill badges (`bg-primary-50 text-primary-900 border border-primary-200`) with an inline dismiss `(x)` icon.
- Features a "Clear All" action and remaining count counter (e.g., `+3 more`).

### 3.4 Modern Date & Date-Range Pickers (`DatePicker`, `DateRangePicker`)
- Built using accessible calendar grids (Radix Popover + `react-day-picker`).
- Supports quick presets: *Today*, *Yesterday*, *This Month*, *Previous Month*, *Current Financial Year*.
- Displays dates formatted in Indian format: `DD MMM YYYY` (e.g., `12 Nov 2026`).

---

## 4. Form Ergonomics & Validation Feedback

Every form in INVENTRA must comply with the following structural rules:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FORM FIELD ANATOMY                              │
├────────────────────────────────────────────────────────────────────────┤
│  Field Label * (Required Indicator)             Optional Helper Tooltip│
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │ Input Control / Searchable Combobox                           │     │
│  └───────────────────────────────────────────────────────────────┘     │
│  ℹ Helper text / Field format guideline                                │
│  ⚠ Inline validation error message (in red text-xs with icon)          │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Labels & Indicators**:
   - Every input has a visible, high-contrast label.
   - Required fields feature a distinct red asterisk (`<span className="text-red-500">*</span>`).
   - Optional fields feature a subtle `(Optional)` suffix.
2. **Helpful Placeholders**:
   - Provide concrete examples, e.g. Phone: `98765 43210`, GSTIN: `29AAAAA0000A1Z5`, Rate: `0.00`.
3. **Inline Validation**:
   - Errors display immediately beneath the input in `text-xs text-red-600` with an alert circle icon.
   - The input border changes to `border-red-500 ring-1 ring-red-500`.
4. **Submission State**:
   - Submit buttons display a loading spinner (`LucideLoader2 animate-spin`) during network calls.
   - Buttons are automatically disabled during submission to prevent duplicate form submissions.
5. **Toast Notifications**:
   - Success: Green banner confirming action with document number link.
   - Error: Red banner providing actionable error description from backend Zod validation.

---

## 5. Modern Data Table Standards (`DataTable`)

All ERP registers (Deliveries, Returns, Invoices, Ledgers, Item Master) use TanStack Table v8:
- **Sticky Headers**: Headers remain pinned during vertical scrolling.
- **Sorting**: Multi-column ascending/descending sort indicators on clickable headers.
- **Global & Column Search**: Instant text search across key fields.
- **Column Visibility Manager**: Users can customize and save visible columns.
- **Row Density Toggle**: Compact mode for high-volume ledger viewing; Comfort mode for general browsing.
- **Pagination**: Server-side pagination with rows-per-page selector (10, 25, 50, 100).
- **Row Action Menu**: Three-dot dropdown menu providing View, Edit, Print PDF, Share WhatsApp, and Audit History actions.

---

## 6. Mobile-First Field PWA Interfaces

Field workflows for Delivery Personnel and Labour Supervisors must be optimized for handheld mobile devices:

```
┌─────────────────────────────────────────┐
│ [INVENTRA] Delivery Trip DN-2026-0042   │
├─────────────────────────────────────────┤
│ Site: Prestige Sunrise Tower B          │
│ Contact: Suresh (Site PM) 9876543210    │
│ [Tap to Call] [Navigate with Maps]      │
├─────────────────────────────────────────┤
│ Assigned Material Checklist:            │
│  ☑ Steel Props 2x3m  (Qty: 100)         │
│  ☑ Beam Sapan 8ft    (Qty: 40)          │
├─────────────────────────────────────────┤
│ 📷 CAPTURE SITE PROOF                   │
│ [ Take GPS Camera Photo ]               │
│ • GPS Lat: 12.9716, Lng: 77.5946 (±4m)  │
│ • Timestamp: 12 Nov 2026, 02:45 PM      │
├─────────────────────────────────────────┤
│ ✍ RECEIVER ACKNOWLEDGEMENT              │
│ Receiver Name: [ R. K. Sharma        ]  │
│ Mobile:        [ 9845012345          ]  │
│ Designation:   [ Site In-Charge      ]  │
│ [ Touch Signature Canvas Area ]         │
├─────────────────────────────────────────┤
│ [ SUBMIT COMPLETED DELIVERY (OFFLINE OK)]│
└─────────────────────────────────────────┘
```

- **Touch Targets**: Minimum 48px height for all buttons and interactive controls.
- **Single-Hand Ergonomics**: Primary action buttons pinned to the sticky bottom drawer.
- **Integrated Camera Viewfinder**: Direct integration with device camera capturing full-resolution uncompressed image + EXIF GPS metadata.
- **HTML5 Canvas Signature Pad**: Smooth vector signature capture with clear and undo buttons.

---

## 7. Interactive Geographical Heatmap Specification

The Owner Dashboard includes an interactive geospatial inventory heatmap:

```
┌────────────────────────────────────────────────────────────────────────┐
│ INVENTRA INVENTORY GEOGRAPHICAL HEATMAP                                │
├────────────────────────────────────────────────────────────────────────┤
│ [Metric: Total Material Qty ▼] [Filter: All Categories ▼] [Zoom: City] │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │  (Map Canvas with PostGIS Points & Clusters)                       │ │
│ │                                                                    │ │
│ │           ● [Yard 1: 45,000 units]                                 │ │
│ │                                                                    │ │
│ │                 ★ [Site: Prestige Sunrise (1,250 units)]           │ │
│ │                                                                    │ │
│ │       ★ [Site: Metro Mall (3,400 units)]                           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ Selected Site Drawer: Prestige Sunrise Tower B                         │
│ • Customer: ABC Infratech Pvt Ltd        • Daily Rent: ₹3,750 / day    │
│ • Current Props: 850 | Sapan: 400        • Replacement Value: ₹18.5L   │
│ • Active Days on Site: 42 days           • [View Site Details / Ledger]│
└────────────────────────────────────────────────────────────────────────┘
```

- **Clustering**: Automatically groups nearby sites into cluster circles at high zoom levels; expands into individual site pins at street level.
- **Metric Toggles**:
  1. Material Quantity (count of items at site)
  2. Replacement Value Exposure (₹ risk of lost/damaged material)
  3. Daily / Monthly Rental Accrual (₹ revenue generated per day)
  4. Days on Site (aging of material at site)
- **Site Drawer**: Clicking a pin slides out a detailed side-sheet with current inventory breakdown, site contacts, open delivery notes, and direct links to billing and returns.

