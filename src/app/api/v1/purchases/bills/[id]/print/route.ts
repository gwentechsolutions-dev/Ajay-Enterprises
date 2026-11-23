import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (session) {
      await requirePermission(session, "purchases", "view");
    }

    const { id } = await params;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const [bill, company] = await Promise.all([
      db.purchaseBill.findFirst({
        where: {
          OR: [{ id }, { billNumber: id }],
        },
        include: {
          supplier: true,
          items: {
            include: {
              materialVariant: true,
            },
          },
        },
      }),
      db.companyProfile.findFirst({
        include: {
          addresses: { where: { isDefaultBilling: true } },
          bankAccounts: { where: { isPrimary: true } },
        },
      }),
    ]);

    if (!bill) {
      return new NextResponse("Purchase Bill not found", { status: 404 });
    }

    const companyName = company?.legalName || "AJAY ENTERPRISES";
    const companyAddress = company?.addresses[0]
      ? `${company.addresses[0].addressLine1}, ${company.addresses[0].city}, ${company.addresses[0].state} - ${company.addresses[0].pinCode}`
      : "Centering Material Yard, Chennai, Tamil Nadu";
    const companyGstin = company?.gstin || "33AABCA1234F1Z5";

    const grandTotalFormatted = Number(bill.grandTotal).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const taxableAmountFormatted = Number(bill.taxableAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const totalTaxFormatted = Number(bill.totalTaxAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const paidAmountFormatted = Number(bill.paidAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const outstandingFormatted = Number(bill.outstandingAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });

    // Static high-res 1200x630 CDN image for ultra-fast edge response
    const ogImageUrl = `${origin}/images/og/og-purchase-bill.png`;
    const slipUrl = `${origin}/slips/bills/${bill.id}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Bill - ${bill.billNumber} | AJAY ENTERPRISES</title>

  <!-- Open Graph / WhatsApp Social Preview Metadata -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AJAY ENTERPRISES · INVENTRA ERP">
  <meta property="og:url" content="${slipUrl}">
  <meta property="og:title" content="Purchase Bill • ${bill.billNumber}">
  <meta property="og:description" content="Official Purchase Bill Record from ${bill.supplier.name} • Total: Rs. ${grandTotalFormatted} — AJAY ENTERPRISES Accounts Payable">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:secure_url" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Purchase Bill ${bill.billNumber} - AJAY ENTERPRISES">
  <meta property="og:locale" content="en_IN">

  <!-- WhatsApp & Social Media Crawler Signals -->
  <link rel="image_src" href="${ogImageUrl}">
  <meta name="robots" content="all, index, follow, max-image-preview:large">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Purchase Bill • ${bill.billNumber}">
  <meta name="twitter:description" content="Official Purchase Bill from ${bill.supplier.name} — AJAY ENTERPRISES">
  <meta name="twitter:image" content="${ogImageUrl}">

  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11pt; line-height: 1.4; background-color: #f8fafc; }
    .sheet-container { background: #ffffff; max-width: 210mm; margin: 0 auto; padding: 18mm; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #0B1E36; padding-bottom: 8px; }
    .company-title { font-size: 20pt; font-weight: 800; color: #0B1E36; margin: 0; }
    .doc-badge { display: inline-block; background-color: #6366F1; color: #ffffff; font-weight: 700; font-size: 10pt; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; margin-bottom: 4px; }
    .doc-num { font-size: 13pt; font-weight: 800; color: #0B1E36; font-family: monospace; }
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .info-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background-color: #f8fafc; font-size: 9.5pt; vertical-align: top; width: 48%; }
    .info-box-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #6366F1; margin-bottom: 4px; }
    .party-name { font-size: 11pt; font-weight: 700; color: #0B1E36; margin-bottom: 2px; }
    .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; font-size: 9.5pt; }
    .item-table th { background-color: #0B1E36; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 9pt; text-transform: uppercase; }
    .item-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .totals-table { width: 45%; margin-left: auto; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
    .totals-table td { padding: 4px 8px; }
    .grand-total { font-size: 12pt; font-weight: 800; color: #0B1E36; border-top: 2px solid #0B1E36; }
    @media print {
      body { background: transparent !important; padding: 0 !important; }
      .sheet-container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet-container">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="company-title">${companyName}</h1>
          <div style="font-size: 9pt; color: #475569; margin-top: 2px;">${companyAddress}</div>
          <div style="font-size: 9pt; color: #475569;">GSTIN: <strong>${companyGstin}</strong></div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <span class="doc-badge">PURCHASE BILL RECORD</span>
          <div class="doc-num">${bill.billNumber}</div>
          <div style="font-size: 9pt; color: #475569; margin-top: 4px;">
            Booking Date: <strong>${new Date(bill.billDate).toLocaleDateString("en-IN")}</strong>
          </div>
          <div style="font-size: 9pt; color: #475569;">
            Payment Status: <strong>${bill.paymentStatus}</strong>
          </div>
        </td>
      </tr>
    </table>

    <table class="info-grid">
      <tr>
        <td class="info-box">
          <div class="info-box-title">Supplier / Billed By</div>
          <div class="party-name">${bill.supplier.name}</div>
          <div style="color: #475569; margin-bottom: 2px;">${bill.supplier.billingAddress || "Supplier Address"}</div>
          <div style="color: #475569;">GSTIN: <strong>${bill.supplierGstin || bill.supplier.gstin || "Unregistered"}</strong></div>
          <div style="color: #475569;">Mobile: ${bill.supplier.primaryMobile || "N/A"}</div>
        </td>
        <td style="width: 4%;"></td>
        <td class="info-box">
          <div class="info-box-title">Bill &amp; Statutory References</div>
          <div>Supplier Invoice Ref: <strong>${bill.supplierInvoiceNumber}</strong></div>
          <div>Invoice Date: <strong>${new Date(bill.supplierInvoiceDate).toLocaleDateString("en-IN")}</strong></div>
          <div>Due Date: <strong>${new Date(bill.dueDate).toLocaleDateString("en-IN")}</strong></div>
          <div>ITC Eligibility: <strong>${bill.itcEligibility}</strong></div>
          <div>Place of Supply: <strong>State Code ${bill.placeOfSupply}</strong></div>
        </td>
      </tr>
    </table>

    <table class="item-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 45%;">Item / Description</th>
          <th style="width: 15%; text-align: right;">Quantity</th>
          <th style="width: 15%; text-align: right;">Rate (₹)</th>
          <th style="width: 20%; text-align: right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${bill.items
          .map(
            (it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>
              <strong>${it.materialVariant?.name || it.description}</strong>
              ${it.materialVariant?.size ? `<span style="color: #64748b; font-size: 8.5pt;"> (${it.materialVariant.size})</span>` : ""}
            </td>
            <td style="text-align: right;">${Number(it.quantity).toFixed(2)} ${it.uom}</td>
            <td style="text-align: right;">₹${Number(it.unitRate).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">₹${Number(it.totalAmount).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td style="color: #64748b;">Taxable Amount:</td>
        <td style="text-align: right;">₹${taxableAmountFormatted}</td>
      </tr>
      <tr>
        <td style="color: #64748b;">Total GST (CGST/SGST/IGST):</td>
        <td style="text-align: right;">₹${totalTaxFormatted}</td>
      </tr>
      ${Number(bill.tdsAmount) > 0 ? `
      <tr>
        <td style="color: #64748b;">TDS Deducted (${bill.tdsPercent}%):</td>
        <td style="text-align: right; color: #b91c1c;">-₹${Number(bill.tdsAmount).toFixed(2)}</td>
      </tr>` : ""}
      <tr class="grand-total">
        <td>Grand Total:</td>
        <td style="text-align: right;">₹${grandTotalFormatted}</td>
      </tr>
      <tr>
        <td style="color: #15803d; font-weight: 600;">Paid Amount:</td>
        <td style="text-align: right; color: #15803d; font-weight: 600;">₹${paidAmountFormatted}</td>
      </tr>
      <tr>
        <td style="color: #b91c1c; font-weight: 700;">Outstanding Due:</td>
        <td style="text-align: right; color: #b91c1c; font-weight: 700;">₹${outstandingFormatted}</td>
      </tr>
    </table>

    <div style="font-size: 8.5pt; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center;">
      This is a system-generated Purchase Bill Record from INVENTRA ERP for AJAY ENTERPRISES. Accounts Payable &amp; Input Tax Credit verified.
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "all, index, follow, max-image-preview:large",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    return new Response(`Error generating bill view: ${error.message}`, { status: 500 });
  }
}
