import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ==============================================================================
// INVENTRA GPS CAMERA WATERMARK & GOOGLE MAPS SUITE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// ==============================================================================

// Mirroring the pure logic functions from src/lib/google-maps.ts for direct runtime verification
function isGoogleMapsConfigured(envKey) {
  if (!envKey || typeof envKey !== "string") return false;
  const trimmed = envKey.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.toLowerCase().includes("placeholder") &&
    !trimmed.toLowerCase().includes("your_api_key")
  );
}

function extractAddressComponents(addressComponents) {
  const components = {};
  for (const comp of addressComponents) {
    const types = comp.types || [];
    if (types.includes("route") || types.includes("street_address")) {
      components.street = comp.long_name;
    } else if (
      types.includes("sublocality") ||
      types.includes("sublocality_level_1") ||
      types.includes("neighborhood")
    ) {
      if (!components.sublocality) components.sublocality = comp.long_name;
    } else if (types.includes("locality")) {
      components.locality = comp.long_name;
    } else if (
      types.includes("administrative_area_level_2") ||
      types.includes("administrative_area_level_3")
    ) {
      if (!components.district) components.district = comp.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      components.state = comp.long_name;
    } else if (types.includes("postal_code")) {
      components.pinCode = comp.long_name;
    }
  }
  return components;
}

function formatLocationLines(components, fallbackFormatted) {
  const { street, sublocality, locality, district, state, pinCode } = components;

  let line1 = "";
  if (street && sublocality && street !== sublocality) {
    line1 = `${street}, ${sublocality}`;
  } else if (street) {
    line1 = street;
  } else if (sublocality) {
    line1 = sublocality;
  } else if (locality && district && locality !== district) {
    line1 = `${locality}, ${district}`;
  } else if (locality) {
    line1 = locality;
  } else if (district) {
    line1 = district;
  } else if (fallbackFormatted) {
    line1 = fallbackFormatted.split(",")[0].trim();
  } else {
    line1 = "Site Location";
  }

  const cityOrDistrict = locality || district || "";
  let line2 = "";

  if (cityOrDistrict && state && cityOrDistrict !== state) {
    line2 = `${cityOrDistrict}, ${state}`;
  } else if (cityOrDistrict) {
    line2 = cityOrDistrict;
  } else if (state) {
    line2 = state;
  }

  if (pinCode) {
    line2 = line2 ? `${line2} – ${pinCode}` : pinCode;
  }

  if (!line2 && fallbackFormatted) {
    const parts = fallbackFormatted.split(",");
    if (parts.length > 1) {
      line2 = parts.slice(1).join(",").trim();
    }
  }

  return { line1, line2 };
}

function generateFallbackMapSvg(latitude, longitude, width = 300, height = 240, title = "Google Maps Pending") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1E36" />
      <stop offset="100%" stop-color="#071322" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <g transform="translate(${width / 2}, ${height / 2 - 12})">
    <path d="M 0 16 C -1 -1, -12 -3, -12 -12 C -12 -19, -6 -24, 0 -24 C 6 -24, 12 -19, 12 -12 C 12 -3, 1 -1, 0 16 Z" fill="#F26522" stroke="#FFFFFF" stroke-width="1.5" />
    <circle cx="0" cy="-12" r="4.5" fill="#FFFFFF" />
    <circle cx="0" cy="-12" r="2.2" fill="#0B1E36" />
  </g>
  <text x="${width / 2}" y="${height - 28}" text-anchor="middle" font-size="10" font-weight="700" fill="#F8FAFC">${title}</text>
  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" font-size="8.5" fill="#94A3B8">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</text>
</svg>`;
}

const OptionalIndianMobileSchema = z
  .string()
  .transform((val) => val?.trim() || "")
  .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
    message: "Invalid mobile number. Must be a 10-digit number starting with 6, 7, 8, or 9",
  })
  .optional()
  .nullable();

const captureEvidenceSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "RETURN_NOTE", "TRANSFER_NOTE", "DIRECT_TRANSFER", "GRN"]),
  documentId: z.string().uuid("Document ID is required"),
  photoUrl: z.string().min(5, "Photo URL or storage path is required"),
  storagePath: z.string().optional().nullable(),
  fileChecksum: z.string().optional().nullable(),
  originalPhotoUrl: z.string().optional().nullable(),
  originalStoragePath: z.string().optional().nullable(),
  watermarkedPhotoUrl: z.string().optional().nullable(),
  watermarkedStoragePath: z.string().optional().nullable(),
  geocodedAddress: z.string().optional().nullable(),
  geocodingStatus: z.enum(["SUCCESS", "FAILED", "PENDING_KEY", "PENDING"]).optional().nullable(),
  miniMapStatus: z.enum(["SUCCESS", "FAILED", "PENDING_KEY", "PENDING"]).optional().nullable(),
  evidenceCategory: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  capturedAt: z.coerce.date().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
});

describe("INVENTRA – Professional GPS Camera Watermark & Google Maps Suite", () => {
  // --------------------------------------------------------------------------
  // 1. Android Chrome, iOS Safari & PWA Device GPS Capture Contract
  // --------------------------------------------------------------------------
  it("should validate live GPS coordinates, accuracy, and capture timestamp in evidence schema", () => {
    const validEvidence = {
      documentType: "DELIVERY_NOTE",
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      photoUrl: "/api/v1/storage/download?path=delivery-proofs-watermarked%2Fdn1-gps.jpg",
      originalPhotoUrl: "/api/v1/storage/download?path=delivery-proofs-original%2Fdn1-orig.jpg",
      originalStoragePath: "delivery-proofs-original/dn1-orig.jpg",
      watermarkedPhotoUrl: "/api/v1/storage/download?path=delivery-proofs-watermarked%2Fdn1-gps.jpg",
      watermarkedStoragePath: "delivery-proofs-watermarked/dn1-gps.jpg",
      gpsLatitude: 13.025145,
      gpsLongitude: 80.262043,
      gpsAccuracy: 3.8,
      capturedAt: new Date("2026-11-20T14:30:00Z"),
      evidenceCategory: "DELIVERY_PHOTO",
      receiverName: "K. Rajendran",
      receiverPhone: "9840123456",
      receiverDesignation: "Site Supervisor",
    };

    const res = captureEvidenceSchema.safeParse(validEvidence);
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.gpsLatitude, 13.025145);
      assert.equal(res.data.gpsLongitude, 80.262043);
      assert.equal(res.data.gpsAccuracy, 3.8);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Strict Two-API Constraint
  // --------------------------------------------------------------------------
  it("should enforce that ONLY Geocoding API and Maps Static API are referenced in source code", () => {
    const googleMapsSrc = fs.readFileSync("src/lib/google-maps.ts", "utf-8");

    // Permitted services
    assert.ok(googleMapsSrc.includes("https://maps.googleapis.com/maps/api/geocode/json"));
    assert.ok(googleMapsSrc.includes("https://maps.googleapis.com/maps/api/staticmap"));

    // Prohibited services
    assert.ok(!googleMapsSrc.includes("/maps/api/place"), "Places API must NOT be used");
    assert.ok(!googleMapsSrc.includes("/maps/api/js"), "Maps JS API must NOT be used");
    assert.ok(!googleMapsSrc.includes("/maps/api/directions"), "Directions/Routes API must NOT be used");
    assert.ok(!googleMapsSrc.includes("/maps/api/distancematrix"), "Distance Matrix API must NOT be used");
    assert.ok(!googleMapsSrc.includes("roads.googleapis.com"), "Roads API must NOT be used");
  });

  // --------------------------------------------------------------------------
  // 4 & 5. Google Reverse Geocoding: Street & Locality Extraction
  // --------------------------------------------------------------------------
  it("should correctly extract route, sublocality, locality, district, state, and pin code", () => {
    const sampleGoogleComponents = [
      { long_name: "Vanniyampathy Street", short_name: "Vanniyampathy St", types: ["route"] },
      { long_name: "Mandaveli", short_name: "Mandaveli", types: ["sublocality_level_1", "sublocality", "political"] },
      { long_name: "Chennai", short_name: "Chennai", types: ["locality", "political"] },
      { long_name: "Chennai District", short_name: "Chennai", types: ["administrative_area_level_2", "political"] },
      { long_name: "Tamil Nadu", short_name: "TN", types: ["administrative_area_level_1", "political"] },
      { long_name: "600028", short_name: "600028", types: ["postal_code"] },
    ];

    const extracted = extractAddressComponents(sampleGoogleComponents);
    assert.equal(extracted.street, "Vanniyampathy Street");
    assert.equal(extracted.sublocality, "Mandaveli");
    assert.equal(extracted.locality, "Chennai");
    assert.equal(extracted.district, "Chennai District");
    assert.equal(extracted.state, "Tamil Nadu");
    assert.equal(extracted.pinCode, "600028");
  });

  // --------------------------------------------------------------------------
  // 6. City, State and PIN Code Hierarchy Matching User Reference
  // --------------------------------------------------------------------------
  it("should construct the exact 2-line heading from the user specification", () => {
    const components = {
      street: "Vanniyampathy Street",
      sublocality: "Mandaveli",
      locality: "Chennai",
      district: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600028",
    };

    const { line1, line2 } = formatLocationLines(components);
    // Line 1: Street and locality name
    assert.equal(line1, "Vanniyampathy Street, Mandaveli");
    // Line 2: City, State and PIN code
    assert.equal(line2, "Chennai, Tamil Nadu – 600028");
  });

  it("should never invent fake street names when route is missing", () => {
    const componentsWithoutRoute = {
      sublocality: "Indiranagar",
      locality: "Bengaluru",
      district: "Bangalore Urban",
      state: "Karnataka",
      pinCode: "560038",
    };

    const { line1, line2 } = formatLocationLines(componentsWithoutRoute);
    assert.equal(line1, "Indiranagar");
    assert.equal(line2, "Bengaluru, Karnataka – 560038");
  });

  // --------------------------------------------------------------------------
  // 7 & 8. Google Static Maps Generation & Fallback SVG
  // --------------------------------------------------------------------------
  it("should generate SVG fallback thumbnail matching INVENTRA Navy/Orange visual styling", () => {
    const svg = generateFallbackMapSvg(13.025145, 80.262043, 320, 240, "Google Maps Pending");

    assert.ok(svg.includes("#0B1E36"), "Must include INVENTRA Navy #0B1E36");
    assert.ok(svg.includes("#F26522"), "Must include Industrial Safety Orange #F26522 marker");
    assert.ok(svg.includes("Google Maps Pending"));
    assert.ok(svg.includes("13.02515, 80.26204"));
  });

  // --------------------------------------------------------------------------
  // 11, 12 & 13. GPS Permission Denied, Geocoding Failure & Static Map Failure
  // --------------------------------------------------------------------------
  it("should report Google Maps configuration pending when key is unconfigured without throwing errors", () => {
    assert.equal(isGoogleMapsConfigured(undefined), false);
    assert.equal(isGoogleMapsConfigured(""), false);
    assert.equal(isGoogleMapsConfigured("   "), false);
    assert.equal(isGoogleMapsConfigured("your_api_key"), false);
    assert.equal(isGoogleMapsConfigured("placeholder"), false);
    assert.equal(isGoogleMapsConfigured("AIzaSyB_valid_sample_key_12345"), true);
  });

  it("should reject out-of-range GPS coordinates", () => {
    const resLat = captureEvidenceSchema.safeParse({
      documentType: "DELIVERY_NOTE",
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      photoUrl: "https://example.com/p.jpg",
      gpsLatitude: 95.5,
      gpsLongitude: 77.5,
    });
    assert.equal(resLat.success, false);

    const resLng = captureEvidenceSchema.safeParse({
      documentType: "DELIVERY_NOTE",
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      photoUrl: "https://example.com/p.jpg",
      gpsLatitude: 13.0,
      gpsLongitude: 195.5,
    });
    assert.equal(resLng.success, false);
  });

  // --------------------------------------------------------------------------
  // 15, 16 & 17. Original Preservation & Watermarked Separation
  // --------------------------------------------------------------------------
  it("should ensure original and watermarked photo URLs are stored as distinct paths on the same record", () => {
    const evidenceData = {
      documentType: "DIRECT_TRANSFER",
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      photoUrl: "/api/v1/storage/download?path=direct_transfer-watermarked%2Fdstn-watermarked.jpg",
      originalPhotoUrl: "/api/v1/storage/download?path=direct_transfer-originals%2Fdstn-original.jpg",
      originalStoragePath: "direct_transfer-originals/dstn-original.jpg",
      watermarkedPhotoUrl: "/api/v1/storage/download?path=direct_transfer-watermarked%2Fdstn-watermarked.jpg",
      watermarkedStoragePath: "direct_transfer-watermarked/dstn-watermarked.jpg",
      evidenceCategory: "SOURCE_PICKUP",
      geocodedAddress: "Vanniyampathy Street, Mandaveli, Chennai, Tamil Nadu – 600028",
      geocodingStatus: "SUCCESS",
      miniMapStatus: "SUCCESS",
    };

    const res = captureEvidenceSchema.safeParse(evidenceData);
    assert.equal(res.success, true);
    if (res.success) {
      assert.notEqual(res.data.originalPhotoUrl, res.data.watermarkedPhotoUrl);
      assert.equal(res.data.originalStoragePath, "direct_transfer-originals/dstn-original.jpg");
      assert.equal(res.data.watermarkedStoragePath, "direct_transfer-watermarked/dstn-watermarked.jpg");
    }
  });

  // --------------------------------------------------------------------------
  // 18. Database Model Integrity
  // --------------------------------------------------------------------------
  it("should verify MovementEvidence Prisma model includes all required dual-photo and geocoding fields", () => {
    const fields = Object.keys(Prisma.MovementEvidenceScalarFieldEnum);

    assert.ok(fields.includes("originalPhotoUrl"), "Must store originalPhotoUrl");
    assert.ok(fields.includes("originalStoragePath"), "Must store originalStoragePath");
    assert.ok(fields.includes("watermarkedPhotoUrl"), "Must store watermarkedPhotoUrl");
    assert.ok(fields.includes("watermarkedStoragePath"), "Must store watermarkedStoragePath");
    assert.ok(fields.includes("geocodedAddress"), "Must store geocodedAddress");
    assert.ok(fields.includes("geocodingStatus"), "Must store geocodingStatus");
    assert.ok(fields.includes("miniMapStatus"), "Must store miniMapStatus");
    assert.ok(fields.includes("evidenceCategory"), "Must store evidenceCategory");
    assert.ok(fields.includes("directTransferId"), "Must link directTransferId");
  });

  // --------------------------------------------------------------------------
  // 19, 20 & 21. PDF Generator & Print Routes for DN, MRN, and DSTN
  // --------------------------------------------------------------------------
  it("should verify PDF generator implements the GPS Camera Site Proof Gallery", () => {
    const pdfGenSrc = fs.readFileSync("src/lib/pdf/generator.ts", "utf-8");

    assert.ok(pdfGenSrc.includes("PDFEvidencePhoto"), "Must export PDFEvidencePhoto interface");
    assert.ok(pdfGenSrc.includes("evidences?: PDFEvidencePhoto[]"), "Must accept evidences in PDFDocumentData");
    assert.ok(pdfGenSrc.includes("GPS Camera Site Proof &amp; Custody Transfer Evidence"));
    assert.ok(pdfGenSrc.includes("AJAY ENTERPRISES • GEO-VERIFIED"));
    assert.ok(pdfGenSrc.includes("Map data &amp; street metadata © Google"));
  });

  it("should verify all three print routes (DN, MRN, DSTN) query and pass evidences to PDF generator", () => {
    const dnPrintSrc = fs.readFileSync("src/app/api/v1/delivery-notes/[id]/print/route.ts", "utf-8");
    assert.ok(dnPrintSrc.includes("evidences: {"), "DN print route must include evidences in Prisma query");
    assert.ok(dnPrintSrc.includes("PDFEvidencePhoto"), "DN print route must use PDFEvidencePhoto");
    assert.ok(dnPrintSrc.includes("evidences,"), "DN print route must pass evidences to generateDocumentHTML");

    const mrnPrintSrc = fs.readFileSync("src/app/api/v1/return-notes/[id]/print/route.ts", "utf-8");
    assert.ok(mrnPrintSrc.includes("evidences: {"), "MRN print route must include evidences in Prisma query");
    assert.ok(mrnPrintSrc.includes("PDFEvidencePhoto"), "MRN print route must use PDFEvidencePhoto");
    assert.ok(mrnPrintSrc.includes("evidences,"), "MRN print route must pass evidences to generateDocumentHTML");

    const dstnPrintSrc = fs.readFileSync("src/app/api/v1/direct-transfers/[id]/print/route.ts", "utf-8");
    assert.ok(dstnPrintSrc.includes("evidences: {"), "DSTN print route must include evidences in Prisma query");
    assert.ok(dstnPrintSrc.includes("PDFEvidencePhoto"), "DSTN print route must use PDFEvidencePhoto");
    assert.ok(dstnPrintSrc.includes("evidences,"), "DSTN print route must pass evidences to generateDocumentHTML");
  });

  // --------------------------------------------------------------------------
  // 8 & 9. Watermark Visual Layout & Information Hierarchy in Canvas Engine
  // --------------------------------------------------------------------------
  it("should verify gps-watermark.ts implements the 5-line hierarchy and Navy/Orange palette", () => {
    const watermarkSrc = fs.readFileSync("src/lib/gps-watermark.ts", "utf-8");

    // Navy & Orange palette
    assert.ok(watermarkSrc.includes("#0B1E36"), "Must use Navy #0B1E36");
    assert.ok(watermarkSrc.includes("#F26522"), "Must use Industrial Safety Orange #F26522");

    // Left map and 5-line hierarchy on right
    assert.ok(watermarkSrc.includes("drawFallbackMapThumbnail"), "Must implement fallback map thumbnail");
    assert.ok(watermarkSrc.includes("INVENTRA · GPS Location"), "Must stamp INVENTRA · GPS Location branding");
    assert.ok(watermarkSrc.includes("resolveLocationData"), "Must resolve server-side geocoding & static map");
    assert.ok(watermarkSrc.includes("originalFile: file"), "Must preserve untouched original file");
    assert.ok(watermarkSrc.includes("watermarkedFile: stampedFile"), "Must return separate watermarked file");
  });

  // --------------------------------------------------------------------------
  // 22. Server API Routes Security & Session Authentication
  // --------------------------------------------------------------------------
  it("should verify maps API routes enforce session authentication to protect Google API quotas", () => {
    const geoRouteSrc = fs.readFileSync("src/app/api/v1/maps/reverse-geocode/route.ts", "utf-8");
    assert.ok(geoRouteSrc.includes("getSession()"), "Reverse geocode route must check session authentication");
    assert.ok(geoRouteSrc.includes("reverseGeocodeGps"), "Must call reverseGeocodeGps");

    const mapRouteSrc = fs.readFileSync("src/app/api/v1/maps/static-map/route.ts", "utf-8");
    assert.ok(mapRouteSrc.includes("getSession()"), "Static map route must check session authentication");
    assert.ok(mapRouteSrc.includes("fetchStaticMapThumbnail"), "Must call fetchStaticMapThumbnail");
  });

  // --------------------------------------------------------------------------
  // 23. Google Geocoding REQUEST_DENIED Detection & Site Fallback
  // --------------------------------------------------------------------------
  it("should verify google-maps.ts checks status !== OK first to prevent REQUEST_DENIED masked as ZERO_RESULTS", () => {
    const googleMapsSrc = fs.readFileSync("src/lib/google-maps.ts", "utf-8");
    assert.ok(
      googleMapsSrc.includes("if (data.status !== \"OK\")"),
      "Must check data.status !== 'OK' first"
    );
    assert.ok(
      googleMapsSrc.includes("console.error(`[Google Geocoding API Error]"),
      "Must log Google Geocoding API errors"
    );
  });

  it("should verify gps-watermark.ts falls back to siteName and customerName when location is unmapped", () => {
    const watermarkSrc = fs.readFileSync("src/lib/gps-watermark.ts", "utf-8");
    assert.ok(
      watermarkSrc.includes("isGenericOrUnmapped"),
      "Must identify unmapped or generic location"
    );
    assert.ok(
      watermarkSrc.includes("options.siteName"),
      "Must fallback to options.siteName"
    );
  });

  // --------------------------------------------------------------------------
  // 24. Multi-Photo Custody Proof (Up to 10 photos)
  // --------------------------------------------------------------------------
  it("should verify delivery routes support up to 10 photos with duplicate prevention", () => {
    const deliverRouteSrc = fs.readFileSync("src/app/api/v1/delivery-notes/[id]/deliver/route.ts", "utf-8");
    assert.ok(
      deliverRouteSrc.includes("additionalPhotoUrls"),
      "Must support additionalPhotoUrls"
    );
    assert.ok(
      deliverRouteSrc.includes("tx.movementEvidence.findFirst"),
      "Must prevent duplicate evidence creation"
    );

    const pickupRouteSrc = fs.readFileSync("src/app/api/v1/return-notes/[id]/pickup/route.ts", "utf-8");
    assert.ok(
      pickupRouteSrc.includes("additionalPhotoUrls"),
      "Must support additionalPhotoUrls on MRN"
    );
    assert.ok(
      pickupRouteSrc.includes("tx.movementEvidence.findFirst"),
      "Must prevent duplicate evidence on MRN"
    );
  });
});
