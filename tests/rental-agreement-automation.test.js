import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

describe("Rental Agreement Automation & WhatsApp Sharing Suite", () => {
  const dummyUuid = "00000000-0000-0000-0000-000000000001";

  // Schemas matching application source
  const createDeliveryNoteSchema = z.object({
    dnNumber: z.string().optional(),
    customerId: z.string().uuid("Customer is required"),
    customerSiteId: z.string().uuid("Customer construction site is required"),
    sourceWarehouseId: z.string().uuid("Source warehouse is required"),
    deliveryDate: z.string().optional(),
    driverName: z.string().optional().nullable(),
    driverPhone: z.string().optional().nullable(),
    vehicleNumber: z.string().optional().nullable(),
    transportMode: z.string().default("COMPANY_VEHICLE"),
    eWayBillNumber: z.string().optional().nullable(),
    contactPersonId: z.string().uuid().optional().nullable().or(z.literal("")),
    rentalAgreementId: z.string().uuid().optional().nullable().or(z.literal("")),
    autoGenerateAgreement: z.boolean().default(true),
    notes: z.string().optional().nullable(),
    transportCharges: z.coerce.number().min(0).optional().nullable(),
    items: z.array(
      z.object({
        materialVariantId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
        dailyRate: z.coerce.number().min(0).optional().nullable(),
        condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
        remarks: z.string().optional().nullable(),
      })
    ).min(1),
  });

  const rentalAgreementItemSchema = z.object({
    materialVariantId: z.string().uuid(),
    agreedDailyRate: z.coerce.number().min(0),
    quantity: z.coerce.number().min(0).optional().nullable(),
    securityDepositRate: z.coerce.number().min(0).optional().nullable(),
    remarks: z.string().optional().nullable(),
  });

  test("should verify all 12 Standard Contractual Terms exist per business rules in agreement-terms.ts", () => {
    const termsSource = fs.readFileSync(path.resolve("src/lib/rentals/agreement-terms.ts"), "utf-8");

    assert.ok(termsSource.includes("COMMENCEMENT & BILLING CYCLE"), "Condition 1 must cover commencement");
    assert.ok(termsSource.includes("DATE INCLUSION RULES (BUSINESS RULE #12)"), "Condition 2 must cover Rule #12 Date Inclusion");
    assert.ok(termsSource.includes("DAILY RENTAL ACCRUAL & CHARGES"), "Condition 3 must cover daily rental charges");
    assert.ok(termsSource.includes("PARTIAL MATERIAL RETURNS"), "Condition 4 must cover partial returns");
    assert.ok(termsSource.includes("MATERIAL INSPECTION & ACCEPTANCE"), "Condition 5 must cover inspection");
    assert.ok(termsSource.includes("DAMAGED MATERIAL RESPONSIBILITY"), "Condition 6 must cover damage responsibility");
    assert.ok(termsSource.includes("MISSING MATERIAL & REPLACEMENT CHARGES"), "Condition 7 must cover missing material replacement");
    assert.ok(termsSource.includes("TRANSPORTATION & FREIGHT RESPONSIBILITY"), "Condition 8 must cover one-time transportation");
    assert.ok(termsSource.includes("PAYMENT DUE DATES & COMMERCIAL TERMS"), "Condition 9 must cover payment terms");
    assert.ok(termsSource.includes("SECURITY DEPOSIT"), "Condition 10 must cover security deposit");
    assert.ok(termsSource.includes("SITE CLOSURE & FINAL SETTLEMENT"), "Condition 11 must cover site closure and final settlement");
    assert.ok(termsSource.includes("STATUTORY JURISDICTION & DISPUTE RESOLUTION"), "Condition 12 must cover statutory jurisdiction");
    assert.ok(termsSource.includes("Chennai, Tamil Nadu"), "Statutory jurisdiction must be Chennai, Tamil Nadu");
  });

  test("should verify WhatsApp service handles docType AGREEMENT with ANSI safe bullets", () => {
    const whatsappSource = fs.readFileSync(path.resolve("src/lib/whatsapp.ts"), "utf-8");

    assert.ok(whatsappSource.includes('"AGREEMENT"'), "Must handle AGREEMENT document type in whatsapp.ts");
    assert.ok(whatsappSource.includes("Centering Material Rental Agreement"), "Must contain formal agreement subject");
    assert.ok(whatsappSource.includes("• *Agreement #:"), "Must use bullet points for Agreement No");
    assert.ok(whatsappSource.includes("• *Construction Site:"), "Must use bullet points for Construction Site");
    assert.ok(whatsappSource.includes("Review & Acknowledge"), "Must provide online review & acknowledge link");
    assert.ok(whatsappSource.includes("Official Agreement Slip"), "Must provide printable document slip link");

    // Must not contain unicode replacement character
    assert.equal(whatsappSource.includes("\uFFFD"), false, "Must not contain unicode replacement characters");
  });

  test("should verify Open Graph agreement preview banner exists and is valid PNG < 300KB", () => {
    const bannerPath = path.resolve("public/images/og/og-rental-agreement.png");
    assert.ok(fs.existsSync(bannerPath), "og-rental-agreement.png must exist in public/images/og/");

    const stat = fs.statSync(bannerPath);
    assert.ok(stat.size > 1000, "Banner must be non-empty");
    assert.ok(stat.size < 300 * 1024, `Banner size (${stat.size} bytes) must be under 300KB for WhatsApp`);

    // PNG Magic Header: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const fd = fs.openSync(bannerPath, "r");
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const expectedHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.ok(buffer.equals(expectedHeader), "Must have valid PNG header magic bytes");
  });

  test("should verify dynamic OG route handles AGREEMENT type", () => {
    const ogRoute = fs.readFileSync(path.resolve("src/app/api/og/route.ts"), "utf-8");
    assert.ok(ogRoute.includes('"AGREEMENT"'), "OG route must support AGREEMENT / AGR");
    assert.ok(ogRoute.includes("RENTAL AGREEMENT"), "OG route must contain Rental Agreement label");
  });

  test("should verify createDeliveryNoteSchema supports rentalAgreementId and autoGenerateAgreement", () => {
    const parsedWithAgreement = createDeliveryNoteSchema.safeParse({
      customerId: dummyUuid,
      customerSiteId: dummyUuid,
      sourceWarehouseId: dummyUuid,
      rentalAgreementId: dummyUuid,
      autoGenerateAgreement: true,
      items: [
        {
          materialVariantId: dummyUuid,
          quantity: 50,
        },
      ],
    });

    assert.ok(parsedWithAgreement.success, "Schema must accept valid rentalAgreementId");
    assert.equal(parsedWithAgreement.data.rentalAgreementId, dummyUuid);
    assert.equal(parsedWithAgreement.data.autoGenerateAgreement, true);

    const parsedWithoutAgreement = createDeliveryNoteSchema.safeParse({
      customerId: dummyUuid,
      customerSiteId: dummyUuid,
      sourceWarehouseId: dummyUuid,
      items: [
        {
          materialVariantId: dummyUuid,
          quantity: 50,
        },
      ],
    });

    assert.ok(parsedWithoutAgreement.success, "Schema must allow omitting rentalAgreementId");
    assert.equal(parsedWithoutAgreement.data.autoGenerateAgreement, true, "autoGenerateAgreement should default to true");
  });

  test("should verify delivery note API auto-links or auto-generates rental agreement", () => {
    const dnRoute = fs.readFileSync(path.resolve("src/app/api/v1/delivery-notes/route.ts"), "utf-8");
    assert.ok(dnRoute.includes("createRentalAgreementFromOrder"), "Delivery Note API must import createRentalAgreementFromOrder");
    assert.ok(dnRoute.includes("rentalAgreementId: agreementId"), "Delivery Note creation must store rentalAgreementId");
    assert.ok(dnRoute.includes("rentalAgreement:"), "Delivery Note GET & POST must include rentalAgreement");
  });

  test("should verify rental agreement schema supports quantity field per item", () => {
    const parsed = rentalAgreementItemSchema.safeParse({
      materialVariantId: dummyUuid,
      quantity: 150,
      agreedDailyRate: 1.84,
    });

    assert.ok(parsed.success, "Rental agreement item schema must accept quantity");
    assert.equal(parsed.data.quantity, 150);
  });

  test("should verify customer acknowledgement page exists and middleware allows public access", () => {
    const pagePath = path.resolve("src/app/rentals/agreements/[id]/acknowledge/page.tsx");
    assert.ok(fs.existsSync(pagePath), "Customer acknowledgement page must exist");

    const pageContent = fs.readFileSync(pagePath, "utf-8");
    assert.ok(pageContent.includes("AJAY ENTERPRISES"), "Must display AJAY ENTERPRISES identity");
    assert.ok(pageContent.includes("Confirm & Accept Agreement"), "Must provide accept button");
    assert.ok(pageContent.includes("Reject / Dispute Agreement"), "Must provide reject button");

    const middlewarePath = path.resolve("src/middleware.ts");
    const middlewareContent = fs.readFileSync(middlewarePath, "utf-8");
    assert.ok(
      middlewareContent.includes("/rentals/agreements/") && middlewareContent.includes("/acknowledge"),
      "Middleware must permit public access to customer agreement acknowledgement"
    );
  });

  test("should verify Rental Agreements UI contains NO native <select> tags (Rule #2)", () => {
    const uiPath = path.resolve("src/app/(authenticated)/rentals/agreements/page.tsx");
    const uiContent = fs.readFileSync(uiPath, "utf-8");

    assert.ok(uiContent.includes("SearchableCombobox"), "Must use SearchableCombobox for dropdowns");
    // Verify no native <select> elements in primary UI
    assert.equal(uiContent.includes("<select"), false, "Native <select> elements are strictly forbidden (Rule #2)");
    assert.ok(uiContent.includes("handleOpenWhatsAppModal"), "Must include WhatsApp share dialog");
    assert.ok(uiContent.includes("handleOpenAmendModal"), "Must include versioned amendment dialog");
  });

  test("should verify agreement amendment API exists with versioning support", () => {
    const amendRoute = fs.readFileSync(path.resolve("src/app/api/v1/rentals/agreements/[id]/amend/route.ts"), "utf-8");
    assert.ok(amendRoute.includes("createRentalAgreementAmendment"), "Must import createRentalAgreementAmendment");
    assert.ok(amendRoute.includes("amendmentReason"), "Must require amendment reason");
  });

  test("should verify agreement print endpoint exists for public WhatsApp slip viewing", () => {
    const printRoute = fs.readFileSync(path.resolve("src/app/api/v1/rentals/agreements/[id]/print/route.ts"), "utf-8");
    assert.ok(printRoute.includes("generateAgreementHTML"), "Must use generateAgreementHTML");
    const serviceSource = fs.readFileSync(path.resolve("src/lib/rentals/agreement-service.ts"), "utf-8");
    assert.ok(serviceSource.includes("og:image"), "Must include og:image meta tag for WhatsApp preview");
    assert.ok(serviceSource.includes("og-rental-agreement.png") || serviceSource.includes("type=AGREEMENT"), "Must include agreement image in OG tags");
  });
});
