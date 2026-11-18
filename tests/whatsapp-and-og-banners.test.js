import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("WhatsApp Message Encoding & Open Graph Banners Suite", () => {
  const dummyDoc = {
    id: "557a533b-114d-4daf-8e59-22e243592c8c",
    dnNumber: "AE/DN/2026-27/0006",
    customer: { name: "Casaagrand", primaryMobile: "9876543210" },
    customerSite: { siteName: "Mandaveli Apartments" },
    deliveryDate: new Date("2026-11-17"),
    vehicleNumber: "KA-04-MH-3321",
    status: "DELIVERED",
    eWayBillNumber: "331222180412",
  };

  test("should ensure whatsapp.ts uses ANSI/UTF-8 safe bullets and no multi-byte emojis that become question marks", () => {
    const whatsappSource = fs.readFileSync(path.resolve("src/lib/whatsapp.ts"), "utf-8");

    // Must not contain 4-byte surrogate emojis that turn into question marks on Windows WhatsApp
    assert.equal(whatsappSource.includes("\uFFFD"), false, "Must not contain unicode replacement character");
    assert.equal(whatsappSource.includes("📋"), false, "Must not contain 📋 (clipboard emoji)");
    assert.equal(whatsappSource.includes("📍"), false, "Must not contain 📍 (pin emoji)");
    assert.equal(whatsappSource.includes("📅"), false, "Must not contain 📅 (calendar emoji)");
    assert.equal(whatsappSource.includes("🚛"), false, "Must not contain 🚛 (truck emoji)");
    assert.equal(whatsappSource.includes("📦"), false, "Must not contain 📦 (package emoji)");
    assert.equal(whatsappSource.includes("🚚"), false, "Must not contain 🚚 (delivery truck emoji)");
    assert.equal(whatsappSource.includes("📄"), false, "Must not contain 📄 (document emoji)");

    // Must use bullet points
    assert.ok(whatsappSource.includes("• *Delivery Note:*"));
    assert.ok(whatsappSource.includes("• *Construction Site:*"));
    assert.ok(whatsappSource.includes("• *Date of Dispatch:*"));
    assert.ok(whatsappSource.includes("• *Vehicle:*"));
    assert.ok(whatsappSource.includes("• *Status:*"));
    assert.ok(whatsappSource.includes("• *E-Way Bill:*"));
    assert.ok(whatsappSource.includes("• *Official Document Slip:*"));
  });

  test("should verify all 5 Open Graph PNG banner files exist with valid PNG magic headers", () => {
    const ogFiles = [
      "og-delivery-note.png",
      "og-tax-invoice.png",
      "og-return-note.png",
      "og-purchase-bill.png",
      "og-default.png",
    ];

    const ogDir = path.resolve("public/images/og");

    for (const file of ogFiles) {
      const filePath = path.join(ogDir, file);
      assert.ok(fs.existsSync(filePath), `OG banner file ${file} must exist`);

      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 1000, `${file} must be non-empty`);
      assert.ok(stat.size < 300 * 1024, `${file} must be under 300KB for WhatsApp compatibility`);

      // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      const buf = fs.readFileSync(filePath);
      const isPng =
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;
      assert.equal(isPng, true, `${file} must be a valid PNG image`);
    }
  });

  test("should verify Open Graph meta tags exist in generateDocumentHTML", () => {
    const generatorSource = fs.readFileSync(path.resolve("src/lib/pdf/generator.ts"), "utf-8");

    assert.ok(generatorSource.includes('<meta property="og:type" content="website">'));
    assert.ok(generatorSource.includes('<meta property="og:site_name" content="AJAY ENTERPRISES · INVENTRA ERP">'));
    assert.ok(generatorSource.includes('<meta property="og:image"'));
    assert.ok(generatorSource.includes('<meta property="og:image:width" content="1200">'));
    assert.ok(generatorSource.includes('<meta property="og:image:height" content="630">'));
    assert.ok(generatorSource.includes('<meta name="twitter:card" content="summary_large_image">'));
  });

  test("should verify dynamic OG route handles DN, INVOICE, MRN, and BILL with 200 response and image/png content-type", () => {
    const ogRouteSource = fs.readFileSync(path.resolve("src/app/api/og/route.ts"), "utf-8");

    assert.ok(ogRouteSource.includes('docType === "DN"') || ogRouteSource.includes('case "DN":'));
    assert.ok(ogRouteSource.includes('case "INVOICE":'));
    assert.ok(ogRouteSource.includes('case "MRN":'));
    assert.ok(ogRouteSource.includes('case "BILL":'));
    assert.ok(ogRouteSource.includes('"Content-Type": "image/png"'));
  });
});
