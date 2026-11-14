/**
 * INVENTRA – Google Maps URL Parsing & SSRF-Protected Coordinate Extraction
 * 
 * Extracts latitude and longitude from supported Google Maps URL formats:
 * - Direct coordinate URLs (@lat,lng, /place/lat,lng, query parameters q/ll/query/destination)
 * - Protobuf data tags (!3dlat!4dlng)
 * - Shortened share links (maps.app.goo.gl, goo.gl/maps) via SSRF-protected server-side resolution
 */

export interface ExtractedCoordinates {
  latitude: number;
  longitude: number;
  resolvedUrl?: string;
}

export interface ResolveMapsResult {
  success: boolean;
  coordinates?: ExtractedCoordinates;
  error?: string;
}

/**
 * Validates whether a URL strictly points to an allowlisted Google Maps domain.
 * Blocks any attempt to connect to arbitrary hosts, internal IP ranges, or SSRF probes.
 */
export function isAllowlistedGoogleMapsUrl(inputUrl: string): boolean {
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

/**
 * Verifies that latitude is within [-90, 90] and longitude within [-180, 180].
 */
export function isValidCoordinatePair(lat: number, lng: number): boolean {
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

/**
 * Parses DMS (Degrees Minutes Seconds) strings such as:
 * 12°58'17.8"N 77°35'40.4"E
 */
export function parseDmsString(text: string): { latitude: number; longitude: number } | null {
  try {
    const decoded = decodeURIComponent(text);
    const dmsRegex = /(\d{1,3})[°\s]+(\d{1,2})['\s]+([\d.]+)"?\s*([NSEW])/gi;
    const matches = [...decoded.matchAll(dmsRegex)];

    if (matches.length >= 2) {
      const toDecimal = (deg: string, min: string, sec: string, dir: string) => {
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

/**
 * Extracts coordinates from any text, URL, query string or HTML snippet using pattern matching.
 */
export function extractCoordinatesFromUrlString(urlString: string): { latitude: number; longitude: number } | null {
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

/**
 * Server-side resolver for Google Maps links:
 * - Checks allowlisted Google Maps domain (strictly prevents SSRF)
 * - Tries direct URL parsing first
 * - Resolves shortened URLs step-by-step (max 5 hops) with domain verification at each hop
 * - Inspects resolved HTML metadata if the final URL does not contain coordinates in path
 */
export async function resolveGoogleMapsCoordinates(rawUrl: string): Promise<ResolveMapsResult> {
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

  // 3. For shortened or indirect URLs, resolve redirects safely
  try {
    let currentUrl = trimmed;
    const maxHops = 5;

    for (let hop = 0; hop < maxHops; hop++) {
      if (!isAllowlistedGoogleMapsUrl(currentUrl)) {
        return {
          success: false,
          error: "Redirected to an unauthorized non-Google domain. Aborted for security.",
        };
      }

      // Check if currentUrl now contains coordinates
      const coords = extractCoordinatesFromUrlString(currentUrl);
      if (coords) {
        return {
          success: true,
          coordinates: {
            ...coords,
            resolvedUrl: currentUrl,
          },
        };
      }

      // Make a manual GET request with a short timeout and small body
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(6000),
      });

      // If redirect (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        const nextLocation = response.headers.get("location");
        if (!nextLocation) break;

        currentUrl = new URL(nextLocation, currentUrl).toString();
        continue;
      }

      // If successful response (200), read the initial HTML text chunk to check metadata
      if (response.ok) {
        // Read text stream or initial 64KB
        const html = await response.text();
        const snippet = html.slice(0, 65536);

        const htmlCoords = extractCoordinatesFromUrlString(snippet);
        if (htmlCoords) {
          return {
            success: true,
            coordinates: {
              ...htmlCoords,
              resolvedUrl: currentUrl,
            },
          };
        }
      }

      break;
    }

    // Check one final time on the resolved URL
    const finalCoords = extractCoordinatesFromUrlString(currentUrl);
    if (finalCoords) {
      return {
        success: true,
        coordinates: {
          ...finalCoords,
          resolvedUrl: currentUrl,
        },
      };
    }

    return {
      success: false,
      error:
        "Could not detect GPS coordinates from this Google Maps link. Please ensure the link points to a specific pinned location or place.",
    };
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      return {
        success: false,
        error: "Google Maps request timed out. Please verify your internet connection or paste the full coordinates link.",
      };
    }
    return {
      success: false,
      error: err.message || "Failed to resolve Google Maps link",
    };
  }
}
