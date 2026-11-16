/**
 * WhiteBooks Retrieval & Diagnostic Lookup Services
 * Endpoints:
 * - GET /ewaybillapi/v1.03/ewayapi/getewaybill
 * - GET /ewaybillapi/v1.03/ewayapi/getgstindetails
 * - GET /ewaybillapi/v1.03/ewayapi/gethsndetailsbyhsncode
 */

import { WhiteBooksClient, WhiteBooksApiError } from "./client";
import {
  EwbDetailsResponse,
  GstinLookupResponse,
  HsnLookupResponse,
  EwbStatus,
} from "../../types";
import { sanitizePayload, ewbLogger } from "../../logger";

/**
 * Retrieves official E-Way Bill details from WhiteBooks/NIC
 */
export async function executeWhiteBooksGetDetails(
  client: WhiteBooksClient,
  ewbNumber: string
): Promise<EwbDetailsResponse> {
  const cleanEwb = ewbNumber.trim();

  // If simulation
  if (cleanEwb.startsWith("3312") || !client.config.clientId) {
    return {
      success: true,
      ewbNumber: cleanEwb,
      status: "ACTIVE",
      validUntil: new Date(Date.now() + 48 * 3600 * 1000),
      vehicleNumber: "KA01AB1234",
      fromGstin: client.config.gstin,
      documentNumber: "DN-SIM-001",
      totalValue: 50000,
      message: "[SANDBOX SIMULATION] E-Way Bill details retrieved.",
    };
  }

  try {
    const response = await client.request<any>({
      method: "GET",
      path: "/ewaybillapi/v1.03/ewayapi/getewaybill",
      queryParams: {
        ewbNo: cleanEwb,
      },
    });

    const data = response.data || response;
    const rawStatus = (data.status || "ACTIVE").toUpperCase();
    let status: EwbStatus = "ACTIVE";
    if (rawStatus === "CANCELLED" || rawStatus === "C") status = "CANCELLED";
    else if (rawStatus === "EXPIRED") status = "EXPIRED";

    return {
      success: true,
      ewbNumber: cleanEwb,
      status,
      validUntil: data.validUpto ? new Date(data.validUpto) : undefined,
      vehicleNumber: data.VehNo || data.vehicleNo,
      fromGstin: data.fromGstin,
      toGstin: data.toGstin,
      documentNumber: data.docNo,
      documentDate: data.docDate,
      totalValue: data.totalValue || data.totInvValue,
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    ewbLogger.warn(`Failed to fetch EWB details for ${cleanEwb}:`, { error: err.message });
    return {
      success: false,
      ewbNumber: cleanEwb,
      status: "UNKNOWN",
      message: err.message,
    };
  }
}

/**
 * Diagnostic GSTIN lookup via WhiteBooks
 */
export async function executeWhiteBooksGstinLookup(
  client: WhiteBooksClient,
  gstin: string
): Promise<GstinLookupResponse> {
  const cleanGstin = gstin.trim().toUpperCase();

  // Simulation mode
  if (!client.config.clientId) {
    return {
      success: true,
      gstin: cleanGstin,
      tradeName: "AJAY ENTERPRISES (TEST MOCK)",
      legalName: "AJAY ENTERPRISES",
      status: "ACTIVE",
      address: {
        street: "Industrial Area",
        location: "Chennai",
        pincode: "600001",
        stateCode: "33",
      },
    };
  }

  try {
    const response = await client.request<any>({
      method: "GET",
      path: "/ewaybillapi/v1.03/ewayapi/getgstindetails",
      queryParams: {
        GSTIN: cleanGstin,
      },
    });

    const data = response.data || response;
    return {
      success: true,
      gstin: cleanGstin,
      tradeName: data.tradeName || data.trade_name || data.legalName,
      legalName: data.legalName || data.legal_name,
      status: data.status || data.gstinStatus || "ACTIVE",
      address: {
        buildingName: data.bno,
        street: data.st,
        location: data.loc,
        pincode: String(data.pncd || data.pincode || ""),
        stateCode: String(data.stcd || ""),
      },
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    return {
      success: false,
      gstin: cleanGstin,
      message: err.message,
    };
  }
}

/**
 * Diagnostic HSN lookup via WhiteBooks
 */
export async function executeWhiteBooksHsnLookup(
  client: WhiteBooksClient,
  hsnCode: string
): Promise<HsnLookupResponse> {
  const cleanHsn = hsnCode.trim();

  // Simulation mode
  if (!client.config.clientId) {
    return {
      success: true,
      hsnCode: cleanHsn,
      description: cleanHsn.startsWith("7308")
        ? "Structures and parts of structures of iron or steel; plates, rods, angles, shapes, sections, tubes and the like"
        : "Centering & Scaffolding equipment tariff",
      gstRate: 18,
    };
  }

  try {
    const response = await client.request<any>({
      method: "GET",
      path: "/ewaybillapi/v1.03/ewayapi/gethsndetailsbyhsncode",
      queryParams: {
        hsncode: cleanHsn,
      },
    });

    const data = response.data || response;
    return {
      success: true,
      hsnCode: cleanHsn,
      description: data.description || data.hsnDesc || data.desc,
      gstRate: data.rate || data.gstRate,
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    return {
      success: false,
      hsnCode: cleanHsn,
      message: err.message,
    };
  }
}
