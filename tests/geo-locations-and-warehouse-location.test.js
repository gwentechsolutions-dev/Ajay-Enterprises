import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Statutory schemas
const IndianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number");
const IndianPinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit Indian PIN code");

// Warehouse Schema under test (matching src/lib/schemas/branch.ts)
const warehouseSchema = z.object({
  warehouseCode: z
    .string()
    .min(2, "Warehouse code must be at least 2 characters")
    .max(10, "Warehouse code too long")
    .regex(/^[A-Z0-9_-]+$/, "Warehouse code must be uppercase alphanumeric (e.g. WH-01)"),
  name: z.string().min(2, "Warehouse name is required"),
  branchId: z.string().uuid("Please select a parent branch"),
  warehouseType: z.enum(["MAIN_YARD", "SECONDARY_YARD", "SATELLITE_YARD"]).default("MAIN_YARD"),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pinCode: IndianPinCodeSchema,
  contactPerson: z.string().min(2, "Contact person is required"),
  mobile: IndianMobileSchema,
  gpsLatitude: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || (typeof val === "number" && Number.isNaN(val)) ? null : Number(val)),
    z.number().min(-90).max(90).nullable().optional()
  ),
  gpsLongitude: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || (typeof val === "number" && Number.isNaN(val)) ? null : Number(val)),
    z.number().min(-180).max(180).nullable().optional()
  ),
  mapsUrl: z.string().optional().nullable().or(z.literal("")),
  storageCapacitySqFt: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

// Geographic definitions matching src/lib/constants/geo-locations.ts
const DEFAULT_STATE = "Tamil Nadu";
const DEFAULT_STATE_CODE = "33";
const DEFAULT_CITY = "Chennai";
const DEFAULT_DISTRICT = "Chennai";

const INDIAN_STATES = [
  { name: "Tamil Nadu", code: "33" },
  { name: "Karnataka", code: "29" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Kerala", code: "32" },
  { name: "Telangana", code: "36" },
  { name: "Puducherry", code: "34", isUnionTerritory: true },
  { name: "Maharashtra", code: "27" },
  { name: "Delhi", code: "07", isUnionTerritory: true },
];

function getStateCode(stateName) {
  if (!stateName) return DEFAULT_STATE_CODE;
  const normalized = stateName.toLowerCase().replace(/[\s_-]+/g, "");
  const match = INDIAN_STATES.find(
    (s) => s.name.toLowerCase().replace(/[\s_-]+/g, "") === normalized
  );
  return match ? match.code : DEFAULT_STATE_CODE;
}

function getCitiesForState(stateName) {
  const POPULAR_CITIES = {
    "Tamil Nadu": [
      "Chennai",
      "Coimbatore",
      "Madurai",
      "Tiruchirappalli",
      "Salem",
      "Tiruppur",
      "Erode",
      "Ambattur",
      "Guindy",
      "Poonamallee",
    ],
  };
  return POPULAR_CITIES[stateName] || ["Chennai", "Coimbatore"];
}

// Google Maps pure validators (matching src/lib/geo/google-maps.ts)
function isAllowlistedGoogleMapsUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return false;
  const trimmed = inputUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "maps.app.goo.gl") return true;
    if (hostname === "goo.gl" && parsed.pathname.startsWith("/maps")) return true;
    if (/^maps\.google\.(com|co\.[a-z]{2}|[a-z]{2,})$/.test(hostname)) return true;
    if (/^(www\.)?google\.(com|co\.[a-z]{2}|[a-z]{2,})$/.test(hostname)) {
      return parsed.pathname.startsWith("/maps");
    }
    return false;
  } catch {
    return false;
  }
}

function extractCoordinatesFromUrlString(urlString) {
  if (!urlString || typeof urlString !== "string") return null;
  try {
    const decoded = decodeURIComponent(urlString);
    const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
    }
    const queryMatch = decoded.match(/(?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,|\+|\s+)(-?\d+\.\d+)/i);
    if (queryMatch) {
      return { latitude: parseFloat(queryMatch[1]), longitude: parseFloat(queryMatch[2]) };
    }
  } catch {
    // ignore
  }
  return null;
}

describe("INVENTRA – Geo Locations, Tamil Nadu Defaults & Single Location Input Suite", () => {
  describe("1. Geographic Defaults & Tamil Nadu Masters", () => {
    it("should verify default state is Tamil Nadu and default GST code is 33", () => {
      assert.strictEqual(DEFAULT_STATE, "Tamil Nadu");
      assert.strictEqual(DEFAULT_STATE_CODE, "33");
      assert.strictEqual(DEFAULT_CITY, "Chennai");
      assert.strictEqual(DEFAULT_DISTRICT, "Chennai");
    });

    it("should resolve state code accurately for various spellings", () => {
      assert.strictEqual(getStateCode("Tamil Nadu"), "33");
      assert.strictEqual(getStateCode("TamilNadu"), "33");
      assert.strictEqual(getStateCode("tamil nadu"), "33");
      assert.strictEqual(getStateCode("Karnataka"), "29");
      assert.strictEqual(getStateCode("Maharashtra"), "27");
      assert.strictEqual(getStateCode("Delhi"), "07");
    });

    it("should provide major Tamil Nadu cities list with Chennai first", () => {
      const tnCities = getCitiesForState("Tamil Nadu");
      assert.ok(Array.isArray(tnCities));
      assert.strictEqual(tnCities[0], "Chennai");
      assert.ok(tnCities.includes("Coimbatore"));
      assert.ok(tnCities.includes("Madurai"));
      assert.ok(tnCities.includes("Ambattur"));
      assert.ok(tnCities.includes("Guindy"));
      assert.ok(tnCities.includes("Poonamallee"));
    });
  });

  describe("2. Warehouse / Yard Schema & Optional Location Guarantees", () => {
    const baseWarehouseData = {
      warehouseCode: "WH-CHN-01",
      name: "AJAY ENTERPRISES Ambattur Yard",
      branchId: "00000000-0000-0000-0000-000000000001",
      warehouseType: "MAIN_YARD",
      addressLine1: "Plot 42, 3rd Phase, Ambattur Industrial Estate",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600058",
      contactPerson: "Yard Manager",
      mobile: "9845011112",
    };

    it("should successfully validate when GPS coordinates are omitted (optional)", () => {
      const result = warehouseSchema.safeParse(baseWarehouseData);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.gpsLatitude, null);
      assert.strictEqual(result.data.gpsLongitude, null);
    });

    it("should successfully validate when GPS fields are empty strings", () => {
      const result = warehouseSchema.safeParse({
        ...baseWarehouseData,
        gpsLatitude: "",
        gpsLongitude: "",
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.gpsLatitude, null);
      assert.strictEqual(result.data.gpsLongitude, null);
    });

    it("should successfully validate when GPS fields are null or undefined", () => {
      const result = warehouseSchema.safeParse({
        ...baseWarehouseData,
        gpsLatitude: null,
        gpsLongitude: null,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.gpsLatitude, null);
      assert.strictEqual(result.data.gpsLongitude, null);
    });

    it("should gracefully handle NaN (which happens with empty HTML type=number inputs) without failing", () => {
      const result = warehouseSchema.safeParse({
        ...baseWarehouseData,
        gpsLatitude: NaN,
        gpsLongitude: NaN,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.gpsLatitude, null);
      assert.strictEqual(result.data.gpsLongitude, null);
    });

    it("should accept valid numeric coordinates when provided via Google Maps extraction", () => {
      const result = warehouseSchema.safeParse({
        ...baseWarehouseData,
        gpsLatitude: 13.0827,
        gpsLongitude: 80.2707,
        mapsUrl: "https://maps.app.goo.gl/abcdef",
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.gpsLatitude, 13.0827);
      assert.strictEqual(result.data.gpsLongitude, 80.2707);
      assert.strictEqual(result.data.mapsUrl, "https://maps.app.goo.gl/abcdef");
    });

    it("should reject invalid coordinates that exceed geographic boundaries", () => {
      const result = warehouseSchema.safeParse({
        ...baseWarehouseData,
        gpsLatitude: 120.0, // Invalid latitude > 90
        gpsLongitude: 80.2707,
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe("3. Google Maps Single Location Link Validation & Coordinates Extraction", () => {
    it("should validate allowlisted Google Maps share URLs", () => {
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://maps.app.goo.gl/qX8yz"), true);
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://goo.gl/maps/qX8yz"), true);
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://maps.google.com/?q=13.0827,80.2707"), true);
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://www.google.com/maps/place/Chennai"), true);
    });

    it("should reject malicious or non-Google domains to prevent SSRF", () => {
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://evil.com/fake-maps"), false);
      assert.strictEqual(isAllowlistedGoogleMapsUrl("https://169.254.169.254/latest/meta-data"), false);
      assert.strictEqual(isAllowlistedGoogleMapsUrl("javascript:alert(1)"), false);
    });

    it("should extract coordinates from standard Google Maps URLs directly", () => {
      const coords = extractCoordinatesFromUrlString("https://maps.google.com/?q=13.0827,80.2707");
      assert.ok(coords);
      assert.strictEqual(coords.latitude, 13.0827);
      assert.strictEqual(coords.longitude, 80.2707);
    });

    it("should extract coordinates from @lat,lng Google Maps URLs", () => {
      const coords = extractCoordinatesFromUrlString(
        "https://www.google.com/maps/place/Ambattur/@13.0982,80.1614,15z/data=!3m1"
      );
      assert.ok(coords);
      assert.strictEqual(coords.latitude, 13.0982);
      assert.strictEqual(coords.longitude, 80.1614);
    });
  });
});
