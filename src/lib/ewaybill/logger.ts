/**
 * Centralized Credential & Token Sanitization Logger for E-Way Bill Operations
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "client_secret",
  "clientsecret",
  "authtoken",
  "auth_token",
  "token",
  "sek",
  "apikey",
  "api_key",
  "authorization",
  "x-api-key",
]);

/**
 * Sanitizes URLs to remove sensitive query parameters (e.g. ?password=...&username=...)
 */
export function sanitizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes("pass") || key.toLowerCase().includes("secret")) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    // If not a full URL or parse fails, regex replace sensitive key=value pairs
    return urlStr
      .replace(/password=[^&]*/gi, "password=[REDACTED]")
      .replace(/client_secret=[^&]*/gi, "client_secret=[REDACTED]")
      .replace(/token=[^&]*/gi, "token=[REDACTED]");
  }
}

/**
 * Recursively redacts sensitive keys from objects before serialization or logging.
 */
export function sanitizePayload<T = any>(data: T): T {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizePayload) as unknown as T;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("pass") || lowerKey.includes("secret")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizePayload(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}

export const ewbLogger = {
  info(message: string, context?: Record<string, any>) {
    if (context) {
      console.log(`[EWB INFO] ${message}`, JSON.stringify(sanitizePayload(context)));
    } else {
      console.log(`[EWB INFO] ${message}`);
    }
  },
  warn(message: string, context?: Record<string, any>) {
    if (context) {
      console.warn(`[EWB WARN] ${message}`, JSON.stringify(sanitizePayload(context)));
    } else {
      console.warn(`[EWB WARN] ${message}`);
    }
  },
  error(message: string, err?: any, context?: Record<string, any>) {
    const safeError = err instanceof Error ? { message: err.message, name: err.name } : err;
    const combined = { error: safeError, ...(context || {}) };
    console.error(`[EWB ERROR] ${message}`, JSON.stringify(sanitizePayload(combined)));
  },
};
