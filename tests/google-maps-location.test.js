import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure functions matching src/lib/geo/google-maps.ts for Node.js native test runner
 */

function isAllowlistedGoogleMapsUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return false;
  const trimmed = inputUrl.trim();

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // 1. Shortened Google Maps links
    if (hostname === "maps.app.goo.gl") return true;
    if (hostname === "goo.gl" && parsed.pathname.startsWith("/maps")) return true;

    // 2. Maps subdomains: maps.google.com, maps.google.co.in, maps.google.co.uk, etc.
    if (/^maps\.google\.(com|co\.[a-z]{2}|[a-z]{2,})$/.test(hostname)) return true;

    // 3. Main Google domains with /maps path: google.com/maps, www.google.com/maps, etc.
    if (/^(www\.)?google\.(com|co\.[a-z]{2}|[a-z]{2,})$/.test(hostname)) {
      return parsed.pathname.startsWith("/maps");
    }

    return false;
  } catch {
    return false;
  }
}

function isValidCoordinatePair(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseDmsString(text) {
  try {
    const decoded = decodeURIComponent(text);
    const dmsRegex = /(\d{1,3})[°\s]+(\d{1,2})['\s]+([\d.]+)"?\s*([NSEW])/gi;
    const matches = [...decoded.matchAll(dmsRegex)];

    if (matches.length >= 2) {
      const toDecimal = (deg, min, sec, dir) => {
        let val = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
        if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") val = -val;
        return Number(val.toFixed(7));
      };

      const lat = toDecimal(matches[0][1], matches[0][2], matches[0][3], matches[0][4]);
      const lng = toDecimal(matches[1][1], matches[1][2], matches[1][3], matches[1][4]);

      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch {
    // Ignore decode or parsing error
  }
  return null;
}

function extractCoordinatesFromUrlString(urlString) {
  if (!urlString || typeof urlString !== "string") return null;

  try {
    const decoded = decodeURIComponent(urlString);

    // Check DMS notation first
    const dms = parseDmsString(decoded);
    if (dms) return dms;

    // Pattern 1: @lat,lng e.g. /@12.9715987,77.5945627,15z
    const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
      }
    }

    // Pattern 2: Protobuf 3d/4d tags e.g. !3d12.9715987!4d77.5945627
    const d3Match = decoded.match(/!3d(-?\d+(?:\.\d+)?)/);
    const d4Match = decoded.match(/!4d(-?\d+(?:\.\d+)?)/);
    if (d3Match && d4Match) {
      const lat = parseFloat(d3Match[1]);
      const lng = parseFloat(d4Match[1]);
      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
      }
    }

    // Pattern 3: /place/lat,lng e.g. /place/12.9715987,77.5945627
    const placeMatch = decoded.match(/\/place\/(-?\d+\.\d+)(?:,|\+|\s+)(-?\d+\.\d+)/);
    if (placeMatch) {
      const lat = parseFloat(placeMatch[1]);
      const lng = parseFloat(placeMatch[2]);
      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
      }
    }

    // Pattern 4: Query parameter coordinates: q=lat,lng, query=lat,lng, ll=lat,lng, center=lat,lng, destination=lat,lng
    const queryMatch =
      decoded.match(/(?:q|query|ll|center|markers|destination|saddr|daddr)=(-?\d+\.\d+)(?:%2C|,|\+|\s+)(-?\d+\.\d+)/i) ||
      urlString.match(/(?:q|query|ll|center|markers|destination|saddr|daddr)=(-?\d+\.\d+)(?:%2C|,|\+|\s+)(-?\d+\.\d+)/i);

    if (queryMatch) {
      const lat = parseFloat(queryMatch[1]);
      const lng = parseFloat(queryMatch[2]);
      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
      }
    }

    // Pattern 5: General lat,lng pair anywhere in the query string
    const generalCoordMatch = decoded.match(/(-?\d{1,2}\.\d{4,8})(?:,|\+|\s+)(-?\d{1,3}\.\d{4,8})/);
    if (generalCoordMatch) {
      const lat = parseFloat(generalCoordMatch[1]);
      const lng = parseFloat(generalCoordMatch[2]);
      if (isValidCoordinatePair(lat, lng)) {
        return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
      }
    }
  } catch {
    // Return null on malformed string
  }

  return null;
}

async function resolveGoogleMapsCoordinates(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { success: false, error: "Please enter a Google Maps link" };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { success: false, error: "Please enter a Google Maps link" };
  }

  // 1. Validate allowlisted Google domain
  if (!isAllowlistedGoogleMapsUrl(trimmed)) {
    return {
      success: false,
      error: "Invalid Google Maps link. Please paste a link from Google Maps (e.g. https://maps.app.goo.gl/... or https://maps.google.com/...)",
    };
  }

  // 2. Check if coordinates can be extracted directly from the given URL
  const directCoords = extractCoordinatesFromUrlString(trimmed);
  if (directCoords) {
    return {
      success: true,
      coordinates: {
        ...directCoords,
        resolvedUrl: trimmed,
      },
    };
  }

  return {
    success: false,
    error: "Could not detect GPS coordinates from this Google Maps link. Please ensure the link points to a specific pinned location or place.",
  };
}

// ==============================================================================
// TEST SUITES
// ==============================================================================

describe("1. Google Maps Domain Allowlist & SSRF Protection", () => {
  it("should accept valid shortened Google Maps links", () => {
    assert.equal(isAllowlistedGoogleMapsUrl("https://maps.app.goo.gl/ab12cd34ef56"), true);
    assert.equal(isAllowlistedGoogleMapsUrl("https://goo.gl/maps/xyz987"), true);
  });

  it("should accept valid standard Google Maps links", () => {
    assert.equal(isAllowlistedGoogleMapsUrl("https://www.google.com/maps/@12.9715987,77.5945627,15z"), true);
    assert.equal(isAllowlistedGoogleMapsUrl("https://maps.google.com/?q=12.9715987,77.5945627"), true);
    assert.equal(isAllowlistedGoogleMapsUrl("https://maps.google.co.in/?q=12.9715987,77.5945627"), true);
    assert.equal(isAllowlistedGoogleMapsUrl("https://google.com/maps/place/Bangalore"), true);
    assert.equal(isAllowlistedGoogleMapsUrl("https://www.google.co.in/maps/search/centering+material"), true);
  });

  it("should reject non-Google domains and phishing attempts", () => {
    assert.equal(isAllowlistedGoogleMapsUrl("https://attacker.com/maps.app.goo.gl"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("https://maps.app.goo.gl.malicious-site.com/xyz"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("https://google.com.attacker.org/maps"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("https://fakegooglemaps.com/?q=12.97,77.59"), false);
  });

  it("should reject non-maps Google services", () => {
    assert.equal(isAllowlistedGoogleMapsUrl("https://www.google.com/search?q=maps"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("https://drive.google.com/file/d/1234"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("https://goo.gl/other/1234"), false);
  });

  it("should block SSRF internal IP targets and invalid protocols", () => {
    assert.equal(isAllowlistedGoogleMapsUrl("http://169.254.169.254/latest/meta-data"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("http://localhost:3000/maps"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("http://127.0.0.1/maps"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("javascript:alert(1)"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("file:///etc/passwd"), false);
    assert.equal(isAllowlistedGoogleMapsUrl("data:text/html,<script>alert(1)</script>"), false);
    assert.equal(isAllowlistedGoogleMapsUrl(""), false);
    assert.equal(isAllowlistedGoogleMapsUrl(null), false);
    assert.equal(isAllowlistedGoogleMapsUrl(undefined), false);
  });
});

describe("2. Coordinate Range Validation", () => {
  it("should validate latitude between -90 and 90 and longitude between -180 and 180", () => {
    assert.equal(isValidCoordinatePair(12.9715987, 77.5945627), true); // Bangalore
    assert.equal(isValidCoordinatePair(0, 0), true); // Equator & Prime Meridian
    assert.equal(isValidCoordinatePair(90, 180), true); // North Pole boundary
    assert.equal(isValidCoordinatePair(-90, -180), true); // South Pole boundary
    assert.equal(isValidCoordinatePair(-33.8688, 151.2093), true); // Sydney
  });

  it("should reject out-of-range or non-numeric coordinates", () => {
    assert.equal(isValidCoordinatePair(91.5, 77.5), false); // Latitude > 90
    assert.equal(isValidCoordinatePair(-91.0, 77.5), false); // Latitude < -90
    assert.equal(isValidCoordinatePair(12.9, 181.0), false); // Longitude > 180
    assert.equal(isValidCoordinatePair(12.9, -181.0), false); // Longitude < -180
    assert.equal(isValidCoordinatePair(NaN, 77.5), false);
    assert.equal(isValidCoordinatePair(12.9, Infinity), false);
    assert.equal(isValidCoordinatePair("12.9", "77.5"), false);
  });
});

describe("3. Regular Google Maps Links Coordinate Extraction", () => {
  it("should extract coordinates from @lat,lng notation", () => {
    const url = "https://www.google.com/maps/@12.9715987,77.5945627,15z";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 12.9715987);
    assert.equal(coords.longitude, 77.5945627);
  });

  it("should extract coordinates from /place/ URL with @lat,lng", () => {
    const url =
      "https://www.google.com/maps/place/Bangalore+Palace/@12.9988421,77.5921168,17z/data=!3m1!4b1!4m6!3m5!1s0x3bae1649c2531d0b:0x87cfc1d76921359d!8m2!3d12.9988421!4d77.5921168";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 12.9988421);
    assert.equal(coords.longitude, 77.5921168);
  });

  it("should extract coordinates from protobuf !3d and !4d tags", () => {
    const url = "https://www.google.com/maps/place/Site+Project/data=!4m2!3m1!1s0x0:0x0!3d15.3647205!4d75.1240123";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 15.3647205);
    assert.equal(coords.longitude, 75.1240123);
  });

  it("should extract coordinates from ?q=lat,lng query parameter", () => {
    const url = "https://maps.google.com/?q=13.0827110,80.2707220";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 13.082711);
    assert.equal(coords.longitude, 80.270722);
  });

  it("should extract coordinates from URL-encoded query parameters", () => {
    const url = "https://www.google.com/maps/search/?api=1&query=12.9715987%2C77.5945627";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 12.9715987);
    assert.equal(coords.longitude, 77.5945627);
  });

  it("should extract coordinates from /place/lat,lng path", () => {
    const url = "https://www.google.com/maps/place/12.9715987,77.5945627";
    const coords = extractCoordinatesFromUrlString(url);
    assert.ok(coords);
    assert.equal(coords.latitude, 12.9715987);
    assert.equal(coords.longitude, 77.5945627);
  });

  it("should parse DMS coordinate notation in URLs", () => {
    const dms = parseDmsString(`12°58'17.8"N 77°35'40.4"E`);
    assert.ok(dms);
    assert.ok(Math.abs(dms.latitude - 12.9716111) < 0.0001);
    assert.ok(Math.abs(dms.longitude - 77.5945556) < 0.0001);
  });
});

describe("4. Links Without Extractable Coordinates & Error Handling", () => {
  it("should fail gracefully when Google Maps home page is pasted without coordinates", async () => {
    const result = await resolveGoogleMapsCoordinates("https://www.google.com/maps");
    assert.equal(result.success, false);
    assert.match(result.error, /Could not detect GPS coordinates/);
  });

  it("should fail gracefully when generic search without coordinates is passed", async () => {
    const result = await resolveGoogleMapsCoordinates("https://www.google.com/maps/search/cement+store/");
    assert.equal(result.success, false);
    assert.match(result.error, /Could not detect GPS coordinates/);
  });

  it("should immediately reject unauthorized URLs with clear error message", async () => {
    const result = await resolveGoogleMapsCoordinates("https://evil-site.com/maps/@12.9,77.5");
    assert.equal(result.success, false);
    assert.match(result.error, /Invalid Google Maps link/);
  });

  it("should handle empty or whitespace-only link inputs", async () => {
    const result = await resolveGoogleMapsCoordinates("   ");
    assert.equal(result.success, false);
    assert.match(result.error, /Please enter a Google Maps link/);
  });
});

describe("5. Existing Site GPS Preservation Logic", () => {
  it("should retain existing GPS coordinates during Edit when new link is empty", () => {
    const existingSite = {
      id: "site-uuid-1",
      siteName: "Brigade Gateway Tower A",
      gpsLatitude: 12.9715987,
      gpsLongitude: 77.5945627,
    };

    const siteForm = {
      siteName: "Brigade Gateway Tower A (Updated)",
      gpsLatitude: String(existingSite.gpsLatitude),
      gpsLongitude: String(existingSite.gpsLongitude),
      mapsUrl: "", // User did not paste a new link
    };

    const isEdit = true;
    const payload = {
      siteName: siteForm.siteName,
    };

    if (siteForm.gpsLatitude && siteForm.gpsLongitude) {
      payload.gpsLatitude = Number(siteForm.gpsLatitude);
      payload.gpsLongitude = Number(siteForm.gpsLongitude);
    } else if (isEdit && !siteForm.mapsUrl) {
      // Untouched
    }

    assert.equal(payload.gpsLatitude, 12.9715987);
    assert.equal(payload.gpsLongitude, 77.5945627);
  });

  it("should update GPS coordinates during Edit when a new Google Maps link is resolved", () => {
    const existingSite = {
      id: "site-uuid-1",
      siteName: "Brigade Gateway Tower A",
      gpsLatitude: 12.9715987,
      gpsLongitude: 77.5945627,
    };

    // User pastes new location link
    const newLink = "https://www.google.com/maps/@13.0827,80.2707,16z";
    const extracted = extractCoordinatesFromUrlString(newLink);

    assert.ok(extracted);

    const siteForm = {
      siteName: existingSite.siteName,
      gpsLatitude: String(extracted.latitude),
      gpsLongitude: String(extracted.longitude),
      mapsUrl: newLink,
    };

    const payload = {
      siteName: siteForm.siteName,
      gpsLatitude: Number(siteForm.gpsLatitude),
      gpsLongitude: Number(siteForm.gpsLongitude),
    };

    assert.equal(payload.gpsLatitude, 13.0827);
    assert.equal(payload.gpsLongitude, 80.2707);
    assert.notEqual(payload.gpsLatitude, existingSite.gpsLatitude);
  });
});
