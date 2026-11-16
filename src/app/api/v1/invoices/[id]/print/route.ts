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

    const [invoice, company] = await Promise.all([
      db.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          customerSite: true,
          rentalStatement: true,
          items: true,
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

    if (!invoice) {
      return NextResponse.json({ success: false, error: { message: "Invoice not found" } }, { status: 404 });
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
      ? `Bank: ${bank.bankName} | A/C: ${bank.accountNumber} | IFSC: ${bank.ifscCode} | Branch: ${bank.branchName || ""}`
      : "Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234";

    const itemRows = invoice.items
      .map(
        (it, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
          <strong>${it.itemDescription}</strong>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${it.hsnSacCode}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${Number(it.quantity).toFixed(2)} ${it.uom}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.unitRate).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.taxableValue).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.cgstAmount).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.sgstAmount).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">₹${Number(it.igstAmount).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">₹${Number(it.totalAmount).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
    .header { border-bottom: 2px solid #0B1E36; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #e2e8f0; }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-unpaid { background: #fee2e2; color: #b91c1c; }
    .table-main { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    .table-main th { background: #0B1E36; color: white; padding: 6px; text-align: left; border: 1px solid #0B1E36; }
    .tot-box { width: 340px; margin-left: auto; margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .tot-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    .footer { margin-top: 25px; display: flex; justify-content: space-between; padding-top: 15px; border-top: 1px solid #e2e8f0; }
    .sig-box { width: 200px; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 10px; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>

  <div class="no-print" style="margin-bottom: 15px; display: flex; gap: 10px;">
    <button onclick="window.print()" style="padding: 6px 14px; background: #F26522; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 20px; color: #0B1E36; font-weight: 800;">${companyName}</h1>
      <p style="margin: 2px 0; font-size: 11px; color: #64748b;">Construction Centering Material Rental & Formwork Equipment</p>
      <p style="margin: 2px 0;">${address}</p>
      <p style="margin: 2px 0;"><strong>GSTIN:</strong> ${gstin} | <strong>State:</strong> Tamil Nadu (33)</p>
      <p style="margin: 2px 0;"><strong>Phone:</strong> ${phone} | <strong>Email:</strong> ${email}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; font-size: 16px; color: #F26522; text-transform: uppercase;">TAX INVOICE</h2>
      <p style="margin: 2px 0; font-size: 13px; font-weight: bold;">${invoice.invoiceNumber}</p>
      <p style="margin: 2px 0;"><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</p>
      <p style="margin: 2px 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}</p>
      <p style="margin: 2px 0;"><strong>Type:</strong> ${invoice.invoiceType}</p>
      <span class="badge ${invoice.paymentStatus === "PAID" ? "status-paid" : "status-unpaid"}">${invoice.paymentStatus}</span>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 12px; background: #fdfdfd;">
    <div style="width: 48%;">
      <h3 style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Billed To:</h3>
      <p style="margin: 0; font-size: 13px; font-weight: bold;">${invoice.customer.name}</p>
      <p style="margin: 2px 0;"><strong>Code:</strong> ${invoice.customer.customerCode}</p>
      <p style="margin: 2px 0;">${invoice.customer.billingAddress || ""}, ${invoice.customer.state || ""}</p>
      <p style="margin: 2px 0;"><strong>GSTIN:</strong> ${invoice.customerGstin || "Unregistered"}</p>
      <p style="margin: 2px 0;"><strong>PAN:</strong> ${invoice.customerPan || "N/A"}</p>
    </div>
    <div style="width: 48%; border-left: 1px solid #e2e8f0; padding-left: 12px;">
      <h3 style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Delivery Site / Destination:</h3>
      <p style="margin: 0; font-weight: bold;">${invoice.customerSite?.siteName || "Consolidated / Multi-Site"}</p>
      <p style="margin: 2px 0;">${invoice.customerSite?.fullAddress || ""}</p>
      <p style="margin: 2px 0;"><strong>Place of Supply:</strong> State Code ${invoice.placeOfSupply} (${invoice.isInterState ? "Inter-State" : "Intra-State"})</p>
      ${invoice.rentalStatement ? `<p style="margin: 2px 0; color: #0284c7;"><strong>Statement Ref:</strong> ${invoice.rentalStatement.statementNumber}</p>` : ""}
    </div>
  </div>

  <table class="table-main">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 32%;">Item Description</th>
        <th style="width: 8%; text-align: center;">HSN/SAC</th>
        <th style="width: 10%; text-align: right;">Qty</th>
        <th style="width: 9%; text-align: right;">Rate</th>
        <th style="width: 11%; text-align: right;">Taxable Value</th>
        <th style="width: 8%; text-align: right;">CGST</th>
        <th style="width: 8%; text-align: right;">SGST</th>
        <th style="width: 8%; text-align: right;">IGST</th>
        <th style="width: 12%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="tot-box">
    <div class="tot-row"><span>Taxable Subtotal:</span><span>₹${Number(invoice.taxableAmount).toFixed(2)}</span></div>
    ${Number(invoice.cgstAmount) > 0 ? `<div class="tot-row"><span>CGST:</span><span>₹${Number(invoice.cgstAmount).toFixed(2)}</span></div>` : ""}
    ${Number(invoice.sgstAmount) > 0 ? `<div class="tot-row"><span>SGST:</span><span>₹${Number(invoice.sgstAmount).toFixed(2)}</span></div>` : ""}
    ${Number(invoice.igstAmount) > 0 ? `<div class="tot-row"><span>IGST:</span><span>₹${Number(invoice.igstAmount).toFixed(2)}</span></div>` : ""}
    <div class="tot-row"><span>Total Tax:</span><span>₹${Number(invoice.totalTaxAmount).toFixed(2)}</span></div>
    ${!Number(invoice.roundOff) === false ? `<div class="tot-row" style="color: #64748b;"><span>Round Off:</span><span>₹${Number(invoice.roundOff).toFixed(2)}</span></div>` : ""}
    <div class="tot-row" style="border-top: 2px solid #0B1E36; margin-top: 6px; padding-top: 4px; font-weight: bold; font-size: 13px; color: #0B1E36;">
      <span>Grand Total:</span><span>₹${Number(invoice.grandTotal).toFixed(2)}</span>
    </div>
    <div class="tot-row" style="color: #059669;"><span>Amount Paid:</span><span>₹${Number(invoice.paidAmount).toFixed(2)}</span></div>
    <div class="tot-row" style="font-weight: bold; color: #dc2626;"><span>Balance Outstanding:</span><span>₹${Number(invoice.outstandingAmount).toFixed(2)}</span></div>
  </div>

  <div style="margin-top: 16px; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 8px; font-size: 10px; background: #fdfdfd;">
    <strong>Bank Payment Details:</strong> ${bankDetails}
  </div>

  <div class="footer">
    <div style="width: 60%; font-size: 9px; color: #64748b;">
      <strong>Terms & Conditions:</strong><br/>
      1. Payment is due within the agreed payment terms.<br/>
      2. Rental charges continue until equipment is physically received back at our warehouse.<br/>
      3. This is a computer-generated tax invoice.
    </div>
    <div class="sig-box" style="width: 240px; text-align: right; position: relative;">
      <div style="font-weight: bold; font-size: 10px; color: #0B1E36;">For ${companyName}</div>
      <div style="min-height: 50px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin: 4px 0;">
        ${stampBase64 ? `<img src="${stampBase64}" alt="Company Seal" style="max-height: 54px; max-width: 80px; object-fit: contain; opacity: 0.9;" />` : ""}
        ${signatureBase64 ? `<img src="${signatureBase64}" alt="Authorised Signature" style="max-height: 42px; max-width: 120px; object-fit: contain;" />` : '<div style="height: 42px;"></div>'}
      </div>
      <div style="font-weight: bold; font-size: 10px; color: #0B1E36;">${signatoryName}</div>
      <div style="font-size: 9px; color: #64748b;">${signatoryDesignation}</div>
    </div>
  </div>

</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
