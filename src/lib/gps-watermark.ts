/**
 * INVENTRA ERP - Professional GPS Camera Watermark Engine
 * Operating Business: AJAY ENTERPRISES
 * Adheres strictly to AGENTS.md Rule 8: GPS Camera Proof & Acknowledgement
 *
 * Burns a professional GPS Camera watermark directly onto site delivery,
 * return, and transfer photographs while preserving the untouched original.
 * 
 * DESIGN INSPIRATION: UnblockNow GPS Camera Watermark
 * - Horizontal dark navy rounded rectangular panel (#0B1E36)
 * - Mini Google Map on the left with orange location marker (#F26522)
 * - 5-line information hierarchy on the right:
 *   Line 1: Street and locality name
 *   Line 2: City, State and PIN code
 *   Line 3: Latitude and Longitude
 *   Line 4: Actual photograph capture date and time
 *   Line 5: INVENTRA · GPS Location branding
 */

export interface GpsWatermarkOptions {
  file: File;
  latitude: number;
  longitude: number;
  accuracy?: number;
  siteName?: string;
  customerName?: string;
  documentNumber?: string;
  timestamp?: Date;
  addressLine1?: string;
  addressLine2?: string;
  staticMapUrl?: string;
}

export interface WatermarkResult {
  originalFile: File;
  watermarkedFile: File;
  dataUrl: string;
  addressLine1: string;
  addressLine2: string;
  geocodingStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
  miniMapStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
}

/**
 * Truncates text with ellipsis if it exceeds the maxWidth.
 */
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + "…" : "";
}

/**
 * Helper to draw a rounded rectangle path.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws a clean fallback map thumbnail when Google Maps Static API is pending configuration or offline.
 */
function drawFallbackMapThumbnail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  latitude: number,
  longitude: number,
  statusText: string = "Map Pending"
) {
  ctx.save();
  // Clip to rounded rectangle
  drawRoundedRect(ctx, x, y, w, h, Math.round(10 * scale));
  ctx.clip();

  // Background
  ctx.fillStyle = "#071322";
  ctx.fillRect(x, y, w, h);

  // Simulated road grid
  ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  const step = Math.max(16, Math.round(22 * scale));
  for (let gx = x; gx < x + w; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += step) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Major road
  ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
  ctx.lineWidth = Math.max(2, Math.round(3.5 * scale));
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.45);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.35, x + w, y + h * 0.6);
  ctx.stroke();

  // Orange Location Marker in center
  const pinX = x + w / 2;
  const pinY = y + h / 2 - Math.round(6 * scale);
  const pinRadius = Math.max(5, Math.round(7 * scale));

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(pinX, pinY + Math.round(12 * scale), Math.round(6 * scale), Math.round(2.5 * scale), 0, 0, Math.PI * 2);
  ctx.fill();

  // Pin marker body
  ctx.fillStyle = "#F26522";
  ctx.beginPath();
  ctx.arc(pinX, pinY, pinRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
  ctx.stroke();

  // Center white dot
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(pinX, pinY, Math.max(2, Math.round(2.5 * scale)), 0, Math.PI * 2);
  ctx.fill();

  // Status pill at bottom
  const pillH = Math.max(16, Math.round(20 * scale));
  const pillY = y + h - pillH - Math.round(4 * scale);
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  drawRoundedRect(ctx, x + Math.round(6 * scale), pillY, w - Math.round(12 * scale), pillH, Math.round(4 * scale));
  ctx.fill();

  ctx.fillStyle = "#CBD5E1";
  ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(statusText, pinX, pillY + pillH * 0.68);

  ctx.restore();
}

/**
 * Loads an image from a URL with a timeout.
 */
function loadImageWithTimeout(url: string, timeoutMs: number = 3500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = url;
  });
}

/**
 * Resolves address and map thumbnail data from the server-side Google Maps endpoints.
 */
async function resolveLocationData(
  latitude: number,
  longitude: number,
  options: GpsWatermarkOptions
): Promise<{
  line1: string;
  line2: string;
  geocodingStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
  miniMapStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
  mapImage: HTMLImageElement | null;
}> {
  let line1 = options.addressLine1 || "";
  let line2 = options.addressLine2 || "";
  let geocodingStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE" = "OFFLINE";
  let miniMapStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE" = "OFFLINE";
  let mapImage: HTMLImageElement | null = null;

  // 1. Resolve Reverse Geocoding if not pre-provided
  if (!line1 || !line2) {
    try {
      const geoRes = await fetch(
        `/api/v1/maps/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
        { headers: { Accept: "application/json" } }
      );

      if (geoRes.ok) {
        const geoJson = await geoRes.json();
        if (geoJson.success && geoJson.data) {
          const data = geoJson.data;
          geocodingStatus = data.status || (data.isConfigured ? "SUCCESS" : "PENDING_KEY");
          line1 = data.line1 || (data.isConfigured ? "Site Location" : "Google Maps configuration pending");
          line2 = data.line2 || (data.isConfigured ? "" : "Location geocoding pending");
        }
      } else {
        geocodingStatus = "FAILED";
      }
    } catch {
      geocodingStatus = "OFFLINE";
    }
  } else {
    geocodingStatus = "SUCCESS";
  }

  // Intelligent fallback: if geocoding returns "Unmapped Location", "Location geocoding unavailable",
  // "Google Maps configuration pending", or is empty, use the actual site & customer metadata!
  const isGenericOrUnmapped =
    !line1 ||
    line1 === "Unmapped Location" ||
    line1 === "Location geocoding unavailable" ||
    line1 === "Google Maps configuration pending" ||
    line1 === "Site Location";

  if (isGenericOrUnmapped) {
    if (options.siteName) {
      line1 = options.customerName ? `${options.siteName} (${options.customerName})` : options.siteName;
      line2 = `${Math.abs(latitude).toFixed(6)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(6)}° ${longitude >= 0 ? "E" : "W"}`;
    } else if (geocodingStatus === "PENDING_KEY") {
      line1 = "Google Maps configuration pending";
      line2 = "Location geocoding pending";
    } else {
      line1 = `${Math.abs(latitude).toFixed(6)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(6)}° ${longitude >= 0 ? "E" : "W"}`;
      line2 = "Site Coordinates Recorded";
    }
  }

  // 2. Resolve Static Map Thumbnail
  try {
    const mapUrl =
      options.staticMapUrl ||
      `/api/v1/maps/static-map?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&zoom=17&width=320&height=240`;

    mapImage = await loadImageWithTimeout(mapUrl, 4000);
    if (mapImage) {
      miniMapStatus = geocodingStatus === "PENDING_KEY" ? "PENDING_KEY" : "SUCCESS";
    } else {
      miniMapStatus = geocodingStatus === "PENDING_KEY" ? "PENDING_KEY" : "FAILED";
    }
  } catch {
    miniMapStatus = "OFFLINE";
  }

  return { line1, line2, geocodingStatus, miniMapStatus, mapImage };
}

/**
 * Stamps a professional GPS Camera watermark banner onto a copy of the photo,
 * strictly preserving the original file.
 */
export async function stampGpsWatermarkOnPhoto(
  options: GpsWatermarkOptions
): Promise<WatermarkResult> {
  const {
    file,
    latitude,
    longitude,
    accuracy = 5.0,
    documentNumber = "DELIVERY-NOTE",
    timestamp = new Date(),
  } = options;

  // Resolve geocoded address and static map thumbnail server-side
  const { line1, line2, geocodingStatus, miniMapStatus, mapImage } = await resolveLocationData(
    latitude,
    longitude,
    options
  );

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      // Graceful fallback: return original file
      resolve({
        originalFile: file,
        watermarkedFile: file,
        dataUrl: "",
        addressLine1: line1,
        addressLine2: line2,
        geocodingStatus,
        miniMapStatus,
      });
    };

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();

      img.onerror = () => {
        resolve({
          originalFile: file,
          watermarkedFile: file,
          dataUrl,
          addressLine1: line1,
          addressLine2: line2,
          geocodingStatus,
          miniMapStatus,
        });
      };

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({
              originalFile: file,
              watermarkedFile: file,
              dataUrl,
              addressLine1: line1,
              addressLine2: line2,
              geocodingStatus,
              miniMapStatus,
            });
            return;
          }

          // 1. Draw original base photo
          ctx.drawImage(img, 0, 0, img.width, img.height);

          // 2. Responsive scaling factor (reference width: 1000px, clamped 0.65 to 2.5)
          const scale = Math.max(0.65, Math.min(2.5, canvas.width / 1000));

          // Dimensions & Spacing
          const panelMarginX = Math.max(12, Math.round(20 * scale));
          const panelMarginBottom = Math.max(12, Math.round(20 * scale));
          const panelPadding = Math.max(10, Math.round(14 * scale));
          const panelRadius = Math.max(8, Math.round(14 * scale));

          // Mini Map Dimensions on the left
          const mapWidth = Math.max(120, Math.round(180 * scale));
          const mapHeight = Math.max(100, Math.round(145 * scale));
          const gapBetweenMapAndText = Math.max(10, Math.round(16 * scale));

          // Typography font sizes
          const line1FontSize = Math.max(12, Math.round(15 * scale));
          const line2FontSize = Math.max(10, Math.round(12 * scale));
          const line3FontSize = Math.max(9, Math.round(11 * scale));
          const line4FontSize = Math.max(9, Math.round(10.5 * scale));
          const line5FontSize = Math.max(9, Math.round(10.5 * scale));

          const textLineGap = Math.max(3, Math.round(5 * scale));
          const totalTextHeight =
            line1FontSize +
            line2FontSize +
            line3FontSize +
            line4FontSize +
            line5FontSize +
            textLineGap * 4;

          const panelContentHeight = Math.max(mapHeight, totalTextHeight);
          const panelHeight = panelContentHeight + panelPadding * 2;
          const panelWidth = canvas.width - panelMarginX * 2;
          const panelX = panelMarginX;
          const panelY = canvas.height - panelHeight - panelMarginBottom;

          ctx.save();

          // 3. Draw Watermark Container Panel (#0B1E36 Dark Navy)
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = Math.round(16 * scale);
          ctx.shadowOffsetY = Math.round(4 * scale);

          drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, panelRadius);
          ctx.fillStyle = "rgba(11, 30, 54, 0.94)";
          ctx.fill();

          // Subtle border
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
          ctx.lineWidth = Math.max(1, Math.round(1.2 * scale));
          ctx.stroke();

          // Top accent line in Industrial Safety Orange (#F26522)
          ctx.fillStyle = "#F26522";
          const accentH = Math.max(3, Math.round(3.5 * scale));
          drawRoundedRect(ctx, panelX, panelY, panelWidth, accentH, Math.max(2, Math.round(3 * scale)));
          ctx.fill();

          // 4. Draw Mini Google Map on the left
          const mapX = panelX + panelPadding;
          const mapY = panelY + panelPadding + Math.round((panelContentHeight - mapHeight) / 2);

          if (mapImage && miniMapStatus === "SUCCESS") {
            ctx.save();
            drawRoundedRect(ctx, mapX, mapY, mapWidth, mapHeight, Math.round(8 * scale));
            ctx.clip();
            ctx.drawImage(mapImage, mapX, mapY, mapWidth, mapHeight);

            // Subtle border around map
            ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
            ctx.lineWidth = Math.max(1, Math.round(1 * scale));
            ctx.stroke();
            ctx.restore();
          } else {
            // Draw clean fallback map thumbnail
            const fallbackStatus =
              miniMapStatus === "PENDING_KEY"
                ? "Google Maps Pending"
                : miniMapStatus === "OFFLINE"
                ? "Offline Mode"
                : "Map Unavailable";
            drawFallbackMapThumbnail(ctx, mapX, mapY, mapWidth, mapHeight, scale, latitude, longitude, fallbackStatus);
          }

          // 5. Draw 5-Line Information Hierarchy on the right
          const textStartX = mapX + mapWidth + gapBetweenMapAndText;
          const availableTextWidth = panelX + panelWidth - panelPadding - textStartX;

          let currentY = panelY + panelPadding + Math.round((panelContentHeight - totalTextHeight) / 2);

          // LINE 1: Street and locality name (Bold White)
          currentY += line1FontSize;
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `bold ${line1FontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(truncateText(ctx, line1, availableTextWidth), textStartX, currentY);

          // LINE 2: City, State and PIN code (Soft Slate)
          currentY += line2FontSize + textLineGap;
          ctx.fillStyle = "#CBD5E1";
          ctx.font = `500 ${line2FontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText(truncateText(ctx, line2, availableTextWidth), textStartX, currentY);

          // LINE 3: Latitude and Longitude + Accuracy
          currentY += line3FontSize + textLineGap;
          ctx.fillStyle = "#E2E8F0";
          ctx.font = `600 ${line3FontSize}px "SF Mono", Menlo, Consolas, monospace`;
          const latDir = latitude >= 0 ? "N" : "S";
          const lngDir = longitude >= 0 ? "E" : "W";
          const gpsString = `${Math.abs(latitude).toFixed(6)}° ${latDir}, ${Math.abs(longitude).toFixed(6)}° ${lngDir}  •  ±${Math.round(accuracy)}m`;
          ctx.fillText(truncateText(ctx, gpsString, availableTextWidth), textStartX, currentY);

          // LINE 4: Actual photograph capture date and time
          currentY += line4FontSize + textLineGap;
          ctx.fillStyle = "#94A3B8";
          ctx.font = `400 ${line4FontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const dateStr = timestamp.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const timeStr = timestamp.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          });
          const timeString = `${dateStr} · ${timeStr} IST`;
          ctx.fillText(truncateText(ctx, timeString, availableTextWidth), textStartX, currentY);

          // LINE 5: INVENTRA · GPS Location branding + Document pill
          currentY += line5FontSize + textLineGap;

          // Orange marker bullet
          const bulletRadius = Math.max(2.5, Math.round(3.5 * scale));
          ctx.fillStyle = "#F26522";
          ctx.beginPath();
          ctx.arc(textStartX + bulletRadius, currentY - line5FontSize * 0.35, bulletRadius, 0, Math.PI * 2);
          ctx.fill();

          // Brand text
          const brandStartX = textStartX + bulletRadius * 2 + Math.max(4, Math.round(6 * scale));
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `bold ${line5FontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const brandText = "INVENTRA · GPS Location";
          ctx.fillText(brandText, brandStartX, currentY);

          // Document Tag Badge on the right if space allows
          const brandTextWidth = ctx.measureText(brandText).width;
          const badgeText = documentNumber ? `DOC: ${documentNumber}` : "✓ GEO-VERIFIED";
          ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const badgeWidth = ctx.measureText(badgeText).width + Math.round(12 * scale);
          const badgeX = textStartX + availableTextWidth - badgeWidth;

          if (badgeX > brandStartX + brandTextWidth + Math.round(12 * scale)) {
            const badgeH = Math.max(14, Math.round(16 * scale));
            const badgeY = currentY - line5FontSize + Math.round(2 * scale);
            ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
            drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeH, Math.round(3 * scale));
            ctx.fill();
            ctx.strokeStyle = "#10B981";
            ctx.lineWidth = Math.max(0.8, Math.round(1 * scale));
            ctx.stroke();

            ctx.fillStyle = "#10B981";
            ctx.textAlign = "center";
            ctx.fillText(badgeText, badgeX + badgeWidth / 2, currentY - Math.round(1 * scale));
          }

          ctx.restore();

          // 6. Convert canvas back to separate watermarked JPEG File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve({
                  originalFile: file,
                  watermarkedFile: file,
                  dataUrl,
                  addressLine1: line1,
                  addressLine2: line2,
                  geocodingStatus,
                  miniMapStatus,
                });
                return;
              }

              const stampedFileName = file.name.replace(/\.[^/.]+$/, "") + "-watermarked.jpg";
              const stampedFile = new File([blob], stampedFileName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              const stampedDataUrl = canvas.toDataURL("image/jpeg", 0.92);

              resolve({
                originalFile: file,
                watermarkedFile: stampedFile,
                dataUrl: stampedDataUrl,
                addressLine1: line1,
                addressLine2: line2,
                geocodingStatus,
                miniMapStatus,
              });
            },
            "image/jpeg",
            0.92
          );
        } catch {
          // Graceful fallback on canvas error
          resolve({
            originalFile: file,
            watermarkedFile: file,
            dataUrl,
            addressLine1: line1,
            addressLine2: line2,
            geocodingStatus,
            miniMapStatus,
          });
        }
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}
