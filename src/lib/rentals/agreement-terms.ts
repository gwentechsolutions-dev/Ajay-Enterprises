// ==============================================================================
// INVENTRA - STANDARD RENTAL AGREEMENT TERMS & CONTRACTUAL CONDITIONS
// Operating Business: AJAY ENTERPRISES | Software: INVENTRA ERP
// Base Framework: Indian GST Regime, Companies Act, IT Act Electronic Contracts
// ==============================================================================

export interface RentalAgreementCondition {
  number: number;
  title: string;
  description: string;
}

export const STANDARD_RENTAL_CONDITIONS: RentalAgreementCondition[] = [
  {
    number: 1,
    title: "COMMENCEMENT & BILLING CYCLE",
    description:
      "Rental charges commence from the agreed date of dispatch from AJAY ENTERPRISES yards. Material rental statements are generated monthly on a calendar-month basis using actual daily material movement history.",
  },
  {
    number: 2,
    title: "DATE INCLUSION RULES",
    description:
      "'Include Delivery Date' and 'Include Return Date' are independent calculations. Inclusion precedence hierarchy strictly follows: Line Item Agreement > Site Policy > Customer Policy > Standard Default.",
  },
  {
    number: 3,
    title: "DAILY RENTAL ACCRUAL & CHARGES",
    description:
      "Rental charges accrue daily for each unit of centering material retained in customer custody at the designated construction site. Agreed daily rental rates are exclusive of applicable GST (CGST/SGST/IGST) unless explicitly stated.",
  },
  {
    number: 4,
    title: "PARTIAL MATERIAL RETURNS",
    description:
      "Partial returns of centering materials are permitted at any time via official Material Return Notes (MRN). Daily rental billing stops for returned quantities in FIFO order upon physical inspection and yard inward entry.",
  },
  {
    number: 5,
    title: "MATERIAL INSPECTION & ACCEPTANCE",
    description:
      "The Hirer is responsible for physical inspection of materials upon delivery. Acknowledging or signing the Delivery Note (DN) constitutes confirmation that all materials received are sound, complete, and serviceable for centering work.",
  },
  {
    number: 6,
    title: "DAMAGED MATERIAL RESPONSIBILITY",
    description:
      "Materials bent, cut, welded, distorted, or damaged beyond ordinary operational wear and tear shall be isolated during inward inspection. Standard repair, straightning, and welding charges will be debited to the Hirer's general ledger.",
  },
  {
    number: 7,
    title: "MISSING MATERIAL & REPLACEMENT CHARGES",
    description:
      "Centering materials lost, stolen, embedded in concrete, or unreturned upon site completion shall be billed at established catalog replacement values under HSN 7308 with applicable GST.",
  },
  {
    number: 8,
    title: "TRANSPORTATION & FREIGHT RESPONSIBILITY",
    description:
      "Dispatch delivery and site return haulage are company-fleet managed or charged as one-time freight services under SAC 9965. Transportation charges are billed as one-time line items and are never carried forward into monthly statements.",
  },
  {
    number: 9,
    title: "PAYMENT DUE DATES & COMMERCIAL TERMS",
    description:
      "Monthly Tax Invoices are payable within the agreed credit period (Net 15/30 Days from invoice date). Overdue accounts are subject to commercial credit hold and interest under applicable commercial regulations.",
  },
  {
    number: 10,
    title: "SECURITY DEPOSIT",
    description:
      "Security deposits paid by the Hirer are held in escrow/custody. Deposits shall be adjusted against unpaid rental statements, assessed damage claims, or refunded upon complete return of all materials.",
  },
  {
    number: 11,
    title: "SITE CLOSURE & FINAL SETTLEMENT",
    description:
      "Site rental accounts are closed only after 100% of dispatched materials are accounted for through return notes or formal loss settlements. Final No-Dues Clearance is issued upon full ledger reconciliation.",
  },
  {
    number: 12,
    title: "STATUTORY JURISDICTION & DISPUTE RESOLUTION",
    description:
      "This agreement is governed by the laws of India, the Indian Contract Act, and the Information Technology Act. In the event of any legal dispute, the competent civil courts of Chennai, Tamil Nadu shall have exclusive territorial jurisdiction.",
  },
];

/**
 * Returns formatted text of all contractual conditions for agreement generation.
 */
export function getFormattedAgreementConditions(customTermsText?: string | null): string {
  if (customTermsText && customTermsText.trim().length > 50) {
    return customTermsText.trim();
  }

  return STANDARD_RENTAL_CONDITIONS.map(
    (c) => `${c.number}. ${c.title}:\n${c.description}`
  ).join("\n\n");
}
