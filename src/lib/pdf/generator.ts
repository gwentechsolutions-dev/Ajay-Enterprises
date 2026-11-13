import { db } from "@/lib/db";

export interface PDFDocumentData {
  title: string;
  documentNumber: string;
  documentDate: Date | string;
  documentType: "PO" | "GRN" | "PR" | "DN" | "MRN" | "STN" | "HDN" | "HRN";
  partyTitle: string;
  partyName: string;
  partyAddress?: string;
  partyGstin?: string;
  partyMobile?: string;
  secondaryPartyTitle?: string;
  secondaryPartyName?: string;
  secondaryPartyAddress?: string;
  transportDetails?: {
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    eWayBillNumber?: string;
  };
  items: Array<{
    sn: number;
    code: string;
    name: string;
    size?: string;
    quantity: number;
    uom: string;
    rate?: number;
    total?: number;
    condition?: string;
    remarks?: string;
  }>;
  subtotal?: number;
  taxAmount?: number;
  grandTotal?: number;
  receiverDetails?: {
    name?: string;
    phone?: string;
    designation?: string;
    signatureUrl?: string;
  };
  notes?: string;
}

/**
 * Generates an ISO/A4-compliant printable HTML document representation
 * formatted strictly in accordance with AJAY ENTERPRISES corporate identity
 * and INVENTRA design standards.
 */
export async function generateDocumentHTML(data: PDFDocumentData): Promise<string> {
  const company = await db.companyProfile.findFirst({
    include: {
      addresses: { where: { isDefaultBilling: true } },
      bankAccounts: { where: { isPrimary: true } },
    },
  });

  const companyName = company?.legalName || "AJAY ENTERPRISES";
  const tradeName = company?.tradeName || "AJAY ENTERPRISES";
  const primaryAddress = company?.addresses[0];
  const addressLine = primaryAddress
    ? `${primaryAddress.addressLine1}, ${primaryAddress.city}, ${primaryAddress.state} - ${primaryAddress.pinCode}`
    : "Centering Material Yard, Bengaluru, Karnataka";
  const gstin = company?.gstin || "29AABCA1234F1Z5";
  const mobile = company?.primaryMobile || "9876543210";
  const email = company?.officialEmail || "info@ajayenterprises.com";

  const formattedDate = new Date(data.documentDate).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.title} - ${data.documentNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11pt; line-height: 1.4; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #0B1E36; padding-bottom: 8px; }
    .company-title { font-size: 20pt; font-weight: 800; color: #0B1E36; letter-spacing: -0.5px; margin: 0; }
    .company-sub { font-size: 9pt; color: #475569; margin-top: 2px; }
    .doc-badge { display: inline-block; background-color: #F26522; color: #ffffff; font-weight: 700; font-size: 12pt; padding: 4px 14px; border-radius: 4px; text-transform: uppercase; margin-bottom: 4px; }
    .doc-num { font-size: 13pt; font-weight: 800; color: #0B1E36; font-family: monospace; }
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .info-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background-color: #f8fafc; font-size: 9.5pt; vertical-align: top; width: 48%; }
    .info-box-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #F26522; letter-spacing: 0.5px; margin-bottom: 4px; }
    .party-name { font-size: 11pt; font-weight: 700; color: #0B1E36; margin-bottom: 2px; }
    .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; font-size: 9.5pt; }
    .item-table th { background-color: #0B1E36; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
    .item-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .item-table tr:nth-child(even) { background-color: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals-table { width: 40%; margin-left: auto; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
    .totals-table td { padding: 4px 8px; }
    .grand-total { font-size: 12pt; font-weight: 800; color: #0B1E36; border-top: 2px solid #0B1E36; }
    .transport-box { background-color: #f1f5f9; border-left: 4px solid #0B1E36; padding: 8px 12px; margin-bottom: 16px; font-size: 9pt; border-radius: 0 4px 4px 0; }
    .ack-table { width: 100%; border-collapse: collapse; margin-top: 24px; page-break-inside: avoid; }
    .ack-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; height: 110px; vertical-align: bottom; font-size: 8.5pt; color: #64748b; width: 48%; }
    .footer-note { font-size: 8pt; color: #64748b; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 60%;">
        <div class="company-title">${tradeName}</div>
        <div class="company-sub">${companyName} | GSTIN: <strong>${gstin}</strong></div>
        <div class="company-sub">${addressLine}</div>
        <div class="company-sub">Phone: +91 ${mobile} | Email: ${email}</div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-badge">${data.title}</div>
        <div class="doc-num">${data.documentNumber}</div>
        <div class="company-sub" style="margin-top: 4px;">Date: <strong>${formattedDate}</strong></div>
      </td>
    </tr>
  </table>

  <table class="info-grid">
    <tr>
      <td class="info-box">
        <div class="info-box-title">${data.partyTitle}</div>
        <div class="party-name">${data.partyName}</div>
        ${data.partyAddress ? `<div>${data.partyAddress}</div>` : ""}
        ${data.partyGstin ? `<div>GSTIN: <strong>${data.partyGstin}</strong></div>` : ""}
        ${data.partyMobile ? `<div>Phone: +91 ${data.partyMobile}</div>` : ""}
      </td>
      <td style="width: 4%;"></td>
      <td class="info-box">
        ${
          data.secondaryPartyName
            ? `
          <div class="info-box-title">${data.secondaryPartyTitle || "Delivery Location"}</div>
          <div class="party-name">${data.secondaryPartyName}</div>
          ${data.secondaryPartyAddress ? `<div>${data.secondaryPartyAddress}</div>` : ""}
        `
            : `
          <div class="info-box-title">Operating Notes</div>
          <div style="font-size: 9pt; color: #475569;">${data.notes || "Official centering material transfer document issued by AJAY ENTERPRISES."}</div>
        `
        }
      </td>
    </tr>
  </table>

  ${
    data.transportDetails && (data.transportDetails.vehicleNumber || data.transportDetails.driverName || data.transportDetails.eWayBillNumber)
      ? `
    <div class="transport-box">
      <strong>Transport & Fleet Details:</strong>
      ${data.transportDetails.vehicleNumber ? ` &bull; Vehicle: <strong>${data.transportDetails.vehicleNumber}</strong>` : ""}
      ${data.transportDetails.driverName ? ` &bull; Driver: <strong>${data.transportDetails.driverName}</strong>` : ""}
      ${data.transportDetails.driverPhone ? ` (+91 ${data.transportDetails.driverPhone})` : ""}
      ${data.transportDetails.eWayBillNumber ? ` &bull; E-Way Bill: <strong>${data.transportDetails.eWayBillNumber}</strong>` : ""}
    </div>
  `
      : ""
  }

  <table class="item-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 5%;">#</th>
        <th style="width: 15%;">Code</th>
        <th>Material Description</th>
        <th style="width: 12%;">Size</th>
        <th class="text-right" style="width: 12%;">Qty</th>
        <th class="text-center" style="width: 8%;">UOM</th>
        ${data.items.some((i) => i.rate !== undefined) ? '<th class="text-right" style="width: 12%;">Rate (₹)</th>' : ""}
        ${data.items.some((i) => i.total !== undefined) ? '<th class="text-right" style="width: 14%;">Amount (₹)</th>' : ""}
      </tr>
    </thead>
    <tbody>
      ${data.items
        .map(
          (it) => `
        <tr>
          <td class="text-center">${it.sn}</td>
          <td style="font-family: monospace; font-weight: 600;">${it.code}</td>
          <td><strong>${it.name}</strong> ${it.remarks ? `<br><small style="color: #64748b;">${it.remarks}</small>` : ""}</td>
          <td>${it.size || "-"}</td>
          <td class="text-right" style="font-weight: 700;">${it.quantity.toFixed(it.uom === "Nos." ? 0 : 2)}</td>
          <td class="text-center">${it.uom}</td>
          ${it.rate !== undefined ? `<td class="text-right">₹${it.rate.toFixed(2)}</td>` : ""}
          ${it.total !== undefined ? `<td class="text-right" style="font-weight: 600;">₹${it.total.toFixed(2)}</td>` : ""}
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  ${
    data.grandTotal !== undefined
      ? `
    <table class="totals-table">
      ${data.subtotal !== undefined ? `<tr><td>Subtotal:</td><td class="text-right">₹${data.subtotal.toFixed(2)}</td></tr>` : ""}
      ${data.taxAmount !== undefined ? `<tr><td>Taxes (GST):</td><td class="text-right">₹${data.taxAmount.toFixed(2)}</td></tr>` : ""}
      <tr class="grand-total"><td>Grand Total:</td><td class="text-right">₹${data.grandTotal.toFixed(2)}</td></tr>
    </table>
  `
      : ""
  }

  <table class="ack-table">
    <tr>
      <td class="ack-box">
        <strong>Receiver Acknowledgement</strong><br>
        ${data.receiverDetails?.name ? `Name: <strong>${data.receiverDetails.name}</strong><br>` : "Name: ______________________<br>"}
        ${data.receiverDetails?.designation ? `Designation: ${data.receiverDetails.designation}<br>` : "Designation: ________________<br>"}
        ${data.receiverDetails?.phone ? `Phone: +91 ${data.receiverDetails.phone}<br>` : "Phone: _____________________<br>"}
        <div style="margin-top: 14px;">Signature & Site Stamp</div>
      </td>
      <td style="width: 4%;"></td>
      <td class="ack-box" style="text-align: right;">
        <strong>For ${tradeName}</strong><br>
        <div style="height: 48px;"></div>
        <div>Authorised Signatory / Yard In-Charge</div>
      </td>
    </tr>
  </table>

  <div class="footer-note">
    Generated by INVENTRA Enterprise ERP for AJAY ENTERPRISES. This document constitutes formal custody transfer of centering materials.
  </div>
</body>
</html>
  `.trim();
}

