/**
 * Utility for intelligent, automated WhatsApp contact resolution and message formulation
 * for INVENTRA - AJAY ENTERPRISES.
 */

export interface ResolvedWhatsAppContact {
  phone: string | null; // Raw digits with country code (e.g. "919876543210")
  displayPhone: string | null; // Formatted for human display (e.g. "+91 98765 43210")
  recipientName: string | null;
  recipientRole: string | null; // e.g. "Customer WhatsApp", "Site In-Charge", "Customer Primary"
}

/**
 * Normalizes an Indian phone number string for WhatsApp `wa.me/<number>`
 */
export function normalizeWhatsAppNumber(rawPhone?: string | null): { phone: string; display: string } | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;

  let countryDigits = digits;
  if (digits.length === 10) {
    countryDigits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    countryDigits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    countryDigits = digits;
  } else if (digits.length > 10) {
    countryDigits = digits;
  } else {
    // Fewer than 10 digits
    return null;
  }

  const core = countryDigits.length >= 10 ? countryDigits.slice(-10) : countryDigits;
  const display = `+91 ${core.slice(0, 5)} ${core.slice(5)}`;
  return { phone: countryDigits, display };
}

/**
 * Intelligently extracts the designated phone number from customer, site, receiver, or supplier details.
 */
export function resolveDocumentWhatsAppContact(
  docType: "DN" | "MRN" | "INVOICE" | "BILL",
  doc: any
): ResolvedWhatsAppContact {
  if (!doc) {
    return { phone: null, displayPhone: null, recipientName: null, recipientRole: null };
  }

  // 1. Supplier Bills
  if (docType === "BILL") {
    const s = doc.supplier;
    const pri = normalizeWhatsAppNumber(s?.primaryMobile);
    if (pri) {
      return {
        phone: pri.phone,
        displayPhone: pri.display,
        recipientName: s?.contactPerson || s?.name || "Supplier",
        recipientRole: "Supplier Primary Mobile",
      };
    }
    const alt = normalizeWhatsAppNumber(s?.alternateMobile);
    if (alt) {
      return {
        phone: alt.phone,
        displayPhone: alt.display,
        recipientName: s?.contactPerson || s?.name || "Supplier",
        recipientRole: "Supplier Alternate Mobile",
      };
    }
    return { phone: null, displayPhone: null, recipientName: s?.name || "Supplier", recipientRole: null };
  }

  // 2. Customer Documents (DN, MRN, INVOICE)
  const cust = doc.customer;
  const site = doc.customerSite;
  const contact = doc.contactPerson;

  // Priority A: Customer explicit WhatsApp number
  const custWa = normalizeWhatsAppNumber(cust?.whatsappNumber);
  if (custWa) {
    return {
      phone: custWa.phone,
      displayPhone: custWa.display,
      recipientName: cust?.name || "Customer",
      recipientRole: "Customer WhatsApp",
    };
  }

  // Priority B: Site Contact Details (site in-charge or site phone)
  const siteContact = normalizeWhatsAppNumber(site?.siteContactDetails);
  if (siteContact) {
    return {
      phone: siteContact.phone,
      displayPhone: siteContact.display,
      recipientName: site?.siteInCharge || site?.siteName || cust?.name || "Site Contact",
      recipientRole: "Site Contact",
    };
  }

  // Priority C: Document Contact Person
  const contactPerson = normalizeWhatsAppNumber(contact?.mobile);
  if (contactPerson) {
    return {
      phone: contactPerson.phone,
      displayPhone: contactPerson.display,
      recipientName: contact?.name || "Site Representative",
      recipientRole: contact?.designation || "Site Contact Person",
    };
  }

  // Priority D: Site Receiver Phone (if already acknowledged / recorded)
  const receiver = normalizeWhatsAppNumber(doc.receiverPhone);
  if (receiver) {
    return {
      phone: receiver.phone,
      displayPhone: receiver.display,
      recipientName: doc.receiverName || "Site Receiver",
      recipientRole: "Site Receiver",
    };
  }

  // Priority E: Site Owner Contact
  const siteOwner = normalizeWhatsAppNumber(site?.siteOwnerContact);
  if (siteOwner) {
    return {
      phone: siteOwner.phone,
      displayPhone: siteOwner.display,
      recipientName: site?.siteOwnerName || "Site Owner",
      recipientRole: "Site Property Owner",
    };
  }

  // Priority F: Customer Primary Mobile
  const custPrimary = normalizeWhatsAppNumber(cust?.primaryMobile);
  if (custPrimary) {
    return {
      phone: custPrimary.phone,
      displayPhone: custPrimary.display,
      recipientName: cust?.name || "Customer",
      recipientRole: "Customer Primary Mobile",
    };
  }

  return { phone: null, displayPhone: null, recipientName: cust?.name || null, recipientRole: null };
}

/**
 * Builds formatted text payload for WhatsApp sharing per document type.
 */
export function buildDocumentWhatsAppMessage(
  docType: "DN" | "MRN" | "INVOICE" | "BILL",
  doc: any,
  origin: string = ""
): string {
  const baseUrl = origin ? origin.replace(/\/$/, "") : "";

  switch (docType) {
    case "DN": {
      const dnNum = doc.dnNumber || "DN";
      const custName = doc.customer?.name || "Customer";
      const siteName = doc.customerSite?.siteName || "Site";
      const date = doc.deliveryDate ? new Date(doc.deliveryDate).toLocaleDateString("en-IN") : "Today";
      const vehicle = doc.vehicleNumber || "Company Fleet";
      const status = doc.status || "DISPATCHED";
      const ewb = doc.eWayBillNumber || doc.eWayBills?.[0]?.ewbNumber;
      const printUrl = baseUrl ? `${baseUrl}/api/v1/delivery-notes/${doc.id}/print` : "";

      let msg = `*AJAY ENTERPRISES – Centering Material Delivery Note*\n\n`;
      msg += `Dear *${custName}*,\n`;
      msg += `Material custody dispatch details for your construction site are confirmed:\n\n`;
      msg += `📋 *Delivery Note:* ${dnNum}\n`;
      msg += `📍 *Construction Site:* ${siteName}\n`;
      msg += `📅 *Date of Dispatch:* ${date}\n`;
      msg += `🚛 *Vehicle:* ${vehicle}\n`;
      msg += `📦 *Status:* ${status}\n`;
      if (ewb) {
        msg += `🚚 *E-Way Bill:* ${ewb}\n`;
      }
      if (printUrl) {
        msg += `\n📄 *Official Document Slip:*\n${printUrl}\n`;
      }
      msg += `\nThank you for choosing *AJAY ENTERPRISES*!`;
      return msg;
    }

    case "MRN": {
      const mrnNum = doc.mrnNumber || "MRN";
      const custName = doc.customer?.name || "Customer";
      const siteName = doc.customerSite?.siteName || "Site";
      const date = doc.returnDate ? new Date(doc.returnDate).toLocaleDateString("en-IN") : "Today";
      const yardName = doc.receivingWarehouse?.name || "AJAY ENTERPRISES Yard";
      const status = doc.status || "POSTED";
      const printUrl = baseUrl ? `${baseUrl}/api/v1/return-notes/${doc.id}/print` : "";

      let msg = `*AJAY ENTERPRISES – Material Return Note (MRN)*\n\n`;
      msg += `Dear *${custName}*,\n`;
      msg += `Centering material return from your site has been inspected and credited:\n\n`;
      msg += `📋 *Return Note:* ${mrnNum}\n`;
      msg += `📍 *Returning Site:* ${siteName}\n`;
      msg += `📅 *Return Date:* ${date}\n`;
      msg += `🏭 *Receiving Yard:* ${yardName}\n`;
      msg += `📦 *Status:* ${status}\n`;
      if (printUrl) {
        msg += `\n📄 *Official Return Slip:*\n${printUrl}\n`;
      }
      msg += `\nDaily rental charges will stop as of the effective return terms. Thank you!`;
      return msg;
    }

    case "INVOICE": {
      const invNum = doc.invoiceNumber || "INVOICE";
      const custName = doc.customer?.name || "Customer";
      const siteName = doc.customerSite?.siteName || (doc.invoiceType === "RENTAL" ? "Consolidated Sites" : "General");
      const date = doc.invoiceDate ? new Date(doc.invoiceDate).toLocaleDateString("en-IN") : "Today";
      const dueDate = doc.dueDate ? new Date(doc.dueDate).toLocaleDateString("en-IN") : "Due on receipt";
      const totalAmt = Number(doc.grandTotal ?? doc.totalAmount ?? 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const balanceDue = Number(doc.outstandingAmount ?? doc.grandTotal ?? 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const paymentStatus = doc.paymentStatus || "UNPAID";
      const printUrl = baseUrl ? `${baseUrl}/api/v1/invoices/${doc.id}/print` : "";

      let msg = `*AJAY ENTERPRISES – Tax Invoice*\n\n`;
      msg += `Dear *${custName}*,\n`;
      msg += `Please find the tax invoice details for centering material rental and services:\n\n`;
      msg += `📋 *Invoice #:* ${invNum}\n`;
      msg += `📍 *Site / Project:* ${siteName}\n`;
      msg += `📅 *Invoice Date:* ${date}\n`;
      msg += `💰 *Grand Total:* ₹${totalAmt}\n`;
      msg += `⏳ *Due Date:* ${dueDate}\n`;
      msg += `💳 *Payment Status:* ${paymentStatus} (Due: ₹${balanceDue})\n`;
      if (printUrl) {
        msg += `\n📄 *View / Download Tax Invoice:*\n${printUrl}\n`;
      }
      msg += `\nKindly arrange payment to the bank account listed on the invoice. Thank you!`;
      return msg;
    }

    case "BILL": {
      const billNum = doc.billNumber || "BILL";
      const suppName = doc.supplier?.name || "Supplier";
      const date = doc.billDate ? new Date(doc.billDate).toLocaleDateString("en-IN") : "Today";
      const ref = doc.supplierInvoiceNumber || "N/A";
      const totalAmt = Number(doc.grandTotal ?? doc.totalAmount ?? 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const paymentStatus = doc.paymentStatus || "PENDING";

      let msg = `*AJAY ENTERPRISES – Purchase Bill Record*\n\n`;
      msg += `Dear *${suppName}*,\n`;
      msg += `Your supplier invoice has been booked into our Accounts Payable:\n\n`;
      msg += `📋 *Internal Bill #:* ${billNum}\n`;
      msg += `📄 *Your Invoice Ref:* ${ref}\n`;
      msg += `📅 *Bill Booking Date:* ${date}\n`;
      msg += `💰 *Total Amount:* ₹${totalAmt}\n`;
      msg += `💳 *Payment Status:* ${paymentStatus}\n`;
      msg += `\nThank you for your business partnership with *AJAY ENTERPRISES*!`;
      return msg;
    }
  }
}

/**
 * Returns the direct `wa.me` URL for opening WhatsApp.
 */
export function getWhatsAppShareUrl(
  docType: "DN" | "MRN" | "INVOICE" | "BILL",
  doc: any,
  origin: string = ""
): { url: string; contact: ResolvedWhatsAppContact; message: string } {
  const contact = resolveDocumentWhatsAppContact(docType, doc);
  const message = buildDocumentWhatsAppMessage(docType, doc, origin);

  const phoneParam = contact.phone ? contact.phone : "";
  const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`;
  return { url, contact, message };
}
