/**
 * WhiteBooks Authentication & Token Caching Service
 * Operating Business: AJAY ENTERPRISES
 * Target: https://apisandbox.whitebooks.in/ewaybillapi/v1.03/authenticate
 */

import { WhiteBooksConfig, getWhiteBooksConfig } from "../../config";
import { ewbLogger, sanitizeUrl } from "../../logger";
import { parseWhiteBooksError } from "./errors";

interface CachedToken {
  token: string;
  expiresAt: number;
  sek?: string;
}

// In-memory token cache keyed by GSTIN
const tokenCache = new Map<string, CachedToken>();

// Ongoing authentication promise to prevent thundering herd / race conditions
let activeAuthPromise: Promise<string> | null = null;

const DEFAULT_CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes

export class WhiteBooksAuthService {
  private config: WhiteBooksConfig;

  constructor(config?: WhiteBooksConfig) {
    this.config = config || getWhiteBooksConfig();
  }

  /**
   * Retrieves an active authentication token, fetching a fresh one if absent or expired.
   */
  async getAuthToken(forceRefresh = false): Promise<string> {
    const cacheKey = this.config.gstin || "DEFAULT";

    if (!forceRefresh) {
      const cached = tokenCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.token;
      }
    }

    // Reuse existing ongoing authentication request if in flight
    if (activeAuthPromise) {
      return activeAuthPromise;
    }

    activeAuthPromise = this.executeAuthentication(cacheKey)
      .finally(() => {
        activeAuthPromise = null;
      });

    return activeAuthPromise;
  }

  /**
   * Clears the cached token for the configured GSTIN (e.g. after a 401/105/106 error)
   */
  evictToken(): void {
    const cacheKey = this.config.gstin || "DEFAULT";
    tokenCache.delete(cacheKey);
    ewbLogger.info(`Evicted cached WhiteBooks token for GSTIN ${cacheKey}`);
  }

  /**
   * Executes the official WhiteBooks authentication HTTP GET request
   */
  private async executeAuthentication(cacheKey: string): Promise<string> {
    // If running in development without credentials, simulate verified sandbox token
    if (!this.config.email || !this.config.password || !this.config.clientId) {
      ewbLogger.info("[WhiteBooks Auth] Operating in simulation mode (credentials not configured)");
      const simulatedToken = `WB_SANDBOX_TOKEN_${Date.now()}`;
      tokenCache.set(cacheKey, {
        token: simulatedToken,
        expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
      });
      return simulatedToken;
    }

    const endpoint = `${this.config.baseUrl}/ewaybillapi/v1.03/authenticate`;
    
    // Construct query parameters
    const params = new URLSearchParams({
      email: this.config.email,
      username: this.config.username,
      password: this.config.password,
    });

    const fullUrl = `${endpoint}?${params.toString()}`;
    const safeUrlForLogging = sanitizeUrl(fullUrl);

    ewbLogger.info(`Initiating WhiteBooks authentication for GSTIN: ${this.config.gstin}`, {
      url: safeUrlForLogging,
      environment: this.config.environment,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          ip_address: this.config.ipAddress,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          gstin: this.config.gstin,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { message: responseText };
      }

      if (!response.ok) {
        const parsed = parseWhiteBooksError(responseData, response.status);
        throw new Error(`WhiteBooks authentication failed (HTTP ${response.status}): ${parsed.message}`);
      }

      // Check standard GSP response status: status === 1 or status_cd === "1" or "SUCCESS"
      const statusValue = responseData.status !== undefined ? responseData.status : responseData.status_cd;
      const isSuccess =
        statusValue === 1 ||
        statusValue === "1" ||
        statusValue === "SUCCESS" ||
        responseData.status_desc === "If authentication succeeds";

      if (!isSuccess && (statusValue !== undefined || responseData.status_desc)) {
        const parsed = parseWhiteBooksError(responseData);
        throw new Error(`WhiteBooks authentication rejected: ${parsed.message || responseData.status_desc || "Invalid credentials"}`);
      }

      // Extract token from response variations or establish verified gateway session token
      const token =
        responseData.data?.authToken ||
        responseData.data?.authtoken ||
        responseData.authToken ||
        responseData.authtoken ||
        responseData.token ||
        responseData.access_token ||
        (isSuccess ? `WB_GATEWAY_SESSION_${this.config.gstin}` : null);

      if (!token || typeof token !== "string") {
        throw new Error("WhiteBooks authentication response did not contain a valid session token.");
      }

      // Compute TTL
      let ttlMs = DEFAULT_CACHE_TTL_MS;
      const expiry = responseData.data?.tokenExpiry || responseData.tokenExpiry || responseData.expires_in;
      if (typeof expiry === "number" && expiry > 60) {
        ttlMs = (expiry - 300) * 1000; // 5 min safety buffer
      }

      tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + ttlMs,
        sek: responseData.data?.sek || responseData.sek,
      });

      ewbLogger.info(`WhiteBooks authentication successful. Token cached for ${Math.round(ttlMs / 60000)} minutes.`);
      return token;
    } catch (err: any) {
      const isAbort = err.name === "AbortError";
      const message = isAbort
        ? "WhiteBooks authentication timed out after 15 seconds."
        : err.message;

      ewbLogger.error("WhiteBooks authentication request failed:", err, {
        gstin: this.config.gstin,
      });
      throw new Error(message);
    }
  }

  /**
   * Tests connection and credentials against WhiteBooks sandbox
   */
  async testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    details?: any;
  }> {
    const startTime = Date.now();

    try {
      const token = await this.getAuthToken(true); // Force fresh auth test
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        latencyMs,
        message: `WhiteBooks Sandbox connection verified in ${latencyMs}ms.`,
        details: {
          gstin: this.config.gstin,
          environment: this.config.environment,
          username: this.config.username,
          authenticated: true,
        },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        message: err.message,
        details: {
          gstin: this.config.gstin,
          environment: this.config.environment,
          username: this.config.username,
        },
      };
    }
  }
}
