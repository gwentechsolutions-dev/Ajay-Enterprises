import { db } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";

function extractStoragePath(urlOrPath?: string | null): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("data:")) return null;
  if (urlOrPath.includes("path=")) {
    try {
      const parsed = new URL(urlOrPath, "http://localhost");
      const p = parsed.searchParams.get("path");
      if (p) return decodeURIComponent(p);
    } catch {
      const match = urlOrPath.match(/path=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }
  return urlOrPath.replace(/^\/+/, "");
}

async function getAssetAsBase64(urlOrPath?: string | null): Promise<string | null> {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("data:")) return urlOrPath;
  const storagePath = extractStoragePath(urlOrPath);
  if (!storagePath) return urlOrPath;
  try {
    const file = await readPrivateFile(storagePath);
    if (!file) return urlOrPath;
    const mime = file.mime || "image/png";
    return `data:${mime};base64,${file.buffer.toString("base64")}`;
  } catch {
    return urlOrPath;
  }
}

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
      signatories: { where: { isActive: true }, orderBy: { isDefault: "desc" } },
    },
  });

  const defaultSignatory = company?.signatories[0];
  const signatoryName = defaultSignatory?.name || "Authorised Signatory";
  const signatoryDesignation = defaultSignatory?.designation || "Yard In-Charge";

  let signatureBase64: string | null = null;
  let stampBase64: string | null = null;
  let logoBase64: string | null = null;

  if (defaultSignatory?.signatureAssetUrl) {
    signatureBase64 = await getAssetAsBase64(defaultSignatory.signatureAssetUrl);
  }
  if (defaultSignatory?.stampAssetUrl) {
    stampBase64 = await getAssetAsBase64(defaultSignatory.stampAssetUrl);
  }
  if (company?.logoAssetUrl) {
    logoBase64 = await getAssetAsBase64(company.logoAssetUrl);
  }

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
    .doc-badge { display: inline-block; background-color: #F26522; color: #ffffff; font-weight: 700; font-size: 10.5pt; padding: 5px 14px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.3px; margin-bottom: 6px; }
    .doc-num { font-size: 12.5pt; font-weight: 800; color: #0B1E36; font-family: monospace; white-space: nowrap; margin-top: 2px; }
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
    @media print {
      .no-print { display: none !important; }
      body { padding: 0 !important; background: transparent !important; }
      .sheet-container { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; border: none !important; padding: 0 !important; }
    }
    @media screen {
      body { background-color: #f1f5f9; padding-bottom: 40px; }
      .sheet-container { background: #ffffff; max-width: 210mm; min-height: 297mm; margin: 16px auto; padding: 16mm 18mm; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 6px; border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; background: #0B1E36; color: white; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.25); z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 700; font-size: 14px; letter-spacing: -0.2px;">${data.title}</span>
      <span style="font-family: monospace; font-size: 13px; color: #94a3b8;">${data.documentNumber}</span>
      ${
        data.transportDetails?.eWayBillNumber
          ? `<span style="background: #2563eb; color: white; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-weight: 600;">EWB: ${data.transportDetails.eWayBillNumber}</span>`
          : ""
      }
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <button onclick="window.print()" style="background: #F26522; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
      <button onclick="window.close()" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); padding: 7px 14px; border-radius: 6px; font-size: 13px; cursor: pointer;">
        Close
      </button>
    </div>
  </div>
  <div class="sheet-container">
  <table class="header-table">
    <tr>
      <td style="width: 52%; vertical-align: top;">
        <div class="company-title">${tradeName}</div>
        <div class="company-sub">${companyName} | GSTIN: <strong>${gstin}</strong></div>
        <div class="company-sub">${addressLine}</div>
        <div class="company-sub">Phone: +91 ${mobile} | Email: ${email}</div>
      </td>
      <td style="width: 48%; text-align: right; vertical-align: top;">
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
        <div style="font-weight: 700; color: #0B1E36; font-size: 8.5pt; text-transform: uppercase; margin-bottom: 4px;">Receiver Acknowledgement</div>
        <div style="font-size: 8.5pt; line-height: 1.5; color: #334155;">
          ${data.receiverDetails?.name ? `Name: <strong>${data.receiverDetails.name}</strong><br>` : "Name: ______________________<br>"}
          ${data.receiverDetails?.designation ? `Designation: ${data.receiverDetails.designation}<br>` : "Designation: ________________<br>"}
          ${data.receiverDetails?.phone ? `Phone: +91 ${data.receiverDetails.phone}<br>` : "Phone: _____________________<br>"}
        </div>
        <div style="margin-top: 8px; font-size: 8pt; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 4px; display: flex; justify-content: space-between; align-items: flex-end;">
          <span>Signature & Site Stamp</span>
          ${data.receiverDetails?.signatureUrl ? `<img src="${data.receiverDetails.signatureUrl}" alt="Receiver Signature" style="max-height: 32px; max-width: 100px; object-fit: contain;" />` : ""}
        </div>
      </td>
      <td style="width: 4%;"></td>
      <td class="ack-box" style="text-align: right; position: relative; vertical-align: bottom;">
        <div style="font-weight: 700; color: #0B1E36; font-size: 8.5pt; text-transform: uppercase;">For ${tradeName}</div>
        <div style="min-height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin: 4px 0;">
          ${stampBase64 ? `<img src="${stampBase64}" alt="Company Seal" style="max-height: 60px; max-width: 90px; object-fit: contain; opacity: 0.9;" />` : ""}
          ${signatureBase64 ? `<img src="${signatureBase64}" alt="Authorised Signature" style="max-height: 48px; max-width: 130px; object-fit: contain;" />` : '<div style="height: 48px;"></div>'}
        </div>
        <div style="font-weight: 700; font-size: 9pt; color: #0B1E36;">${signatoryName}</div>
        <div style="font-size: 8pt; color: #64748b;">${signatoryDesignation}</div>
      </td>
    </tr>
  </table>

  <div class="footer-note">
    Generated by INVENTRA Enterprise ERP for AJAY ENTERPRISES. This document constitutes formal custody transfer of centering materials.
  </div>
  </div>
</body>
</html>
  `.trim();
}

