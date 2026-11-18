import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

export const runtime = "nodejs";

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getIconSvg(type: string): string {
  switch (type.toUpperCase()) {
    case "DN":
      return `
        <rect x="2" y="5" width="15" height="11" rx="2" fill="none" stroke="#F26522" stroke-width="2"/>
        <path d="M17 10h4l3 3v3h-7v-6z" fill="none" stroke="#F26522" stroke-width="2"/>
        <circle cx="6" cy="18" r="2.5" fill="#F26522"/>
        <circle cx="18" cy="18" r="2.5" fill="#F26522"/>
      `;
    case "INVOICE":
      return `
        <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" fill="none" stroke="#10B981" stroke-width="2"/>
        <path d="M8 8h8M8 12h8M8 16h4" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
      `;
    case "MRN":
      return `
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 3v5h5" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case "BILL":
      return `
        <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="#818CF8" stroke-width="2"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#818CF8" stroke-width="2" stroke-linecap="round"/>
      `;
    default:
      return `
        <polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="#F26522" stroke-width="2"/>
        <polyline points="2 17 12 22 22 17" fill="none" stroke="#F26522" stroke-width="2"/>
        <polyline points="2 12 12 17 22 12" fill="none" stroke="#F26522" stroke-width="2"/>
      `;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docType = (searchParams.get("type") || "DEFAULT").toUpperCase();
    const docNumber = searchParams.get("docNumber") || "";
    const party = searchParams.get("party") || "";
    const site = searchParams.get("site") || "";
    const amount = searchParams.get("amount") || "";
    const status = searchParams.get("status") || "VERIFIED";

    let badge = "OFFICIAL DOCUMENT";
    let badgeBg = "#F26522";
    let accentColor = "#F26522";
    let title = "AJAY ENTERPRISES ERP";
    let subtitle = "Construction Centering Material Rental, Inventory, Asset & Operations";
    let fallbackFileName = "og-default.png";

    switch (docType) {
      case "DN":
        badge = "MATERIAL DELIVERY NOTE (DN)";
        badgeBg = "#F26522";
        accentColor = "#F26522";
        title = docNumber ? `Delivery Note: ${docNumber}` : "Material Delivery Note";
        subtitle = party ? `Custody Dispatch for ${party}${site ? ` (${site})` : ""}` : "Custody Transfer & GPS Site Delivery Proof";
        fallbackFileName = "og-delivery-note.png";
        break;
      case "INVOICE":
        badge = "TAX INVOICE & GST BILL";
        badgeBg = "#059669";
        accentColor = "#10B981";
        title = docNumber ? `Tax Invoice: ${docNumber}` : "Official Tax Invoice";
        subtitle = party ? `Issued to ${party}${amount ? ` • Total: Rs. ${amount}` : ""}` : "Centering Material Rental & Service Invoice";
        fallbackFileName = "og-tax-invoice.png";
        break;
      case "MRN":
        badge = "MATERIAL RETURN NOTE (MRN)";
        badgeBg = "#0284C7";
        accentColor = "#0EA5E9";
        title = docNumber ? `Return Note: ${docNumber}` : "Material Return Note";
        subtitle = party ? `Returned by ${party}${site ? ` from ${site}` : ""}` : "Inward Site Return Verification & Yard Stock Inward";
        fallbackFileName = "og-return-note.png";
        break;
      case "BILL":
        badge = "PURCHASE BILL & ITC";
        badgeBg = "#6366F1";
        accentColor = "#818CF8";
        title = docNumber ? `Purchase Bill: ${docNumber}` : "Supplier Purchase Bill";
        subtitle = party ? `Supplier: ${party}${amount ? ` • Total: Rs. ${amount}` : ""}` : "Accounts Payable & Input Tax Credit Record";
        fallbackFileName = "og-purchase-bill.png";
        break;
    }

    const badgeEscaped = escapeXml(badge);
    const titleEscaped = escapeXml(title);
    const subtitleEscaped = escapeXml(subtitle);
    const partyEscaped = escapeXml(party);
    const statusEscaped = escapeXml(status);
    const icon = getIconSvg(docType);

    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#071322" />
      <stop offset="50%" stop-color="#0B1E36" />
      <stop offset="100%" stop-color="#112540" />
    </linearGradient>

    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.04" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#grid)" />
  <rect x="0" y="0" width="1200" height="6" fill="${accentColor}" />

  <circle cx="1050" cy="120" r="280" fill="${accentColor}" fill-opacity="0.06" filter="blur(60px)" />
  <line x1="850" y1="0" x2="1200" y2="350" stroke="${accentColor}" stroke-opacity="0.15" stroke-width="2" stroke-dasharray="8 8" />

  <!-- Header Section -->
  <g transform="translate(80, 80)">
    <rect x="0" y="0" width="126" height="32" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <circle cx="18" cy="16" r="5" fill="#F26522" />
    <text x="32" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="1">INVENTRA</text>
    <text x="146" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#94A3B8" letter-spacing="1.5">AJAY ENTERPRISES</text>
  </g>

  <!-- Document Badge -->
  <g transform="translate(80, 140)">
    <rect x="0" y="0" width="${badgeEscaped.length * 9.5 + 36}" height="38" rx="6" fill="${badgeBg}" />
    <text x="18" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="1.2">${badgeEscaped}</text>
  </g>

  <!-- Hero Title -->
  <g transform="translate(80, 245)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="46" font-weight="900" fill="#ffffff" letter-spacing="-0.5">${titleEscaped}</text>
  </g>

  <!-- Subtitle / Context -->
  <g transform="translate(80, 305)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="21" font-weight="500" fill="#94A3B8" letter-spacing="0.2">${subtitleEscaped}</text>
  </g>

  <!-- Central Watermark Icon Graphic -->
  <g transform="translate(900, 180)">
    <circle cx="100" cy="100" r="95" fill="#1E293B" fill-opacity="0.6" stroke="#334155" stroke-width="2" />
    <g transform="translate(60, 60) scale(3.2)">
      ${icon}
    </g>
  </g>

  <!-- Feature Highlights / Badges in center-lower -->
  <g transform="translate(80, 370)">
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="220" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="#10B981" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">Status: ${statusEscaped}</text>
    </g>

    <g transform="translate(240, 0)">
      <rect x="0" y="0" width="210" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="${accentColor}" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">GST Compliant ERP</text>
    </g>

    <g transform="translate(470, 0)">
      <rect x="0" y="0" width="230" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="#0284C7" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">Verified Official Slip</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="80" y1="490" x2="1120" y2="490" stroke="#334155" stroke-width="1" />

  <!-- Footer Section -->
  <g transform="translate(80, 540)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#F8FAFC" letter-spacing="0.5">AJAY ENTERPRISES</text>
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748B">Construction Centering Material Rental, Inventory, Asset &amp; Operations ERP</text>

    <g transform="translate(800, 0)">
      <text x="240" y="0" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="${accentColor}">OFFICIAL DOCUMENT PORTAL</text>
      <text x="240" y="24" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#64748B">Tamper-Proof Ledger Record &#8226; Bengaluru, India</text>
    </g>
  </g>
</svg>
`;

    const pngBuffer = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, quality: 90 })
      .toBuffer();

    return new Response(pngBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error generating dynamic OG image:", error);
    // Serve fallback static image
    try {
      const fallbackPath = path.resolve("public/images/og/og-default.png");
      const fileBuffer = fs.readFileSync(fallbackPath);
      return new Response(fileBuffer as any, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return new Response("Error generating banner", { status: 500 });
    }
  }
}
