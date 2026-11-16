/**
 * WhiteBooks Statutory E-Way Bill Generation Service
 * Endpoint: POST /ewaybillapi/v1.03/ewayapi/genewaybill
 */

import { WhiteBooksClient, WhiteBooksApiError } from "./client";
import { GenerateEwbRequest, GenerateEwbResponse } from "../../types";
import { mapInventraToWhiteBooksPayload } from "./mapper";
import { ewbLogger, sanitizePayload } from "../../logger";

export async function executeWhiteBooksGenerate(
  client: WhiteBooksClient,
  req: GenerateEwbRequest
): Promise<GenerateEwbResponse> {
  // Statutory Production Safety Lock:
  if (client.config.environment === "PRODUCTION" && process.env.ALLOW_PRODUCTION_EWAYBILL !== "true") {
    throw new Error(
      "STATUTORY SAFETY BLOCK: Production E-Way Bill generation is strictly locked. Phase 6 is in SANDBOX testing mode."
    );
  }

  // Map INVENTRA input into WhiteBooks payload
  const payload = mapInventraToWhiteBooksPayload(req);

  // If simulation mode or demo document
  if (req.documentNumber.includes("DEMO") || (!client.config.clientId && client.config.environment === "SANDBOX")) {
    ewbLogger.info(`[WhiteBooks Sandbox Simulation] Generating simulated EWB for ${req.documentNumber}`);
    const simulatedEwb = `3312${Date.now().toString().slice(-8)}`;
    const validityDays = Math.max(1, Math.ceil(req.distanceKm / 100));
    const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    return {
      success: true,
      ewbNumber: simulatedEwb,
      ewbDate: new Date(),
      validUntil,
      status: "ACTIVE",
      provider: "WHITEBOOKS",
      environment: client.config.environment,
      referenceId: `WB-SIM-${Date.now()}`,
      message: `E-Way Bill ${simulatedEwb} generated successfully via WhiteBooks Sandbox.`,
      rawResponse: {
        status: "SUCCESS",
        mode: "SANDBOX_SIMULATION",
        ewayBillNo: simulatedEwb,
        validUpto: validUntil.toISOString(),
      },
    };
  }

  try {
    const response = await client.request<{
      status?: number | string;
      data?: {
        ewayBillNo?: string | number;
        ewbNo?: string | number;
        ewayBillDate?: string;
        validUpto?: string;
        alert?: string;
      };
      ewayBillNo?: string | number;
      ewbNo?: string | number;
      ewayBillDate?: string;
      validUpto?: string;
      alert?: string;
      message?: string;
    }>({
      method: "POST",
      path: "/ewaybillapi/v1.03/ewayapi/genewaybill",
      body: payload,
      timeoutMs: 35000,
    });

    const ewbRaw = response.data?.ewayBillNo || response.data?.ewbNo || response.ewayBillNo || response.ewbNo;
    if (!ewbRaw) {
      throw new Error("WhiteBooks response did not contain an E-Way Bill Number.");
    }

    const ewbNumber = String(ewbRaw).trim();
    const validUptoStr = response.data?.validUpto || response.validUpto;
    let validUntil: Date | undefined;
    if (validUptoStr) {
      validUntil = new Date(validUptoStr);
    }
    if (!validUntil || isNaN(validUntil.getTime())) {
      const validityDays = Math.max(1, Math.ceil(req.distanceKm / 100));
      validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    }

    return {
      success: true,
      ewbNumber,
      ewbDate: new Date(),
      validUntil,
      status: "ACTIVE",
      provider: "WHITEBOOKS",
      environment: client.config.environment,
      referenceId: `WB-${ewbNumber}`,
      message: `Statutory E-Way Bill ${ewbNumber} generated successfully via WhiteBooks GSP.`,
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    if (err instanceof WhiteBooksApiError) {
      if (err.parsed.category === "NETWORK_TIMEOUT") {
        // Uncertain outcome - mark as requiring reconciliation
        return {
          success: false,
          status: "UNKNOWN",
          provider: "WHITEBOOKS",
          environment: client.config.environment,
          message: "Request timed out. The provider may have generated the E-Way Bill. Please check status before retrying.",
          requiresReconciliation: true,
          rawResponse: err.rawResponse,
        };
      }

      return {
        success: false,
        status: "FAILED",
        provider: "WHITEBOOKS",
        environment: client.config.environment,
        message: `WhiteBooks E-Way Bill generation rejected: ${err.parsed.message}`,
        rawResponse: err.rawResponse,
      };
    }

    return {
      success: false,
      status: "ERROR",
      provider: "WHITEBOOKS",
      environment: client.config.environment,
      message: `Failed to generate E-Way Bill: ${err.message}`,
    };
  }
}
