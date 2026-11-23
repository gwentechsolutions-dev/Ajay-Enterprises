import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumentWhatsAppMessage, resolveDocumentWhatsAppContact } from "../src/lib/whatsapp.ts";

test("WhatsApp & Social Media Share URL Formatting", async (t) => {
  const origin = "https://ajay-enterprises-gwen-tech.vercel.app";

  await t.test("Delivery Note (DN) WhatsApp message generates clean /slips/ link", () => {
    const doc = {
      id: "0a20f764-c1a9-48e4-b058-32f667462896",
      dnNumber: "AE/DN/2026-27/0015",
      customer: { name: "Land Marvel Apartments" },
      customerSite: { siteName: "Land Marvel Apartments" },
      deliveryDate: new Date("2026-10-07"),
      vehicleNumber: "KA-04-MH-3321",
      status: "DRAFT",
    };
    const msg = buildDocumentWhatsAppMessage("DN", doc, origin);
    assert.match(msg, /https:\/\/ajay-enterprises-gwen-tech\.vercel\.app\/slips\/delivery-notes\/0a20f764-c1a9-48e4-b058-32f667462896/);
    assert.doesNotMatch(msg, /\/api\/v1\//, "Should not contain raw /api/v1/ endpoints");
  });

  await t.test("Material Return Note (MRN) WhatsApp message generates clean /slips/ link", () => {
    const doc = {
      id: "1b30f764-c1a9-48e4-b058-32f667462897",
      mrnNumber: "AE/MRN/2026-27/0008",
      customer: { name: "Prestige Construction" },
      customerSite: { siteName: "Prestige Tech Park" },
      returnDate: new Date("2026-10-08"),
      status: "POSTED",
    };
    const msg = buildDocumentWhatsAppMessage("MRN", doc, origin);
    assert.match(msg, /https:\/\/ajay-enterprises-gwen-tech\.vercel\.app\/slips\/return-notes\/1b30f764-c1a9-48e4-b058-32f667462897/);
    assert.doesNotMatch(msg, /\/api\/v1\//);
  });

  await t.test("Tax Invoice WhatsApp message generates clean /slips/ link", () => {
    const doc = {
      id: "2c40f764-c1a9-48e4-b058-32f667462898",
      invoiceNumber: "INV-2026-0042",
      customer: { name: "Sobha Developers" },
      grandTotal: 154500,
      outstandingAmount: 154500,
      paymentStatus: "UNPAID",
    };
    const msg = buildDocumentWhatsAppMessage("INVOICE", doc, origin);
    assert.match(msg, /https:\/\/ajay-enterprises-gwen-tech\.vercel\.app\/slips\/invoices\/2c40f764-c1a9-48e4-b058-32f667462898/);
    assert.doesNotMatch(msg, /\/api\/v1\//);
  });

  await t.test("Purchase Bill WhatsApp message generates clean /slips/ link", () => {
    const doc = {
      id: "3d50f764-c1a9-48e4-b058-32f667462899",
      billNumber: "PB-2026-0012",
      supplier: { name: "Tata Steel Tubes Ltd" },
      grandTotal: 88500,
      paymentStatus: "PENDING",
    };
    const msg = buildDocumentWhatsAppMessage("BILL", doc, origin);
    assert.match(msg, /https:\/\/ajay-enterprises-gwen-tech\.vercel\.app\/slips\/bills\/3d50f764-c1a9-48e4-b058-32f667462899/);
    assert.doesNotMatch(msg, /\/api\/v1\//);
  });

  await t.test("Rental Agreement WhatsApp message generates clean /slips/ link", () => {
    const doc = {
      id: "4e60f764-c1a9-48e4-b058-32f667462890",
      agreementNumber: "AGR-2026-0005",
      customer: { name: "Brigade Enterprises" },
      customerSite: { siteName: "Brigade Gateway" },
      startDate: new Date("2026-10-01"),
      status: "ACTIVE",
    };
    const msg = buildDocumentWhatsAppMessage("AGREEMENT", doc, origin);
    assert.match(msg, /https:\/\/ajay-enterprises-gwen-tech\.vercel\.app\/slips\/agreements\/4e60f764-c1a9-48e4-b058-32f667462890/);
    assert.doesNotMatch(msg, /\/api\/v1\//);
  });
});
