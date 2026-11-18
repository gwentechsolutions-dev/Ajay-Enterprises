import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = path.resolve("public/images/og");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const BANNERS = [
  {
    filename: "og-delivery-note.png",
    badge: "MATERIAL DELIVERY NOTE (DN)",
    badgeBg: "#F26522",
    title: "Centering Material Delivery Note",
    subtitle: "Official Custody Transfer, GPS Site Acknowledgment & E-Way Bill Verification",
    accentColor: "#F26522",
    iconType: "truck",
  },
  {
    filename: "og-tax-invoice.png",
    badge: "TAX INVOICE & GST BILL",
    badgeBg: "#059669",
    title: "Official GST Tax Invoice",
    subtitle: "Centering Material Rental, Consolidated Billing & Statutory Double-Entry Record",
    accentColor: "#10B981",
    iconType: "invoice",
  },
  {
    filename: "og-return-note.png",
    badge: "MATERIAL RETURN NOTE (MRN)",
    badgeBg: "#0284C7",
    title: "Material Return Note (MRN)",
    subtitle: "Inward Site Return Verification, Inspection & Yard Stock Custody Inward",
    accentColor: "#0EA5E9",
    iconType: "return",
  },
  {
    filename: "og-purchase-bill.png",
    badge: "PURCHASE BILL & ITC",
    badgeBg: "#6366F1",
    title: "Supplier Purchase Bill Record",
    subtitle: "Accounts Payable Booking, Goods Receipt Note & Input Tax Credit Record",
    accentColor: "#818CF8",
    iconType: "bill",
  },
  {
    filename: "og-rental-agreement.png",
    badge: "RENTAL AGREEMENT & CONTRACT",
    badgeBg: "#D97706",
    title: "Centering Material Rental Agreement",
    subtitle: "Official Commercial Rate Contract, Security Terms & Multi-Site Agreement",
    accentColor: "#F59E0B",
    iconType: "agreement",
  },
  {
    filename: "og-default.png",
    badge: "OPERATIONS & INVENTORY ERP",
    badgeBg: "#EA580C",
    title: "AJAY ENTERPRISES ERP",
    subtitle: "Construction Centering Material Rental, Fleet Logistics & Double-Entry Financials",
    accentColor: "#F26522",
    iconType: "default",
  },
];

function getIconSvg(type) {
  switch (type) {
    case "truck":
      return `
        <rect x="2" y="5" width="15" height="11" rx="2" fill="none" stroke="#F26522" stroke-width="2"/>
        <path d="M17 10h4l3 3v3h-7v-6z" fill="none" stroke="#F26522" stroke-width="2"/>
        <circle cx="6" cy="18" r="2.5" fill="#F26522"/>
        <circle cx="18" cy="18" r="2.5" fill="#F26522"/>
      `;
    case "invoice":
      return `
        <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" fill="none" stroke="#10B981" stroke-width="2"/>
        <path d="M8 8h8M8 12h8M8 16h4" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
      `;
    case "return":
      return `
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 3v5h5" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case "bill":
      return `
        <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="#818CF8" stroke-width="2"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#818CF8" stroke-width="2" stroke-linecap="round"/>
      `;
    case "agreement":
      return `
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="#F59E0B" stroke-width="2"/>
        <polyline points="14 2 14 8 20 8" fill="none" stroke="#F59E0B" stroke-width="2"/>
        <path d="M16 13H8M16 17H8M10 9H8" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
      `;
    default:
      return `
        <polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="#F26522" stroke-width="2"/>
        <polyline points="2 17 12 22 22 17" fill="none" stroke="#F26522" stroke-width="2"/>
        <polyline points="2 12 12 17 22 12" fill="none" stroke="#F26522" stroke-width="2"/>
      `;
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSvg(banner) {
  const icon = getIconSvg(banner.iconType);
  const badgeEscaped = escapeXml(banner.badge);
  const titleEscaped = escapeXml(banner.title);
  const subtitleEscaped = escapeXml(banner.subtitle);

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#071322" />
      <stop offset="50%" stop-color="#0B1E36" />
      <stop offset="100%" stop-color="#112540" />
    </linearGradient>

    <linearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${banner.accentColor}" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#EA580C" stop-opacity="0.2" />
    </linearGradient>

    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.04" />
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Subtle Blueprint Grid Pattern -->
  <rect width="1200" height="630" fill="url(#grid)" />

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="1200" height="6" fill="${banner.accentColor}" />

  <!-- Top Decorative Glow Orb -->
  <circle cx="1050" cy="120" r="280" fill="${banner.accentColor}" fill-opacity="0.06" filter="blur(60px)" />
  <circle cx="150" cy="500" r="240" fill="#0EA5E9" fill-opacity="0.03" filter="blur(50px)" />

  <!-- Diagonal Industrial Accent Line -->
  <line x1="850" y1="0" x2="1200" y2="350" stroke="${banner.accentColor}" stroke-opacity="0.15" stroke-width="2" stroke-dasharray="8 8" />

  <!-- Header Section -->
  <g transform="translate(80, 80)">
    <!-- INVENTRA Brand Pill -->
    <rect x="0" y="0" width="126" height="32" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
    <circle cx="18" cy="16" r="5" fill="#F26522" />
    <text x="32" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="1">INVENTRA</text>

    <!-- Operating Business Name -->
    <text x="146" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#94A3B8" letter-spacing="1.5">AJAY ENTERPRISES</text>
  </g>

  <!-- Document Badge -->
  <g transform="translate(80, 140)">
    <rect x="0" y="0" width="${badgeEscaped.length * 10 + 36}" height="38" rx="6" fill="${banner.badgeBg}" />
    <text x="18" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="1.2">${badgeEscaped}</text>
  </g>

  <!-- Hero Title -->
  <g transform="translate(80, 245)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="-0.5">${titleEscaped}</text>
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
    <!-- Pill 1: Verified Document -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="220" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="#10B981" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">Verified Official Slip</text>
    </g>

    <!-- Pill 2: GST and Audit Ready -->
    <g transform="translate(240, 0)">
      <rect x="0" y="0" width="210" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="${banner.accentColor}" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">GST Compliant ERP</text>
    </g>

    <!-- Pill 3: Immutability -->
    <g transform="translate(470, 0)">
      <rect x="0" y="0" width="230" height="42" rx="6" fill="#0F172A" stroke="#334155" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="#0284C7" />
      <text x="36" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#E2E8F0">Immutable Audit Record</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="80" y1="490" x2="1120" y2="490" stroke="#334155" stroke-width="1" />

  <!-- Footer Section -->
  <g transform="translate(80, 540)">
    <!-- Left Footer -->
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#F8FAFC" letter-spacing="0.5">AJAY ENTERPRISES</text>
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748B">Construction Centering Material Rental, Inventory, Asset &amp; Operations ERP</text>

    <!-- Right Footer Security Notice -->
    <g transform="translate(800, 0)">
      <text x="240" y="0" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="${banner.accentColor}">OFFICIAL DOCUMENT PORTAL</text>
      <text x="240" y="24" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#64748B">Tamper-Proof Ledger Record &#8226; Bengaluru, India</text>
    </g>
  </g>
</svg>
`;
}

async function buildBanners() {
  console.log("Generating 1200x630 Open Graph banners...");
  for (const b of BANNERS) {
    const svg = generateSvg(b);
    const dest = path.join(OUTPUT_DIR, b.filename);
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(dest);
    const stat = fs.statSync(dest);
    console.log(`Generated: ${b.filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log("All OG banner images generated successfully.");
}

buildBanners().catch(console.error);
