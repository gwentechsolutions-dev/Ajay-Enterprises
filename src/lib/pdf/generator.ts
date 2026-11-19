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
  documentType: "PO" | "GRN" | "PR" | "DN" | "MRN" | "STN" | "HDN" | "HRN" | "DSTN";
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
    driverTripNumber?: string;
    eWayBillNumber?: string;
    transportCharges?: number;
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
    declaredQty?: number;
    receivedQty?: number;
    acceptedQty?: number;
    damagedQty?: number;
    missingQty?: number;
    rejectedQty?: number;
    inspectionRemarks?: string;
  }>;
  subtotal?: number;
  taxAmount?: number;
  grandTotal?: number;
  receiverDetails?: {
    name?: string;
    phone?: string;
    designation?: string;
    signatureUrl?: string;
    receivedAt?: Date | string;
    yardName?: string;
  };
  customerHandoverDetails?: {
    name?: string;
    phone?: string;
    designation?: string;
    signatureUrl?: string;
    handoverAt?: Date | string;
    customerAgreedDamage?: boolean;
  };
  inspectionDetails?: {
    status: "PENDING" | "COMPLETED";
    inspectorName?: string;
    inspectorDesignation?: string;
    inspectedAt?: Date | string;
    remarks?: string;
    customerAgreedDamage?: boolean;
  };
  notes?: string;
  origin?: string;
  ogImageUrl?: string;
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

  const baseUrl = data.origin ? data.origin.replace(/\/$/, "") : "";
  const ogFilename =
    data.documentType === "DN"
      ? "og-delivery-note.png"
      : data.documentType === "MRN"
      ? "og-return-note.png"
      : data.documentType === "PO" || data.documentType === "GRN"
      ? "og-purchase-bill.png"
      : "og-default.png";

  const dynamicOgUrl = baseUrl
    ? `${baseUrl}/api/og?type=${encodeURIComponent(data.documentType)}&docNumber=${encodeURIComponent(
        data.documentNumber
      )}&party=${encodeURIComponent(data.partyName)}&site=${encodeURIComponent(data.secondaryPartyName || "")}`
    : `/images/og/${ogFilename}`;

  const ogImageUrl = data.ogImageUrl || dynamicOgUrl;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - ${data.documentNumber} | AJAY ENTERPRISES</title>

  <!-- Open Graph / WhatsApp Social Preview Metadata -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AJAY ENTERPRISES · INVENTRA ERP">
  <meta property="og:title" content="${data.title} • ${data.documentNumber}">
  <meta property="og:description" content="Official ${data.title} for ${data.partyName}${data.secondaryPartyName ? ` (${data.secondaryPartyName})` : ""} — AJAY ENTERPRISES Centering Material Rental &amp; Operations">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${data.title} ${data.documentNumber} - AJAY ENTERPRISES">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${data.title} • ${data.documentNumber}">
  <meta name="twitter:description" content="Official ${data.title} for ${data.partyName} - AJAY ENTERPRISES">
  <meta name="twitter:image" content="${ogImageUrl}">
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
    .text-nowrap { white-space: nowrap; }

    /* MRN Inspection Table Specific Styles */
    .mrn-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 14px; font-size: 8pt; }
    .mrn-table th { background-color: #0B1E36; color: #ffffff; padding: 6px 4px; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
    .mrn-table td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; vertical-align: middle; }
    .mrn-table tr:nth-child(even) { background-color: #f8fafc; }
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
          ? `<a href="/api/v1/ewaybills/${data.transportDetails.eWayBillNumber}/print" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; background: #2563eb; color: #ffffff; font-size: 11px; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" title="Click to view official Form GST EWB-01 Statutory E-Way Bill"><span>EWB: ${data.transportDetails.eWayBillNumber}</span><span style="font-size: 10px; opacity: 0.9;">&bull; View E-Way Bill &nearr;</span></a>`
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
    data.transportDetails && (data.transportDetails.vehicleNumber || data.transportDetails.driverName || data.transportDetails.eWayBillNumber || data.transportDetails.transportCharges || data.transportDetails.driverTripNumber)
      ? `
    <div class="transport-box">
      <strong>Transport & Fleet Details:</strong>
      ${data.transportDetails.driverTripNumber ? ` &bull; Trip #: <strong>${data.transportDetails.driverTripNumber}</strong>` : ""}
      ${data.transportDetails.vehicleNumber ? ` &bull; Vehicle: <strong>${data.transportDetails.vehicleNumber}</strong>` : ""}
      ${data.transportDetails.driverName ? ` &bull; Driver: <strong>${data.transportDetails.driverName}</strong>` : ""}
      ${data.transportDetails.driverPhone ? ` (+91 ${data.transportDetails.driverPhone})` : ""}
      ${data.transportDetails.eWayBillNumber ? ` &bull; E-Way Bill: <a href="/api/v1/ewaybills/${data.transportDetails.eWayBillNumber}/print" target="_blank" style="color: #2563eb; font-weight: 700; text-decoration: underline;" title="View official Form GST EWB-01">${data.transportDetails.eWayBillNumber}</a> <span style="color: #64748b; font-size: 8pt;">(View Form GST EWB-01 &nearr;)</span>` : ""}
      ${data.transportDetails.transportCharges && data.transportDetails.transportCharges > 0 ? ` &bull; Freight / Transport: <strong>₹${Number(data.transportDetails.transportCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>` : ""}
    </div>
  `
      : ""
  }

  ${
    data.documentType === "MRN"
      ? `
    <!-- MRN Inspection & Discrepancy Header Badge -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; margin-bottom: 6px;">
      <span style="font-weight: 800; color: #0B1E36; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.3px;">
        Returned Materials &amp; Physical Inspection Breakdown
      </span>
      ${
        data.inspectionDetails?.status === "PENDING"
          ? `<span style="background: #fffbeb; color: #b45309; border: 1.5px solid #fcd34d; font-size: 8pt; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;">
              ⏳ Inspection Pending · Awaiting Yard Verification
            </span>`
          : `<span style="background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; font-size: 8pt; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;">
              ✓ Inspection Completed &amp; Verified
            </span>`
      }
    </div>

    <!-- MRN Inspection & Discrepancy Table -->
    <table class="item-table mrn-table">
      <thead>
        <tr>
          <th class="text-center text-nowrap" style="width: 3.5%;">#</th>
          <th class="text-nowrap" style="width: 16%;">Code</th>
          <th style="width: 22%;">Material Description</th>
          <th class="text-nowrap" style="width: 11%;">Size</th>
          <th class="text-right text-nowrap" style="width: 6.5%;" title="Declared for return by customer site">Declared</th>
          <th class="text-right text-nowrap" style="width: 6.5%;" title="Physically received at yard">Received</th>
          <th class="text-right text-nowrap" style="width: 6.5%;" title="Accepted in good condition">Accepted</th>
          <th class="text-right text-nowrap" style="width: 6.5%;" title="Received damaged">Damaged</th>
          <th class="text-right text-nowrap" style="width: 6.5%;" title="Shortage / Missing">Missing</th>
          <th class="text-center text-nowrap" style="width: 5.5%;">UOM</th>
          <th class="text-nowrap" style="width: 9%;" title="Physical Inspection Remarks & Condition">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map((it) => {
            const declared = it.declaredQty !== undefined ? it.declaredQty : it.quantity;
            const accepted = it.acceptedQty !== undefined ? it.acceptedQty : it.quantity;
            const damaged = it.damagedQty || 0;
            const missing = it.missingQty || 0;
            const rejected = it.rejectedQty || 0;
            const received =
              it.receivedQty !== undefined
                ? it.receivedQty
                : accepted + damaged + rejected;

            const isQtyFormatted = it.uom === "Nos." ? 0 : 2;

            return `
          <tr>
            <td class="text-center text-nowrap" style="color: #64748b; font-size: 7.5pt;">${it.sn}</td>
            <td class="text-nowrap" style="font-family: monospace; font-weight: 600; font-size: 8pt; letter-spacing: -0.2px;">${it.code}</td>
            <td style="font-size: 8pt; line-height: 1.25;"><strong>${it.name}</strong></td>
            <td class="text-nowrap" style="font-size: 8pt; color: #334155;">${it.size || "-"}</td>
            <td class="text-right text-nowrap" style="font-weight: 600;">${declared.toFixed(isQtyFormatted)}</td>
            <td class="text-right text-nowrap" style="font-weight: 600; color: #0f172a;">${received.toFixed(isQtyFormatted)}</td>
            <td class="text-right text-nowrap" style="font-weight: 700; color: #166534;">${accepted.toFixed(isQtyFormatted)}</td>
            <td class="text-right text-nowrap" style="font-weight: 700; color: ${damaged > 0 ? "#b45309" : "#94a3b8"};">${damaged > 0 ? damaged.toFixed(isQtyFormatted) : "-"}</td>
            <td class="text-right text-nowrap" style="font-weight: 700; color: ${missing > 0 ? "#b91c1c" : "#94a3b8"};">${missing > 0 ? missing.toFixed(isQtyFormatted) : "-"}</td>
            <td class="text-center text-nowrap" style="font-size: 8pt; color: #475569;">${it.uom}</td>
            <td class="text-nowrap" style="font-size: 7.5pt; color: #475569;">
              ${
                it.inspectionRemarks || it.remarks
                  ? `<span style="color: #1e293b; font-weight: 500;">${it.inspectionRemarks || it.remarks}</span>`
                  : it.condition
                  ? `<span style="font-weight: 600; color: ${it.condition.toUpperCase() === "GOOD" ? "#166534" : "#b45309"}; text-transform: capitalize;">${it.condition.toLowerCase()}</span>`
                  : "-"
              }
              ${rejected > 0 ? `<br><span style="color: #b91c1c; font-weight: 600;">Rej: ${rejected.toFixed(isQtyFormatted)}</span>` : ""}
            </td>
          </tr>
        `;
          })
          .join("")}
        <!-- Totals Row -->
        <tr style="background-color: #f1f5f9; font-weight: 800; border-top: 2px solid #0B1E36;">
          <td colspan="4" class="text-right text-nowrap" style="text-transform: uppercase; font-size: 7.5pt; padding-right: 8px; letter-spacing: 0.3px;">
            Total Quantities:
          </td>
          <td class="text-right text-nowrap" style="font-size: 8pt;">
            ${data.items.reduce((sum, it) => sum + (it.declaredQty !== undefined ? it.declaredQty : it.quantity), 0).toFixed(0)}
          </td>
          <td class="text-right text-nowrap" style="font-size: 8pt;">
            ${data.items.reduce((sum, it) => sum + (it.receivedQty !== undefined ? it.receivedQty : (it.acceptedQty !== undefined ? it.acceptedQty : it.quantity) + (it.damagedQty || 0)), 0).toFixed(0)}
          </td>
          <td class="text-right text-nowrap" style="color: #166534; font-size: 8pt;">
            ${data.items.reduce((sum, it) => sum + (it.acceptedQty !== undefined ? it.acceptedQty : it.quantity), 0).toFixed(0)}
          </td>
          <td class="text-right text-nowrap" style="color: #b45309; font-size: 8pt;">
            ${data.items.reduce((sum, it) => sum + (it.damagedQty || 0), 0).toFixed(0)}
          </td>
          <td class="text-right text-nowrap" style="color: #b91c1c; font-size: 8pt;">
            ${data.items.reduce((sum, it) => sum + (it.missingQty || 0), 0).toFixed(0)}
          </td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>

    <!-- Material Inspection Reconciliation & Audit Notes -->
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 14px; font-size: 8.5pt; line-height: 1.4;">
      <div style="font-weight: 700; color: #0B1E36; margin-bottom: 2px;">Material Custody &amp; Inspection Audit Note:</div>
      ${
        data.inspectionDetails?.status === "PENDING"
          ? `<div style="color: #b45309;">
              <strong>Notice:</strong> Materials have been physically transferred into yard custody based on customer declared quantities. Detailed inspection for damaged or missing components is currently pending and will be updated upon final verification.
            </div>`
          : `<div>
              Accepted units (${data.items.reduce((sum, it) => sum + (it.acceptedQty !== undefined ? it.acceptedQty : it.quantity), 0).toFixed(0)}) have been re-credited to AJAY ENTERPRISES available rental stock.
              ${
                data.items.some((it) => (it.damagedQty || 0) > 0)
                  ? ` Damaged units (${data.items.reduce((sum, it) => sum + (it.damagedQty || 0), 0).toFixed(0)}) are segregated for repair.`
                  : ""
              }
              ${
                data.items.some((it) => (it.missingQty || 0) > 0)
                  ? ` Missing units (${data.items.reduce((sum, it) => sum + (it.missingQty || 0), 0).toFixed(0)}) represent site shortage and were not received into the yard.`
                  : ""
              }
              <br>
              <span style="font-weight: 600; color: ${data.customerHandoverDetails?.customerAgreedDamage || data.inspectionDetails?.customerAgreedDamage ? "#166534" : "#b45309"};">
                Customer Damage Acceptance: ${
                  data.customerHandoverDetails?.customerAgreedDamage || data.inspectionDetails?.customerAgreedDamage
                    ? "Explicitly acknowledged &amp; signed off by customer representative."
                    : "Inspection findings recorded by AJAY ENTERPRISES quality control; subject to formal joint reconciliation."
                }
              </span>
              ${
                data.inspectionDetails?.inspectorName
                  ? `<br><span style="color: #64748b; font-size: 8pt;">Inspected By: <strong>${data.inspectionDetails.inspectorName}</strong> (${data.inspectionDetails.inspectorDesignation || "Yard In-Charge"}) on ${data.inspectionDetails.inspectedAt ? new Date(data.inspectionDetails.inspectedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : formattedDate}</span>`
                  : ""
              }
            </div>`
      }
    </div>
  `
      : `
    <!-- Standard Items Table for non-MRN documents -->
    <table class="item-table">
      <thead>
        <tr>
          <th class="text-center text-nowrap" style="width: 5%;">#</th>
          <th class="text-nowrap" style="width: 16%;">Code</th>
          <th>Material Description</th>
          <th class="text-nowrap" style="width: 14%;">Size</th>
          <th class="text-right text-nowrap" style="width: 11%;">Qty</th>
          <th class="text-center text-nowrap" style="width: 8%;">UOM</th>
          ${data.items.some((i) => i.rate !== undefined) ? '<th class="text-right text-nowrap" style="width: 11%;">Rate (₹)</th>' : ""}
          ${data.items.some((i) => i.total !== undefined) ? '<th class="text-right text-nowrap" style="width: 13%;">Amount (₹)</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (it) => `
          <tr>
            <td class="text-center text-nowrap">${it.sn}</td>
            <td class="text-nowrap" style="font-family: monospace; font-weight: 600;">${it.code}</td>
            <td><strong>${it.name}</strong> ${it.remarks ? `<br><small style="color: #64748b;">${it.remarks}</small>` : ""}</td>
            <td class="text-nowrap">${it.size || "-"}</td>
            <td class="text-right text-nowrap" style="font-weight: 700;">${it.quantity.toFixed(it.uom === "Nos." ? 0 : 2)}</td>
            <td class="text-center text-nowrap">${it.uom}</td>
            ${it.rate !== undefined ? `<td class="text-right text-nowrap">₹${it.rate.toFixed(2)}</td>` : ""}
            ${it.total !== undefined ? `<td class="text-right text-nowrap" style="font-weight: 600;">₹${it.total.toFixed(2)}</td>` : ""}
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `
  }

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

  ${
    data.notes && data.secondaryPartyName
      ? `
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 14px; font-size: 8.5pt; line-height: 1.4; color: #475569;">
      <strong style="color: #0B1E36;">Operating Notes &amp; Document Traceability:</strong> ${data.notes}
    </div>
  `
      : ""
  }

  ${
    data.documentType === "MRN" || data.documentType === "DSTN"
      ? `
    <!-- Dedicated Two-Section Acknowledgement for Material Return Note & Direct Site Transfer -->
    <table class="ack-table" style="page-break-inside: avoid;">
      <tr>
        <!-- 1. Customer / Site Representative - Material Handover / Release -->
        <td class="ack-box" style="width: 48%; vertical-align: top; height: auto; min-height: 140px; background-color: #fafaf9;">
          <div style="font-weight: 800; color: #0B1E36; font-size: 8.5pt; text-transform: uppercase; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>${data.documentType === "DSTN" ? "1. Source Site Release Sign-Off" : "1. Customer Handover Sign-Off"}</span>
            <span style="font-size: 7.5pt; color: #64748b; font-weight: normal;">Site Custody Release</span>
          </div>
          <div style="font-size: 8pt; color: #475569; margin-bottom: 6px; line-height: 1.3;">
            ${data.documentType === "DSTN"
              ? "I hereby confirm that the declared centering materials listed above have been released from site custody for direct transport to the receiving destination site."
              : "I hereby confirm that the declared centering materials listed above have been released and handed over from construction site custody to AJAY ENTERPRISES."
            }
          </div>
          <div style="font-size: 8.5pt; line-height: 1.55; color: #1e293b;">
            ${data.customerHandoverDetails?.name ? `Representative: <strong>${data.customerHandoverDetails.name}</strong><br>` : "Representative: ___________________________<br>"}
            ${data.customerHandoverDetails?.designation ? `Designation: <strong>${data.customerHandoverDetails.designation}</strong><br>` : "Designation: ____________________________<br>"}
            ${data.customerHandoverDetails?.phone ? `Mobile: <strong>+91 ${data.customerHandoverDetails.phone}</strong><br>` : "Mobile: _________________________________<br>"}
            ${data.customerHandoverDetails?.handoverAt ? `Release Date: <strong>${new Date(data.customerHandoverDetails.handoverAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</strong><br>` : `Release Date: <strong>${formattedDate}</strong><br>`}
          </div>
          <div style="margin-top: 10px; font-size: 8pt; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 4px; display: flex; justify-content: space-between; align-items: flex-end; min-height: 38px;">
            <span>${data.documentType === "DSTN" ? "Releasing Representative" : "Representative Signature"}</span>
            ${data.customerHandoverDetails?.signatureUrl ? `<img src="${data.customerHandoverDetails.signatureUrl}" alt="Customer Signature" style="max-height: 36px; max-width: 110px; object-fit: contain;" />` : `<div style="color: #94a3b8; font-style: italic; font-size: 7.5pt;">(Authorised Signatory / Stamp)</div>`}
          </div>
        </td>

        <td style="width: 4%;"></td>

        <!-- 2. Destination Site Receipt / AJAY ENTERPRISES Receipt -->
        <td class="ack-box" style="width: 48%; vertical-align: top; height: auto; min-height: 140px; background-color: #f8fafc;">
          <div style="font-weight: 800; color: #0B1E36; font-size: 8.5pt; text-transform: uppercase; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>${data.documentType === "DSTN" ? "2. Destination Site Receipt" : "2. AJAY ENTERPRISES Receipt"}</span>
            <span style="font-size: 7.5pt; color: #64748b; font-weight: normal;">${data.documentType === "DSTN" ? "Receiving Custody" : "Yard Custody"}</span>
          </div>
          <div style="font-size: 8pt; color: #475569; margin-bottom: 6px; line-height: 1.3;">
            ${data.documentType === "DSTN"
              ? "Confirmed receipt and physical verification of centering equipment at destination site. Equipment custody accepted under active customer rental agreement."
              : "Confirmed material receipt at AJAY ENTERPRISES yard custody. Accepted stock credited; damaged/missing units isolated."
            }
          </div>
          <div style="font-size: 8.5pt; line-height: 1.55; color: #1e293b;">
            ${data.documentType === "DSTN"
              ? `Receiving Staff: <strong>${data.receiverDetails?.name || "Pending Destination Sign-Off"}</strong><br>
                 Designation: <strong>${data.receiverDetails?.designation || "Site Engineer / Receiver"}</strong><br>
                 ${data.receiverDetails?.phone ? `Mobile: <strong>+91 ${data.receiverDetails.phone}</strong><br>` : ""}
                 ${data.receiverDetails?.receivedAt ? `Received Date: <strong>${new Date(data.receiverDetails.receivedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</strong><br>` : `Received Date: <strong>${formattedDate}</strong><br>`}`
              : `Receiving Staff: <strong>${data.receiverDetails?.name || signatoryName}</strong><br>
                 Designation: <strong>${data.receiverDetails?.designation || signatoryDesignation}</strong><br>
                 Receiving Yard: <strong>${data.receiverDetails?.yardName || data.secondaryPartyName || "Centering Yard"}</strong><br>
                 ${data.receiverDetails?.receivedAt ? `Received Date: <strong>${new Date(data.receiverDetails.receivedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</strong><br>` : `Received Date: <strong>${formattedDate}</strong><br>`}`
            }
          </div>
          <div style="margin-top: 6px; min-height: 48px; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            ${stampBase64 ? `<img src="${stampBase64}" alt="Company Seal" style="max-height: 52px; max-width: 80px; object-fit: contain; opacity: 0.9;" />` : ""}
            ${signatureBase64 ? `<img src="${signatureBase64}" alt="Authorised Signature" style="max-height: 42px; max-width: 110px; object-fit: contain;" />` : ""}
          </div>
          <div style="font-size: 7.5pt; color: #64748b; text-align: right; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
            For ${tradeName} • ${data.documentType === "DSTN" ? "Direct Fleet Logistics Verified" : "Authorised Yard In-Charge"}
          </div>
        </td>
      </tr>
    </table>
  `
      : `
    <!-- Standard Single Acknowledgement for other documents -->
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
  `
  }

  <div class="footer-note">
    Generated by INVENTRA Enterprise ERP for AJAY ENTERPRISES. This document constitutes formal custody transfer of centering materials.
  </div>
  </div>
</body>
</html>
  `.trim();
}

