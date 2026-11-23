import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidPinCode,
  extractPinCode,
  resolvePincode,
  findNearestPincodeFromCoords,
  calculatePincodeDistance,
  haversineDistanceKm,
} from "../src/lib/pincode-distance.ts";

describe("INVENTRA - Indian PIN Code & Distance Calculation Suite", () => {
  it("should validate Indian 6-digit PIN codes correctly", () => {
    assert.equal(isValidPinCode("600058"), true);
    assert.equal(isValidPinCode("560068"), true);
    assert.equal(isValidPinCode("110001"), true);
    assert.equal(isValidPinCode("012345"), false); // starts with 0
    assert.equal(isValidPinCode("56006"), false);  // 5 digits
    assert.equal(isValidPinCode("5600068"), false); // 7 digits
    assert.equal(isValidPinCode("5600AA"), false); // non-numeric
  });

  it("should extract PIN code from full address strings", () => {
    assert.equal(
      extractPinCode("No. 20, North Usman Road T. Nagar, Chennai 600017"),
      "600017"
    );
    assert.equal(
      extractPinCode("Industrial Suburb, Peenya 1st Stage, Bengaluru - 560058"),
      "560058"
    );
    assert.equal(
      extractPinCode("Plot 88, Electronic City Phase 1, Hosur Road, Bengaluru - 560100"),
      "560100"
    );
    assert.equal(extractPinCode("mandaveli, chennai, ra puram"), null);
    assert.equal(extractPinCode(""), null);
  });

  it("should resolve exact 6-digit and 3-digit district coordinates", () => {
    const ambattur = resolvePincode("600058");
    assert.ok(ambattur);
    assert.equal(ambattur.place, "Ambattur Industrial Estate");
    assert.equal(ambattur.state, "Tamil Nadu");

    const peenya = resolvePincode("560058");
    assert.ok(peenya);
    assert.equal(peenya.place, "Peenya Industrial Area 1st Stage");
    assert.equal(peenya.state, "Karnataka");

    // 3-digit district fallback for unmapped sub-post offices
    const trichyRural = resolvePincode("621005");
    assert.ok(trichyRural);
    assert.equal(trichyRural.place, "Trichy Rural / Ariyalur");
  });

  it("should identify nearest PIN code from attached GPS coordinates", () => {
    // Mandaveli coordinates: 13.0251, 80.2620
    const nearestPin = findNearestPincodeFromCoords(13.025102, 80.262085);
    assert.equal(nearestPin, "600028"); // Mandaveli / RA Puram

    // Electronic City coordinates: 12.8452, 77.6602
    const ecPin = findNearestPincodeFromCoords(12.8452, 77.6602);
    assert.equal(ecPin, "560100");
  });

  it("should calculate intra-city distance between Koyambedu Yard (600107) and T. Nagar (600017)", () => {
    // Delivery note AE/DN/2026-27/0015
    const res = calculatePincodeDistance({
      fromPincode: "600107",
      toPincode: "600017",
    });

    assert.ok(res.distanceKm >= 6 && res.distanceKm <= 12, `Expected distance ~7-10 KM, got ${res.distanceKm}`);
    assert.equal(res.method, "PINCODE_CENTROID");
    assert.equal(res.fromLocation, "Koyambedu / Peenya Yard");
    assert.equal(res.toLocation, "T. Nagar");
  });

  it("should calculate Bengaluru cross-city transit (Peenya 560058 to Bommanahalli 560068)", () => {
    const res = calculatePincodeDistance({
      fromPincode: "560058",
      toPincode: "560068",
    });

    // Straight line is ~18 km, with city road route tortuosity ~22 to 30 km
    assert.ok(res.distanceKm >= 20 && res.distanceKm <= 35, `Expected distance ~20-35 KM, got ${res.distanceKm}`);
    assert.equal(res.method, "PINCODE_CENTROID");
  });

  it("should return standard 5 KM baseline for identical PIN codes", () => {
    const res = calculatePincodeDistance({
      fromPincode: "600058",
      toPincode: "600058",
    });

    assert.equal(res.distanceKm, 5);
    assert.equal(res.method, "SAME_PINCODE");
  });

  it("should prioritize attached GPS coordinates when available", () => {
    const res = calculatePincodeDistance({
      fromPincode: "600058",
      toPincode: "600028",
      fromCoords: { lat: 13.0983, lng: 80.1617 },
      toCoords: { lat: 13.0244, lng: 80.2605 },
    });

    assert.equal(res.method, "GPS_COORDINATES");
    assert.ok(res.distanceKm >= 14 && res.distanceKm <= 22);
  });
});
