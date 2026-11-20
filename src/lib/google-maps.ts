/**
 * INVENTRA ERP - Google Maps Server-side Integration Service
 * Operating Business: AJAY ENTERPRISES
 * 
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. Uses ONLY two Google Maps services:
 *    - Geocoding API: https://maps.googleapis.com/maps/api/geocode/json
 *    - Maps Static API: https://maps.googleapis.com/maps/api/staticmap
 * 2. Strictly PROHIBITED: Places API, Maps JS API, Embed API, Routes, Roads, etc.
 * 3. Never hardcode API keys. Reads GOOGLE_MAPS_API_KEY from environment variables.
 * 4. Gracefully handles pending API key configuration: returns "Google Maps configuration pending"
 *    without throwing errors or generating fake addresses/coordinates.
 */

export interface GeocodedAddressComponents {
  street?: string;
  sublocality?: string;
  locality?: string; // City
  district?: string;
  state?: string;
  pinCode?: string;
}

export interface ReverseGeocodeResult {
  isConfigured: boolean;
  status: "SUCCESS" | "PENDING_KEY" | "FAILED" | "ZERO_RESULTS";
  message?: string;
  line1: string; // Street and locality name
  line2: string; // City, State and PIN code
  formattedAddress: string;
  components: GeocodedAddressComponents;
  latitude: number;
  longitude: number;
}

export interface StaticMapOptions {
  latitude: number;
  longitude: number;
  zoom?: number; // default 17
  width?: number; // default 300
  height?: number; // default 240
  scale?: number; // default 2
}

/**
 * Checks whether a valid Google Maps API key is configured.
 */
export function isGoogleMapsConfigured(): boolean {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return trimmed.length > 0 && !trimmed.toLowerCase().includes("placeholder") && !trimmed.toLowerCase().includes("your_api_key");
}

/**
 * Safely extracts address components from Google Geocoding API response.
 */
export function extractAddressComponents(
  addressComponents: Array<{ long_name: string; short_name: string; types: string[] }>
): GeocodedAddressComponents {
  const components: GeocodedAddressComponents = {};

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
    } else if (types.includes("administrative_area_level_2") || types.includes("administrative_area_level_3")) {
      if (!components.district) components.district = comp.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      components.state = comp.long_name;
    } else if (types.includes("postal_code")) {
      components.pinCode = comp.long_name;
    }
  }

  return components;
}

/**
 * Builds the compact 2-line location heading per INVENTRA standards:
 * Line 1: Street and locality name (e.g. "Vanniyampathy Street, Mandaveli")
 * Line 2: City, State and PIN code (e.g. "Chennai, Tamil Nadu – 600028")
 */
export function formatLocationLines(
  components: GeocodedAddressComponents,
  fallbackFormatted?: string
): { line1: string; line2: string } {
  const { street, sublocality, locality, district, state, pinCode } = components;

  // Line 1: Street and locality
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
    // Take the first segment before comma
    line1 = fallbackFormatted.split(",")[0].trim();
  } else {
    line1 = "Site Location";
  }

  // Line 2: City, State and PIN code
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

/**
 * Reverse geocodes GPS coordinates using ONLY the Google Geocoding API.
 */
export async function reverseGeocodeGps(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  // Validate coordinates
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      isConfigured: isGoogleMapsConfigured(),
      status: "FAILED",
      message: "Invalid GPS coordinates",
      line1: "Invalid GPS Coordinates",
      line2: `${latitude}, ${longitude}`,
      formattedAddress: "",
      components: {},
      latitude,
      longitude,
    };
  }

  // Check API key configuration
  if (!isGoogleMapsConfigured()) {
    return {
      isConfigured: false,
      status: "PENDING_KEY",
      message: "Google Maps configuration pending",
      line1: "Google Maps configuration pending",
      line2: "Location geocoding pending",
      formattedAddress: "Google Maps configuration pending",
      components: {},
      latitude,
      longitude,
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY!.trim();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        isConfigured: true,
        status: "FAILED",
        message: `Google Geocoding API HTTP ${res.status}`,
        line1: "Location geocoding unavailable",
        line2: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        formattedAddress: "",
        components: {},
        latitude,
        longitude,
      };
    }

    const data = await res.json();

    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      return {
        isConfigured: true,
        status: "ZERO_RESULTS",
        message: "No address found for coordinates",
        line1: "Unmapped Location",
        line2: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        formattedAddress: "",
        components: {},
        latitude,
        longitude,
      };
    }

    if (data.status !== "OK") {
      return {
        isConfigured: true,
        status: "FAILED",
        message: data.error_message || `Geocoding status: ${data.status}`,
        line1: "Location geocoding unavailable",
        line2: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        formattedAddress: "",
        components: {},
        latitude,
        longitude,
      };
    }

    // Prefer result with street_address, premise, or sublocality if available
    const bestResult =
      data.results.find((r: any) =>
        r.types?.some((t: string) => ["street_address", "premise", "sublocality", "route"].includes(t))
      ) || data.results[0];

    const components = extractAddressComponents(bestResult.address_components || []);
    const { line1, line2 } = formatLocationLines(components, bestResult.formatted_address);

    return {
      isConfigured: true,
      status: "SUCCESS",
      line1,
      line2,
      formattedAddress: bestResult.formatted_address || `${line1}, ${line2}`,
      components,
      latitude,
      longitude,
    };
  } catch (error: any) {
    const isTimeout = error.name === "AbortError";
    return {
      isConfigured: true,
      status: "FAILED",
      message: isTimeout ? "Geocoding request timed out" : error.message,
      line1: "Location geocoding unavailable",
      line2: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      formattedAddress: "",
      components: {},
      latitude,
      longitude,
    };
  }
}

/**
 * Generates an SVG fallback map thumbnail matching INVENTRA Navy/Orange visual styling.
 */
export function generateFallbackMapSvg(
  latitude: number,
  longitude: number,
  width: number = 300,
  height: number = 240,
  title: string = "Google Maps Pending"
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1E36" />
      <stop offset="100%" stop-color="#071322" />
    </linearGradient>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1E293B" stroke-width="1" stroke-opacity="0.6"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="url(#grid)" />
  <!-- Road simulation lines -->
  <path d="M 0 ${height * 0.4} Q ${width * 0.5} ${height * 0.3} ${width} ${height * 0.55}" fill="none" stroke="#334155" stroke-width="4" stroke-opacity="0.5" />
  <path d="M ${width * 0.3} 0 L ${width * 0.7} ${height}" fill="none" stroke="#334155" stroke-width="3" stroke-opacity="0.5" />
  
  <!-- Location Pin (Orange #F26522) -->
  <g transform="translate(${width / 2}, ${height / 2 - 12})">
    <!-- Pin shadow -->
    <ellipse cx="0" cy="18" rx="8" ry="3.5" fill="#000000" opacity="0.4"/>
    <!-- Pin body -->
    <path d="M 0 16 C -1 -1, -12 -3, -12 -12 C -12 -19, -6 -24, 0 -24 C 6 -24, 12 -19, 12 -12 C 12 -3, 1 -1, 0 16 Z" fill="#F26522" stroke="#FFFFFF" stroke-width="1.5" />
    <!-- Inner circle -->
    <circle cx="0" cy="-12" r="4.5" fill="#FFFFFF" />
    <circle cx="0" cy="-12" r="2.2" fill="#0B1E36" />
  </g>

  <!-- Title / Status -->
  <rect x="8" y="${height - 42}" width="${width - 16}" height="34" rx="6" fill="#0F172A" fill-opacity="0.88" stroke="#334155" stroke-width="1"/>
  <text x="${width / 2}" y="${height - 28}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="10" font-weight="700" fill="#F8FAFC">${title}</text>
  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" font-family="monospace, sans-serif" font-size="8.5" fill="#94A3B8">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</text>
</svg>`;
}

/**
 * Fetches the mini map thumbnail using ONLY the Google Maps Static API.
 * Center & Marker: exact captured latitude and longitude.
 * Marker color: orange (#F26522).
 */
export async function fetchStaticMapThumbnail(
  options: StaticMapOptions
): Promise<{ buffer: Buffer; contentType: string; isConfigured: boolean; isFallback: boolean }> {
  const { latitude, longitude, zoom = 17, width = 300, height = 240, scale = 2 } = options;

  // If Google Maps API key is not configured, generate fallback SVG
  if (!isGoogleMapsConfigured()) {
    const svg = generateFallbackMapSvg(latitude, longitude, width, height, "Google Maps Pending");
    return {
      buffer: Buffer.from(svg, "utf-8"),
      contentType: "image/svg+xml",
      isConfigured: false,
      isFallback: true,
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY!.trim();
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&scale=${scale}&maptype=roadmap&markers=color:0xF26522%7C${latitude},${longitude}&key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(staticMapUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const svg = generateFallbackMapSvg(latitude, longitude, width, height, "Map Preview Unavailable");
      return {
        buffer: Buffer.from(svg, "utf-8"),
        contentType: "image/svg+xml",
        isConfigured: true,
        isFallback: true,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/png";

    return {
      buffer,
      contentType,
      isConfigured: true,
      isFallback: false,
    };
  } catch {
    const svg = generateFallbackMapSvg(latitude, longitude, width, height, "Map Request Timeout");
    return {
      buffer: Buffer.from(svg, "utf-8"),
      contentType: "image/svg+xml",
      isConfigured: true,
      isFallback: true,
    };
  }
}
