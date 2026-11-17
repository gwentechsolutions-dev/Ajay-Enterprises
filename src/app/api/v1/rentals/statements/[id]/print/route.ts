import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");
    const { id } = await params;

    const [statement, company] = await Promise.all([
      db.rentalStatement.findUnique({
        where: { id },
        include: {
          customer: true,
          customerSite: true,
          siteSummaries: {
            include: { customerSite: true },
          },
          items: {
            include: {
              materialVariant: true,
              customerSite: true,
            },
            orderBy: [{ customerSiteId: "asc" }, { materialVariantId: "asc" }],
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

    if (!statement) {
      return NextResponse.json({ success: false, error: { message: "Statement not found" } }, { status: 404 });
    }

    const defaultSignatory = company?.signatories[0];
    const signatoryName = defaultSignatory?.name || "Authorised Signatory";
    const signatoryDesignation = defaultSignatory?.designation || "Authorised Signatory";

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
    const phone = company?.primaryMobile || "+91 98765 43210";
    const email = company?.officialEmail || "billing@ajayenterprises.com";
    const address = company?.addresses[0]
      ? `${company.addresses[0].addressLine1}, ${company.addresses[0].city}, ${company.addresses[0].state} - ${company.addresses[0].pinCode}`
      : "123 Industrial Estate, Chennai, Tamil Nadu - 600001";

    const bank = company?.bankAccounts[0];
    const bankDetails = bank
      ? `Bank: ${bank.bankName} | A/C: ${bank.accountNumber} | IFSC: ${bank.ifscCode} | Branch: ${bank.branchName}`
      : "Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234";

    const itemRows =
      statement.items.length > 0
        ? statement.items
            .map(
              (it, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
          <strong>${it.materialVariant.name}</strong><br/>
          <small style="color: #64748b;">Code: ${it.materialVariant.materialCode} | Site: ${it.customerSite.siteName}</small>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${Number(it.openingHeldQty).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${Number(it.newDeliveredQty).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${Number(it.returnedQty).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">${Number(it.closingHeldQty).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${it.billableDays}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.applicableDailyRate).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">₹${Number(it.rentalAmount).toFixed(2)}</td>
      </tr>
    `
            )
            .join("")
        : `<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 18px; text-align: center; color: #64748b; font-style: italic;">No individual itemized material records found for this statement period.</td></tr>`;

    const siteSummaryRows = statement.siteSummaries
      .map(
        (ss, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${ss.customerSite.siteName} (${ss.customerSite.siteCode})</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(ss.siteRentalAmount).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(ss.siteDamageCharges).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(ss.siteMissingCharges).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">₹${Number(ss.siteTotalAmount).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rental Statement - ${statement.statementNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { border-bottom: 2px solid #0B1E36; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #e2e8f0; }
    .status-finalized { background: #dcfce7; color: #15803d; }
    .table-main { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; table-layout: fixed; }
    .table-main th {
      background: #0B1E36;
      color: #ffffff;
      padding: 6px 4px;
      border: 1px solid #0B1E36;
      vertical-align: bottom;
      font-size: 9.5px;
      font-weight: 700;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .table-main td {
      border: 1px solid #cbd5e1;
      padding: 6px 4px;
      vertical-align: middle;
      word-break: break-word;
    }
    .tot-box { width: 320px; margin-left: auto; margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .tot-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .sig-box { width: 220px; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 10px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
      .table-main th {
        background: #0B1E36 !important;
        color: #ffffff !important;
        border-color: #0B1E36 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="background: #0B1E36; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Print Statement
    </button>
  </div>

  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 20px; color: #0B1E36;">${companyName}</h1>
      <p style="margin: 3px 0; color: #475569; font-size: 10px;">${address}</p>
      <p style="margin: 3px 0; color: #475569; font-size: 10px;">GSTIN: <strong>${gstin}</strong> | Mobile: ${phone} | Email: ${email}</p>
      <p style="margin: 3px 0; color: #64748b; font-size: 9px;">${bankDetails}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; font-size: 14px; color: #F26522; text-transform: uppercase;">MONTHLY RENTAL STATEMENT</h2>
      <p style="margin: 4px 0; font-weight: bold; font-size: 12px;">${statement.statementNumber}</p>
      <span class="badge ${statement.status === "FINALIZED" ? "status-finalized" : ""}">${statement.status}</span>
      <p style="margin: 4px 0; font-size: 10px; color: #64748b;">Mode: <strong>${statement.billingMode}</strong></p>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
    <div style="width: 48%;">
      <span style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold;">Customer Details:</span>
      <p style="margin: 2px 0; font-weight: bold; font-size: 12px; color: #0f172a;">${statement.customer.name}</p>
      <p style="margin: 2px 0; font-size: 10px; color: #475569;">Code: ${statement.customer.customerCode} | GSTIN: ${statement.customer.gstin || "Unregistered"}</p>
      <p style="margin: 2px 0; font-size: 10px; color: #475569;">${statement.customer.billingAddress}</p>
    </div>
    <div style="width: 48%; text-align: right;">
      <span style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold;">Billing Period & Site:</span>
      <p style="margin: 2px 0; font-weight: bold; font-size: 11px; color: #0B1E36;">
        ${new Date(statement.periodStartDate).toLocaleDateString()} to ${new Date(statement.periodEndDate).toLocaleDateString()}
      </p>
      ${
        statement.customerSite
          ? `<p style="margin: 2px 0; font-size: 10px; color: #475569;">Site: <strong>${statement.customerSite.siteName}</strong> (${statement.customerSite.siteCode})</p>
             <p style="margin: 2px 0; font-size: 9px; color: #64748b;">${statement.customerSite.fullAddress}</p>`
          : `<p style="margin: 2px 0; font-size: 10px; color: #475569;">Covering <strong>${statement.siteSummaries.length} Construction Sites</strong> (Consolidated)</p>`
      }
    </div>
  </div>

  ${
    statement.siteSummaries.length > 0 && statement.billingMode === "CONSOLIDATED"
      ? `
    <h3 style="margin: 12px 0 6px 0; font-size: 11px; color: #0B1E36;">Site-wise Consolidated Breakdown</h3>
    <table class="table-main" style="margin-bottom: 16px;">
      <thead>
        <tr>
          <th style="width: 4%; text-align: center; vertical-align: bottom;">#</th>
          <th style="width: 40%; text-align: left; vertical-align: bottom;">Construction Site</th>
          <th style="width: 14%; text-align: right; vertical-align: bottom;">Rental Amount</th>
          <th style="width: 14%; text-align: right; vertical-align: bottom;">Damage Claims</th>
          <th style="width: 14%; text-align: right; vertical-align: bottom;">Missing Claims</th>
          <th style="width: 14%; text-align: right; vertical-align: bottom;">Site Total</th>
        </tr>
      </thead>
      <tbody>
        ${siteSummaryRows}
      </tbody>
    </table>
  `
      : ""
  }

  <h3 style="margin: 12px 0 6px 0; font-size: 11px; color: #0B1E36;">Itemized Daily Rental Accrual Breakdown</h3>
  <table class="table-main">
    <thead>
      <tr>
        <th style="width: 3.5%; text-align: center; vertical-align: bottom;">#</th>
        <th style="width: 31%; text-align: left; vertical-align: bottom;">Material Description</th>
        <th style="width: 9%; text-align: right; vertical-align: bottom;">Opening<br/>Qty</th>
        <th style="width: 9.5%; text-align: right; vertical-align: bottom;">New<br/>Delivered</th>
        <th style="width: 9%; text-align: right; vertical-align: bottom;">Returned<br/>Qty</th>
        <th style="width: 9%; text-align: right; vertical-align: bottom;">Closing<br/>Qty</th>
        <th style="width: 6%; text-align: center; vertical-align: bottom;">Days</th>
        <th style="width: 10%; text-align: right; vertical-align: bottom;">Rate /<br/>Day</th>
        <th style="width: 13%; text-align: right; vertical-align: bottom;">Total<br/>(INR)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="tot-box">
    <div class="tot-row">
      <span>Total Rental Accrual:</span>
      <strong>₹${Number(statement.totalRentalAmount).toFixed(2)}</strong>
    </div>
    ${
      Number(statement.totalDamageCharges) > 0
        ? `<div class="tot-row" style="color: #dc2626;"><span>Damage Charges:</span><strong>+ ₹${Number(statement.totalDamageCharges).toFixed(2)}</strong></div>`
        : ""
    }
    ${
      Number(statement.totalMissingCharges) > 0
        ? `<div class="tot-row" style="color: #dc2626;"><span>Missing Charges:</span><strong>+ ₹${Number(statement.totalMissingCharges).toFixed(2)}</strong></div>`
        : ""
    }
    ${
      Number(statement.totalAdjustments) !== 0
        ? `<div class="tot-row"><span>Adjustments:</span><strong>₹${Number(statement.totalAdjustments).toFixed(2)}</strong></div>`
        : ""
    }
    <div class="tot-row" style="border-top: 1px solid #cbd5e1; margin-top: 6px; padding-top: 6px; font-size: 13px; color: #0B1E36;">
      <strong>Net Payable:</strong>
      <strong style="color: #F26522;">₹${Number(statement.netPayableAmount).toFixed(2)}</strong>
    </div>
    <div class="tot-row" style="font-size: 9px; color: #64748b; margin-top: 4px;">
      <span>Previous Outstanding (Informational):</span>
      <span>₹${Number(statement.previousBalanceInformational).toFixed(2)}</span>
    </div>
  </div>

  <div style="margin-top: 16px; font-size: 9px; color: #64748b; line-height: 1.4;">
    <strong>Terms & Custody Notice:</strong><br/>
    1. This document is a monthly statement of equipment rental custody and daily usage calculation.<br/>
    2. Tax invoices and GST details will be billed separately in accordance with applicable statutory rules.<br/>
    3. Any discrepancy in physical material counts or rate calculation must be reported within 7 days of statement receipt.
  </div>

  <div class="footer">
    <div class="sig-box" style="width: 220px; text-align: left; padding: 6px;">
      <div style="font-size: 9px; font-weight: bold; color: #475569;">Customer Site In-charge / Authorised Receiver</div>
      <div style="height: 50px;"></div>
      <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 8.5px; color: #64748b;">(Signature & Site Seal)</div>
    </div>
    <div class="sig-box" style="width: 240px; text-align: right; position: relative;">
      <div style="font-weight: bold; font-size: 9.5px; color: #0B1E36;">For <strong>${companyName}</strong></div>
      <div style="min-height: 50px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin: 4px 0;">
        ${stampBase64 ? `<img src="${stampBase64}" alt="Company Seal" style="max-height: 54px; max-width: 80px; object-fit: contain; opacity: 0.9;" />` : ""}
        ${signatureBase64 ? `<img src="${signatureBase64}" alt="Authorised Signature" style="max-height: 42px; max-width: 120px; object-fit: contain;" />` : '<div style="height: 42px;"></div>'}
      </div>
      <div style="font-weight: bold; font-size: 9.5px; color: #0B1E36;">${signatoryName}</div>
      <div style="font-size: 8.5px; color: #64748b;">${signatoryDesignation}</div>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
