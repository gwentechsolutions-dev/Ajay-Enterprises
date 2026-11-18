import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { savePrivateFile, readPrivateFile } from "@/lib/storage";
import {
  resolveDocumentWhatsAppContact,
  buildDocumentWhatsAppMessage,
} from "@/lib/whatsapp";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";
import { getFormattedAgreementConditions } from "./agreement-terms";

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

export interface CreateRentalAgreementServiceInput {
  customerId: string;
  customerSiteId: string;
  startDate?: Date | string;
  endDate?: Date | string | null;
  billingFrequency?: string;
  billingCycleDay?: number;
  depositAmount?: number;
  depositStatus?: string;
  paymentTerms?: string;
  specialTerms?: string;
  notes?: string;
  orderReference?: string;
  deliveryNoteId?: string;
  autoSendWhatsApp?: boolean;
  reuseExistingIfActive?: boolean;
  items: Array<{
    materialVariantId: string;
    agreedDailyRate: number;
    quantity?: number;
    securityDepositRate?: number | null;
    remarks?: string | null;
  }>;
}

/**
 * Generates an ISO/A4-compliant printable HTML document representation
 * for AJAY ENTERPRISES Rental Agreements.
 */
export async function generateAgreementHTML(
  agreementId: string,
  origin: string = ""
): Promise<string> {
  const [agreement, company] = await Promise.all([
    db.rentalAgreement.findUnique({
      where: { id: agreementId },
      include: {
        customer: true,
        customerSite: true,
        items: {
          include: {
            materialVariant: {
              include: {
                materialType: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.companyProfile.findFirst({
      include: {
        addresses: { where: { isDefaultBilling: true } },
        bankAccounts: { where: { isPrimary: true } },
        signatories: { where: { isActive: true }, orderBy: { isDefault: "desc" } },
      },
    }),
  ]);

  if (!agreement) {
    throw new Error(`Rental Agreement '${agreementId}' not found.`);
  }

  const defaultSignatory = company?.signatories[0];
  const signatoryName = defaultSignatory?.name || "Authorised Signatory";
  const signatoryDesignation = defaultSignatory?.designation || "Director / Proprietor";

  let signatureBase64: string | null = null;
  let stampBase64: string | null = null;

  if (defaultSignatory?.signatureAssetUrl) {
    signatureBase64 = await getAssetAsBase64(defaultSignatory.signatureAssetUrl);
  }
  if (defaultSignatory?.stampAssetUrl) {
    stampBase64 = await getAssetAsBase64(defaultSignatory.stampAssetUrl);
  }

  const companyName = company?.legalName || company?.tradeName || "AJAY ENTERPRISES";
  const gstin = company?.gstin || "33AAAAA0000A1Z5";
  const pan = company?.pan || "AAAAA0000A";
  const phone = company?.primaryMobile || "+91 98765 43210";
  const email = company?.officialEmail || "operations@ajayenterprises.com";
  const address = company?.addresses[0]
    ? `${company.addresses[0].addressLine1}, ${company.addresses[0].city}, ${company.addresses[0].state} - ${company.addresses[0].pinCode}`
    : "123 Industrial Estate, Chennai, Tamil Nadu - 600001";

  const bank = company?.bankAccounts[0];
  const bankDetails = bank
    ? `Bank: ${bank.bankName} | A/C: ${bank.accountNumber} | IFSC: ${bank.ifscCode} | Branch: ${bank.branchName}`
    : "Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234";

  const baseUrl = origin ? origin.replace(/\/$/, "") : "";
  const ogImageUrl = baseUrl
    ? `${baseUrl}/api/og?type=AGREEMENT&docNumber=${encodeURIComponent(
        agreement.agreementNumber
      )}&party=${encodeURIComponent(agreement.customer.name)}&site=${encodeURIComponent(
        agreement.customerSite.siteName
      )}&status=${encodeURIComponent(agreement.status)}`
    : "/images/og/og-rental-agreement.png";

  const token = agreement.acknowledgementToken;
  const reviewUrl = baseUrl && token
    ? `${baseUrl}/rentals/agreements/${agreement.id}/acknowledge?token=${token}`
    : "";

  let totalQty = 0;
  let totalDailyEstimate = 0;

  const itemsRows = agreement.items
    .map((it, idx) => {
      const q = Number(it.quantity || 0);
      const r = Number(it.agreedDailyRate || 0);
      const est = q > 0 ? q * r : r;
      totalQty += q;
      totalDailyEstimate += est;

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${it.materialVariant.name}</div>
          <div style="font-size: 9px; color: #64748b; font-family: monospace;">
            ${it.materialVariant.materialCode} • ${it.materialVariant.size || "Standard"}
          </div>
        </td>
        <td style="text-align: center;">${it.materialVariant.size || "-"}</td>
        <td style="text-align: right; font-weight: 700;">${q > 0 ? q.toLocaleString("en-IN") : "-"}</td>
        <td style="text-align: center;">${it.materialVariant.uom || "Nos."}</td>
        <td style="text-align: right; font-weight: 700; font-family: monospace;">
          Rs. ${r.toFixed(2)}
        </td>
        <td style="text-align: right; font-family: monospace; color: #64748b;">
          ${it.securityDepositRate ? `Rs. ${Number(it.securityDepositRate).toFixed(2)}` : "-"}
        </td>
        <td style="font-size: 9px; color: #475569;">${it.remarks || "Standard rate agreement"}</td>
      </tr>
    `;
    })
    .join("");

  const formattedTerms = getFormattedAgreementConditions(company?.defaultRentalTerms);
  const termsHtml = formattedTerms
    .split("\n\n")
    .map((clause) => {
      const parts = clause.split(":\n");
      if (parts.length === 2) {
        return `<div style="margin-bottom: 8px;">
          <span style="font-weight: 700; color: #0b1e36;">${parts[0]}:</span>
          <span style="color: #334155;"> ${parts[1]}</span>
        </div>`;
      }
      return `<p style="margin-bottom: 6px; color: #334155;">${clause}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rental Agreement - ${agreement.agreementNumber} | AJAY ENTERPRISES</title>

  <!-- Open Graph / WhatsApp Social Preview Metadata -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AJAY ENTERPRISES · INVENTRA ERP">
  <meta property="og:title" content="Rental Agreement • ${agreement.agreementNumber}">
  <meta property="og:description" content="Official Material Rental Agreement for ${agreement.customer.name} (${agreement.customerSite.siteName}) — AJAY ENTERPRISES Centering Material Rental &amp; Operations">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Rental Agreement ${agreement.agreementNumber} - AJAY ENTERPRISES">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Rental Agreement • ${agreement.agreementNumber}">
  <meta name="twitter:description" content="Official Material Rental Agreement for ${agreement.customer.name} — AJAY ENTERPRISES">
  <meta name="twitter:image" content="${ogImageUrl}">

  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 15px; background: #fff; line-height: 1.4; }
    .header-table { width: 100%; border-bottom: 2px solid #0B1E36; padding-bottom: 10px; margin-bottom: 12px; }
    .company-name { font-size: 18px; font-weight: 900; color: #0B1E36; letter-spacing: -0.5px; }
    .doc-badge { display: inline-block; background: #0B1E36; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .info-grid td { vertical-align: top; width: 50%; padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 9.5px; }
    .section-title { font-weight: 800; color: #0B1E36; font-size: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
    .item-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .item-table th { background: #0B1E36; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 6px 8px; border: 1px solid #0B1E36; }
    .item-table td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 9.5px; }
    .item-table tr:nth-child(even) td { background: #f8fafc; }
    .terms-box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px 12px; border-radius: 6px; font-size: 8.5px; line-height: 1.35; margin-bottom: 14px; }
    .signatures-table { width: 100%; margin-top: 15px; border-collapse: collapse; }
    .signatures-table td { width: 50%; vertical-align: bottom; padding: 10px; }
    .sig-line { border-top: 1px solid #475569; padding-top: 4px; font-weight: 700; font-size: 9.5px; }
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 9px; text-transform: uppercase; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Print Controls -->
  <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #f1f5f9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <span style="font-weight: 700; color: #0B1E36;">INVENTRA ERP</span> &bull; 
      <span>Rental Agreement Slip</span> &bull; 
      <span class="status-pill">${agreement.status}</span>
    </div>
    <div style="display: flex; gap: 8px;">
      ${reviewUrl ? `<a href="${reviewUrl}" target="_blank" style="background: #ea580c; color: #fff; text-decoration: none; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 700;">Customer Acknowledge Link &rarr;</a>` : ""}
      <button onclick="window.print()" style="background: #0B1E36; color: #fff; border: none; padding: 5px 14px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">Print / Save as PDF</button>
    </div>
  </div>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="company-name">${companyName}</div>
        <div style="color: #ea580c; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
          Construction Centering Material Rental, Inventory, Asset &amp; Operations ERP
        </div>
        <div style="color: #475569; font-size: 9px; margin-top: 4px; max-width: 400px;">
          ${address}<br>
          GSTIN: <strong style="color: #0f172a;">${gstin}</strong> | PAN: <strong>${pan}</strong> | Mobile: ${phone} | Email: ${email}
        </div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-badge">FORMAL RENTAL AGREEMENT</div>
        <div style="margin-top: 6px; font-family: monospace; font-size: 13px; font-weight: 800; color: #0B1E36;">
          ${agreement.agreementNumber}
        </div>
        <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
          Date: <strong>${new Date(agreement.createdAt).toLocaleDateString("en-IN")}</strong><br>
          Commencement: <strong>${new Date(agreement.startDate).toLocaleDateString("en-IN")}</strong><br>
          ${agreement.orderReference ? `Order Ref / PO #: <strong>${agreement.orderReference}</strong><br>` : ""}
          Status: <strong style="color: #059669;">${agreement.status}</strong> (v${agreement.version})
        </div>
      </td>
    </tr>
  </table>

  <!-- Customer & Site Grid -->
  <table class="info-grid">
    <tr>
      <td>
        <div class="section-title">HIRER / CUSTOMER DETAILS</div>
        <div style="font-weight: 800; font-size: 11px; color: #0f172a; margin-bottom: 2px;">
          ${agreement.customer.name}
        </div>
        <div style="color: #475569;">
          Code: <span style="font-family: monospace; font-weight: 700;">${agreement.customer.customerCode}</span> &bull; 
          GST Status: <strong>${agreement.customer.gstStatus || "UNREGISTERED"}</strong><br>
          ${agreement.customer.gstin ? `GSTIN: <strong style="color: #0f172a;">${agreement.customer.gstin}</strong> &bull; ` : ""}
          ${agreement.customer.pan ? `PAN: <strong>${agreement.customer.pan}</strong><br>` : "<br>"}
          Billing Address: ${agreement.customer.billingAddress || "Office address on file"}<br>
          Primary Mobile: <strong>${agreement.customer.primaryMobile || "-"}</strong> &bull; 
          WhatsApp: <strong>${agreement.customer.whatsappNumber || agreement.customer.primaryMobile || "-"}</strong>
        </div>
      </td>
      <td>
        <div class="section-title">CONSTRUCTION SITE &amp; COMMERCIAL TERMS</div>
        <div style="font-weight: 800; font-size: 11px; color: #0B1E36; margin-bottom: 2px;">
          ${agreement.customerSite.siteName}
        </div>
        <div style="color: #475569;">
          Site Code: <span style="font-family: monospace; font-weight: 700;">${agreement.customerSite.siteCode}</span><br>
          Address: ${agreement.customerSite.fullAddress || "Site location"}<br>
          Site In-Charge: <strong>${agreement.customerSite.siteInCharge || "-"}</strong> &bull; 
          Contact: <strong>${agreement.customerSite.siteContactDetails || "-"}</strong><br>
          Payment Terms: <strong>${agreement.paymentTerms || "Net 15 Days"}</strong> &bull; 
          Billing: <strong>${agreement.billingFrequency || "MONTHLY"} (Day ${agreement.billingCycleDay || 1})</strong><br>
          Security Deposit: <strong>Rs. ${Number(agreement.depositAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong> (${agreement.depositStatus})
        </div>
      </td>
    </tr>
  </table>

  <!-- Materials Table -->
  <div class="section-title" style="margin-bottom: 6px;">AGREED MATERIAL CATALOGUE &amp; DAILY RENTAL TARIFF</div>
  <table class="item-table">
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Material Description &amp; Code</th>
        <th style="width: 70px; text-align: center;">Size</th>
        <th style="width: 60px; text-align: right;">Quantity</th>
        <th style="width: 50px; text-align: center;">UOM</th>
        <th style="width: 90px; text-align: right;">Daily Rate</th>
        <th style="width: 90px; text-align: right;">Sec. Deposit</th>
        <th style="width: 130px;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td colspan="3" style="text-align: right; text-transform: uppercase;">Totals / Estimated Daily Commitment:</td>
        <td style="text-align: right;">${totalQty > 0 ? totalQty.toLocaleString("en-IN") : "-"}</td>
        <td style="text-align: center;">-</td>
        <td style="text-align: right; font-family: monospace; color: #0B1E36;">Rs. ${totalDailyEstimate.toFixed(2)}/day</td>
        <td colspan="2" style="font-size: 8.5px; color: #64748b;">Daily accrual across active site custody</td>
      </tr>
    </tbody>
  </table>

  <!-- Special Terms / Notes -->
  ${
    agreement.specialTerms || agreement.notes
      ? `<div style="margin-bottom: 10px; padding: 6px 10px; background: #fff7ed; border-left: 3px solid #ea580c; font-size: 9px;">
          <strong>Special Agreed Terms / Notes:</strong> ${agreement.specialTerms || ""} ${agreement.notes ? `(${agreement.notes})` : ""}
        </div>`
      : ""
  }

  <!-- Contractual Terms & Conditions -->
  <div class="section-title" style="margin-bottom: 4px;">STATUTORY RENTAL CONDITIONS &amp; COMMERCIAL COVENANTS</div>
  <div class="terms-box">
    ${termsHtml}
  </div>

  <!-- Signatures & Acceptance -->
  <table class="signatures-table">
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 800; color: #0B1E36; font-size: 9.5px; text-transform: uppercase; margin-bottom: 6px;">
          HIRER ACKNOWLEDGEMENT &amp; ACCEPTANCE
        </div>
        <div style="font-size: 9px; color: #475569; min-height: 40px;">
          ${
            agreement.acknowledgedAt
              ? `<div style="padding: 4px 6px; background: #ecfdf5; border-left: 3px solid #10b981; color: #065f46; font-size: 9px;">
                  <strong>DIGITALLY ACCEPTED &amp; CONFIRMED</strong><br>
                  Signer: <strong>${agreement.acknowledgedBy || "Authorized Representative"}</strong><br>
                  ${agreement.acknowledgedDesignation ? `Designation: ${agreement.acknowledgedDesignation} &bull; ` : ""}
                  Phone: ${agreement.acknowledgedPhone || "-"}<br>
                  Timestamp: ${new Date(agreement.acknowledgedAt).toLocaleString("en-IN")}<br>
                  ${agreement.acknowledgedIp ? `Verified Client IP: ${agreement.acknowledgedIp}` : ""}
                </div>`
              : `I / We hereby confirm receipt and unconditional acceptance of the agreed daily rental rates, material quantities, date inclusion rules, damage penalties, and 12 statutory rental conditions defined herein.`
          }
        </div>
        <div style="margin-top: 15px;" class="sig-line">
          ${agreement.acknowledgedBy ? agreement.acknowledgedBy : "Authorised Signatory / Site Representative"}<br>
          <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">For ${agreement.customer.name} (Seal &amp; Signature)</span>
        </div>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 800; color: #0B1E36; font-size: 9.5px; text-transform: uppercase; margin-bottom: 6px;">
          FOR AJAY ENTERPRISES (LESSOR)
        </div>
        <div style="min-height: 40px; display: flex; align-items: flex-end; gap: 15px;">
          ${
            stampBase64
              ? `<img src="${stampBase64}" alt="Company Stamp" style="max-height: 46px; max-width: 90px; object-fit: contain;" />`
              : ""
          }
          ${
            signatureBase64
              ? `<img src="${signatureBase64}" alt="Authorised Signature" style="max-height: 46px; max-width: 120px; object-fit: contain;" />`
              : ""
          }
        </div>
        <div style="margin-top: 15px;" class="sig-line">
          ${signatoryName}<br>
          <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">${signatoryDesignation} &bull; AJAY ENTERPRISES</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Bank & Settlement Footer -->
  <div style="margin-top: 14px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 8.5px; color: #64748b; text-align: center;">
    ${bankDetails} &bull; This electronic agreement is issued per the IT Act &amp; Indian Contract statutory rules.
  </div>
</body>
</html>`;
}

/**
 * Generates the HTML agreement slip, uploads it to private Supabase Storage,
 * and updates RentalAgreement record with the storage path and SHA-256 hash.
 */
export async function generateAgreementPDFAndSave(
  agreementId: string,
  origin: string = ""
): Promise<{ storagePath: string; sha256: string; html: string }> {
  const agreement = await db.rentalAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, agreementNumber: true },
  });

  if (!agreement) {
    throw new Error(`Rental Agreement '${agreementId}' not found.`);
  }

  const html = await generateAgreementHTML(agreementId, origin);
  const buffer = Buffer.from(html, "utf-8");
  const filename = `${agreement.agreementNumber.replace(/[^a-zA-Z0-9_\-]/g, "_")}.html`;

  const saveResult = await savePrivateFile(buffer, filename, "text/html", "agreements");

  await db.rentalAgreement.update({
    where: { id: agreementId },
    data: {
      pdfStoragePath: saveResult.storagePath,
      pdfGeneratedAt: new Date(),
      pdfSha256: saveResult.sha256,
      status: "GENERATED",
    },
  });

  return {
    storagePath: saveResult.storagePath,
    sha256: saveResult.sha256,
    html,
  };
}

/**
 * Dispatches an automated WhatsApp notification for the Rental Agreement.
 * Non-blocking & Safe: updates status to SENT or PENDING_CONFIGURATION without failing agreement.
 */
export async function dispatchAgreementWhatsApp(
  agreementId: string,
  origin: string = "",
  actor?: { id?: string; name?: string; role?: string }
): Promise<{ success: boolean; status: string; messageId?: string; error?: string }> {
  try {
    const agreement = await db.rentalAgreement.findUnique({
      where: { id: agreementId },
      include: {
        customer: true,
        customerSite: true,
        items: true,
      },
    });

    if (!agreement) {
      return { success: false, status: "FAILED", messageId: undefined, error: "Agreement not found" };
    }

    const contact = resolveDocumentWhatsAppContact("AGREEMENT", agreement);
    if (!contact.phone) {
      await db.rentalAgreement.update({
        where: { id: agreementId },
        data: {
          whatsAppStatus: "FAILED",
          whatsAppError: "No valid 10-digit WhatsApp number found on customer profile or site.",
        },
      });
      return {
        success: false,
        status: "FAILED",
        messageId: undefined,
        error: "No valid mobile number configured for customer.",
      };
    }

    const baseUrl = origin ? origin.replace(/\/$/, "") : "";
    const token = agreement.acknowledgementToken;
    const reviewUrl = baseUrl && token
      ? `${baseUrl}/rentals/agreements/${agreement.id}/acknowledge?token=${token}`
      : `${baseUrl}/api/v1/rentals/agreements/${agreement.id}/print`;

    const dispatchResult = await sendWhatsAppNotification(
      {
        recipientMobile: contact.phone,
        recipientName: contact.recipientName || agreement.customer.name,
        templateName: "DN_DISPATCHED", // Reusing base template framework safely
        documentNumber: agreement.agreementNumber,
        documentType: "RentalAgreement",
        parameters: {
          agreement_number: agreement.agreementNumber,
          customer_name: agreement.customer.name,
          site_name: agreement.customerSite.siteName,
          start_date: new Date(agreement.startDate).toLocaleDateString("en-IN"),
          items_count: agreement.items.length,
          review_url: reviewUrl,
        },
        pdfUrl: `${baseUrl}/api/v1/rentals/agreements/${agreement.id}/print`,
      },
      actor
    );

    const isLive = !!process.env.WHATSAPP_BUSINESS_API_KEY;
    const whatsAppStatus = dispatchResult.success
      ? isLive
        ? "SENT"
        : "PENDING_CONFIGURATION"
      : "FAILED";

    await db.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        whatsAppStatus,
        whatsAppMessageId: dispatchResult.messageId || null,
        whatsAppSentAt: dispatchResult.success ? new Date() : null,
        whatsAppRecipient: contact.phone,
        whatsAppError: dispatchResult.error || null,
        status: agreement.status === "DRAFT" || agreement.status === "GENERATED"
          ? "SENT"
          : agreement.status,
      },
    });

    return {
      success: dispatchResult.success,
      status: whatsAppStatus,
      messageId: dispatchResult.messageId,
      error: dispatchResult.error,
    };
  } catch (error: any) {
    console.error(`[Rental Agreement WhatsApp Dispatch Error] Agreement ${agreementId}:`, error);
    await db.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        whatsAppStatus: "FAILED",
        whatsAppError: error.message,
      },
    }).catch(() => {});

    return {
      success: false,
      status: "FAILED",
      messageId: undefined,
      error: error.message,
    };
  }
}

/**
 * Creates a formal Rental Agreement from rental order or delivery note details.
 * Ensures idempotency: reuses existing active agreement if requested and matching.
 */
export async function createRentalAgreementFromOrder(
  input: CreateRentalAgreementServiceInput,
  actor: { id: string; name: string; role: string; ipAddress?: string },
  origin: string = ""
) {
  // 1. Idempotency Check: if reuseExistingIfActive is true, look for existing active agreement
  if (input.reuseExistingIfActive) {
    const existing = await db.rentalAgreement.findFirst({
      where: {
        customerId: input.customerId,
        customerSiteId: input.customerSiteId,
        status: { in: ["ACTIVE", "GENERATED", "SENT"] },
      },
      include: {
        customer: true,
        customerSite: true,
        items: true,
      },
    });

    if (existing) {
      return {
        agreement: existing,
        isNew: false,
        message: `Existing Agreement ${existing.agreementNumber} reused.`,
      };
    }
  }

  // 2. Resolve document number & token
  const agreementNumber = await generateNextDocumentNumber("AGR");
  const acknowledgementToken = crypto.randomBytes(24).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  const endDate = input.endDate ? new Date(input.endDate) : null;

  // 3. Insert agreement in atomic transaction
  const agreement = await db.$transaction(
    async (tx) => {
      const created = await tx.rentalAgreement.create({
        data: {
          agreementNumber,
          customerId: input.customerId,
          customerSiteId: input.customerSiteId,
          startDate,
          endDate,
          billingFrequency: input.billingFrequency || "MONTHLY",
          billingCycleDay: input.billingCycleDay || 1,
          depositAmount: new Prisma.Decimal(input.depositAmount || 0),
          depositStatus: input.depositStatus || (Number(input.depositAmount || 0) > 0 ? "PENDING" : "FULLY_PAID"),
          paymentTerms: input.paymentTerms || "Net 15 Days",
          specialTerms: input.specialTerms || null,
          notes: input.notes || null,
          orderReference: input.orderReference || null,
          status: "GENERATED",
          createdById: actor.id,
          acknowledgementToken,
          tokenExpiresAt,
          items: {
            create: input.items.map((it) => ({
              materialVariantId: it.materialVariantId,
              agreedDailyRate: new Prisma.Decimal(it.agreedDailyRate),
              quantity: it.quantity ? new Prisma.Decimal(it.quantity) : new Prisma.Decimal(0),
              securityDepositRate: it.securityDepositRate ? new Prisma.Decimal(it.securityDepositRate) : null,
              remarks: it.remarks || null,
            })),
          },
        },
        include: {
          customer: true,
          customerSite: true,
          items: {
            include: { materialVariant: true },
          },
        },
      });

      // Link Delivery Note if specified
      if (input.deliveryNoteId) {
        await tx.deliveryNote.update({
          where: { id: input.deliveryNoteId },
          data: { rentalAgreementId: created.id },
        });
      }

      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "CREATE",
          module: "RENTALS",
          entityType: "RentalAgreement",
          entityId: created.id,
          notes: `Created Rental Agreement ${agreementNumber} for ${created.customer.name} (${created.customerSite.siteName}) with ${input.items.length} material lines.`,
        },
        tx
      );

      return created;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  // 4. Generate & Store PDF slip (non-blocking for response)
  try {
    await generateAgreementPDFAndSave(agreement.id, origin);
  } catch (err: any) {
    console.error(`[Rental Agreement PDF Error] ${agreement.agreementNumber}:`, err.message);
  }

  // 5. Automated WhatsApp dispatch (if enabled)
  let whatsAppResult: { success: boolean; status: string; messageId?: string; error?: string } = {
    success: false,
    status: "PENDING",
  };
  if (input.autoSendWhatsApp !== false) {
    whatsAppResult = await dispatchAgreementWhatsApp(agreement.id, origin, actor);
  }

  return {
    agreement,
    isNew: true,
    whatsApp: whatsAppResult,
    message: `Rental Agreement ${agreement.agreementNumber} generated and queued for WhatsApp delivery.`,
  };
}

/**
 * Handles explicit customer acknowledgement or rejection.
 */
export async function acknowledgeRentalAgreement(
  agreementId: string,
  token: string,
  action: "ACCEPT" | "REJECT",
  payload: {
    signerName: string;
    signerPhone?: string;
    signerDesignation?: string;
    rejectionReason?: string;
    ipAddress?: string;
  }
) {
  const agreement = await db.rentalAgreement.findUnique({
    where: { id: agreementId },
    include: { customer: true, customerSite: true },
  });

  if (!agreement) {
    throw new Error("Rental Agreement not found.");
  }

  if (agreement.acknowledgementToken !== token) {
    throw new Error("Invalid or expired acknowledgement link token.");
  }

  if (agreement.tokenExpiresAt && new Date() > agreement.tokenExpiresAt) {
    throw new Error("Acknowledgement link token has expired. Please contact AJAY ENTERPRISES for a fresh agreement link.");
  }

  if (agreement.status === "ACCEPTED" || agreement.status === "ACTIVE") {
    return {
      success: true,
      alreadyAcknowledged: true,
      status: agreement.status,
      message: `Agreement ${agreement.agreementNumber} has already been accepted.`,
    };
  }

  if (action === "ACCEPT") {
    const updated = await db.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        status: "ACTIVE", // Contractually accepted and active
        acknowledgedAt: new Date(),
        acknowledgedBy: payload.signerName,
        acknowledgedPhone: payload.signerPhone || null,
        acknowledgedDesignation: payload.signerDesignation || "Authorised Representative",
        acknowledgedIp: payload.ipAddress || null,
      },
    });

    await logAuditEvent({
      userId: "00000000-0000-0000-0000-000000000000",
      userName: payload.signerName,
      userRole: "CUSTOMER",
      ipAddress: payload.ipAddress,
      action: "APPROVE",
      module: "RENTALS",
      entityType: "RentalAgreement",
      entityId: agreement.id,
      notes: `Customer accepted Rental Agreement ${agreement.agreementNumber}. Signer: ${payload.signerName} (${payload.signerDesignation || "Authorised"}).`,
    });

    return {
      success: true,
      alreadyAcknowledged: false,
      status: "ACTIVE",
      message: `Agreement ${agreement.agreementNumber} accepted successfully.`,
      agreement: updated,
    };
  } else {
    // REJECT
    const updated = await db.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        status: "REJECTED",
        rejectionReason: payload.rejectionReason || "Customer requested revision",
        acknowledgedAt: new Date(),
        acknowledgedBy: payload.signerName,
        acknowledgedPhone: payload.signerPhone || null,
        acknowledgedIp: payload.ipAddress || null,
      },
    });

    await logAuditEvent({
      userId: "00000000-0000-0000-0000-000000000000",
      userName: payload.signerName,
      userRole: "CUSTOMER",
      ipAddress: payload.ipAddress,
      action: "REJECT",
      module: "RENTALS",
      entityType: "RentalAgreement",
      entityId: agreement.id,
      notes: `Customer rejected Rental Agreement ${agreement.agreementNumber}. Reason: ${payload.rejectionReason || "Revision requested"}.`,
    });

    return {
      success: true,
      alreadyAcknowledged: false,
      status: "REJECTED",
      message: `Agreement ${agreement.agreementNumber} marked as rejected.`,
      agreement: updated,
    };
  }
}

/**
 * Creates a formal agreement amendment (versioning).
 */
export async function createRentalAgreementAmendment(
  parentAgreementId: string,
  input: {
    amendmentReason: string;
    startDate?: string;
    endDate?: string | null;
    paymentTerms?: string;
    specialTerms?: string;
    depositAmount?: number;
    items: Array<{ materialVariantId: string; agreedDailyRate: number; quantity?: number; remarks?: string | null }>;
  },
  actor: { id: string; name: string; role: string; ipAddress?: string },
  origin: string = ""
) {
  const parent = await db.rentalAgreement.findUnique({
    where: { id: parentAgreementId },
    include: { items: true },
  });

  if (!parent) {
    throw new Error(`Parent Agreement '${parentAgreementId}' not found.`);
  }

  const nextVersion = parent.version + 1;
  const agreementNumber = `${parent.agreementNumber}-V${nextVersion}`;
  const acknowledgementToken = crypto.randomBytes(24).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const amended = await db.$transaction(
    async (tx) => {
      // Mark parent as SUSPENDED/AMENDED
      await tx.rentalAgreement.update({
        where: { id: parent.id },
        data: { status: "COMPLETED" },
      });

      const created = await tx.rentalAgreement.create({
        data: {
          agreementNumber,
          customerId: parent.customerId,
          customerSiteId: parent.customerSiteId,
          startDate: input.startDate ? new Date(input.startDate) : parent.startDate,
          endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : parent.endDate,
          billingFrequency: parent.billingFrequency,
          billingCycleDay: parent.billingCycleDay,
          depositAmount: input.depositAmount !== undefined ? new Prisma.Decimal(input.depositAmount) : parent.depositAmount,
          depositStatus: parent.depositStatus,
          paymentTerms: input.paymentTerms || parent.paymentTerms,
          specialTerms: input.specialTerms || parent.specialTerms,
          notes: `Amendment to ${parent.agreementNumber}. Reason: ${input.amendmentReason}`,
          status: "GENERATED",
          version: nextVersion,
          parentAgreementId: parent.id,
          amendmentReason: input.amendmentReason,
          acknowledgementToken,
          tokenExpiresAt,
          createdById: actor.id,
          items: {
            create: input.items.map((it) => ({
              materialVariantId: it.materialVariantId,
              agreedDailyRate: new Prisma.Decimal(it.agreedDailyRate),
              quantity: it.quantity ? new Prisma.Decimal(it.quantity) : new Prisma.Decimal(0),
              remarks: it.remarks || null,
            })),
          },
        },
        include: {
          customer: true,
          customerSite: true,
          items: { include: { materialVariant: true } },
        },
      });

      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "UPDATE",
          module: "RENTALS",
          entityType: "RentalAgreement",
          entityId: created.id,
          notes: `Created Amendment ${agreementNumber} for parent ${parent.agreementNumber}. Reason: ${input.amendmentReason}`,
        },
        tx
      );

      return created;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  // Generate & Store PDF
  try {
    await generateAgreementPDFAndSave(amended.id, origin);
  } catch (err: any) {
    console.error(`[Rental Amendment PDF Error] ${agreementNumber}:`, err);
  }

  // Queue WhatsApp
  await dispatchAgreementWhatsApp(amended.id, origin, actor);

  return amended;
}
