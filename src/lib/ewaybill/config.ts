/**
 * Server-Side Configuration Loader for Statutory E-Way Bill Providers
 * Operating Business: AJAY ENTERPRISES
 */

import { EwbProviderName, EwbEnvironment } from "./types";

export interface WhiteBooksConfig {
  environment: EwbEnvironment;
  baseUrl: string;
  email: string;
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
  gstin: string;
  ipAddress: string;
}

export interface FynConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  isSandbox: boolean;
}

export interface EWayBillSystemConfig {
  activeProvider: EwbProviderName;
  whitebooks: WhiteBooksConfig;
  fyn: FynConfig;
}

export function getWhiteBooksConfig(): WhiteBooksConfig {
  const envRaw = (process.env.WHITEBOOKS_EWAY_ENV || "sandbox").toLowerCase();
  const environment: EwbEnvironment = envRaw === "production" ? "PRODUCTION" : "SANDBOX";

  // Enforce sandbox if production is not explicitly authorized
  const baseUrl = environment === "PRODUCTION"
    ? (process.env.WHITEBOOKS_EWAY_BASE_URL || "https://api.whitebooks.in")
    : (process.env.WHITEBOOKS_EWAY_BASE_URL || "https://apisandbox.whitebooks.in");

  return {
    environment,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    email: process.env.WHITEBOOKS_EWAY_EMAIL || "",
    username: process.env.WHITEBOOKS_EWAY_USERNAME || "BVMTN",
    password: process.env.WHITEBOOKS_EWAY_PASSWORD || "",
    clientId: process.env.WHITEBOOKS_EWAY_CLIENT_ID || "",
    clientSecret: process.env.WHITEBOOKS_EWAY_CLIENT_SECRET || "",
    gstin: process.env.WHITEBOOKS_EWAY_GSTIN || "33AAGCB1286Q003",
    ipAddress: process.env.WHITEBOOKS_EWAY_IP_ADDRESS || "127.0.0.1",
  };
}

export function getFynConfig(): FynConfig {
  const baseUrl = process.env.FYN_BASE_URL || "https://sandbox.fyn.in/api/v1/ewaybill";
  const apiKey = process.env.FYN_API_KEY || "";
  const clientId = process.env.FYN_CLIENT_ID || "";
  const isSandbox = !apiKey || baseUrl.includes("sandbox");

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    clientId,
    isSandbox,
  };
}

export function getSystemEwbConfig(): EWayBillSystemConfig {
  const providerRaw = (process.env.EWAYBILL_ACTIVE_PROVIDER || "WHITEBOOKS").toUpperCase();
  const activeProvider: EwbProviderName = providerRaw === "FYN" ? "FYN" : "WHITEBOOKS";

  return {
    activeProvider,
    whitebooks: getWhiteBooksConfig(),
    fyn: getFynConfig(),
  };
}
