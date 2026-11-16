/**
 * WhiteBooks Secure HTTP API Client
 * Operating Business: AJAY ENTERPRISES
 */

import { WhiteBooksConfig, getWhiteBooksConfig } from "../../config";
import { WhiteBooksAuthService } from "./auth";
import { ewbLogger, sanitizeUrl, sanitizePayload } from "../../logger";
import { parseWhiteBooksError, ParsedEwbError } from "./errors";

export interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  queryParams?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  skipAuthToken?: boolean;
}

export class WhiteBooksClient {
  public config: WhiteBooksConfig;
  public authService: WhiteBooksAuthService;

  constructor(config?: WhiteBooksConfig, authService?: WhiteBooksAuthService) {
    this.config = config || getWhiteBooksConfig();
    this.authService = authService || new WhiteBooksAuthService(this.config);
  }

  /**
   * Executes an authenticated HTTP request to WhiteBooks GSP sandbox
   */
  async request<T = any>(opts: RequestOptions, isRetry = false): Promise<T> {
    const timeoutMs = opts.timeoutMs || 30000;
    const isPost = opts.method === "POST";

    // 1. Get Auth Token unless explicitly skipped
    let authToken = "";
    if (!opts.skipAuthToken) {
      authToken = await this.authService.getAuthToken();
    }

    // 2. Build URL & Query Parameters
    const url = new URL(`${this.config.baseUrl}${opts.path}`);
    if (this.config.email) {
      url.searchParams.set("email", this.config.email);
    }
    if (opts.queryParams) {
      for (const [k, v] of Object.entries(opts.queryParams)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, v);
        }
      }
    }

    const fullUrl = url.toString();
    const safeUrl = sanitizeUrl(fullUrl);

    // 3. Prepare Headers
    const headers: Record<string, string> = {
      ip_address: this.config.ipAddress,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      gstin: this.config.gstin,
    };

    if (authToken) {
      headers["authtoken"] = authToken;
    }

    if (isPost) {
      headers["Content-Type"] = "application/json";
    }

    ewbLogger.info(`[WhiteBooks] ${opts.method} ${safeUrl}`, {
      method: opts.method,
      path: opts.path,
      hasBody: !!opts.body,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        method: opts.method,
        headers,
        body: isPost && opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseJson: any = {};
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { message: responseText };
      }

      // Check HTTP level failures
      if (!response.ok) {
        const parsed = parseWhiteBooksError(responseJson, response.status);

        // If token expired and this is not already a retry, refresh and retry once
        if (parsed.category === "TOKEN_EXPIRED" && !isRetry) {
          ewbLogger.warn("[WhiteBooks] Token expired. Evicting and retrying request once...");
          this.authService.evictToken();
          return this.request<T>(opts, true);
        }

        throw new WhiteBooksApiError(parsed, responseJson, response.status);
      }

      // Check payload-level failures (status: 0 or "ERROR" or errorCodes present)
      const statusVal = responseJson.status;
      const isFailedStatus = statusVal === 0 || statusVal === "0" || statusVal === "ERROR" || statusVal === "FAIL";
      const hasErrorCodes = !!(responseJson.errorCodes || responseJson.errorCode || responseJson.error_code);

      if (isFailedStatus || hasErrorCodes) {
        const parsed = parseWhiteBooksError(responseJson);

        if (parsed.category === "TOKEN_EXPIRED" && !isRetry) {
          ewbLogger.warn("[WhiteBooks] Payload indicated token expired. Evicting and retrying once...");
          this.authService.evictToken();
          return this.request<T>(opts, true);
        }

        throw new WhiteBooksApiError(parsed, responseJson, response.status);
      }

      return responseJson as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof WhiteBooksApiError) {
        throw err;
      }

      const isTimeout = err.name === "AbortError";
      const parsedError: ParsedEwbError = {
        category: isTimeout ? "NETWORK_TIMEOUT" : "PROVIDER_ERROR",
        message: isTimeout
          ? `WhiteBooks API call timed out after ${timeoutMs / 1000} seconds.`
          : (err.message || "Unknown error calling WhiteBooks GSP."),
        isRetryable: false,
      };

      throw new WhiteBooksApiError(parsedError, { rawError: err.message });
    }
  }
}

export class WhiteBooksApiError extends Error {
  public parsed: ParsedEwbError;
  public rawResponse: any;
  public httpStatus?: number;

  constructor(parsed: ParsedEwbError, rawResponse?: any, httpStatus?: number) {
    super(parsed.message);
    this.name = "WhiteBooksApiError";
    this.parsed = parsed;
    this.rawResponse = sanitizePayload(rawResponse);
    this.httpStatus = httpStatus;
  }
}
