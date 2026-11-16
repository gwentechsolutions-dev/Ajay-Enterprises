/**
 * WhiteBooks Statutory E-Way Bill Cancellation Service
 * Endpoint: POST /ewaybillapi/v1.03/ewayapi/canewb
 */

import { WhiteBooksClient, WhiteBooksApiError } from "./client";
import { CancelEwbRequest, CancelEwbResponse } from "../../types";
import { ewbLogger, sanitizePayload } from "../../logger";

export async function executeWhiteBooksCancel(
  client: WhiteBooksClient,
  req: CancelEwbRequest
): Promise<CancelEwbResponse> {
  const cleanEwbNo = req.ewbNumber.trim();

  if (!req.cancelRemarks || req.cancelRemarks.trim().length < 5) {
    throw new Error("Cancellation remarks are required (minimum 5 characters).");
  }

  // Simulation mode
  if (cleanEwbNo.startsWith("3312") || !client.config.clientId) {
    ewbLogger.info(`[WhiteBooks Cancellation Simulation] Cancelling EWB ${cleanEwbNo}`);
    return {
      success: true,
      ewbNumber: cleanEwbNo,
      cancelledAt: new Date(),
      message: `E-Way Bill ${cleanEwbNo} cancelled successfully via WhiteBooks Sandbox.`,
      rawResponse: {
        status: "SUCCESS",
        mode: "SANDBOX_SIMULATION",
        ewbNo: cleanEwbNo,
        cancelDate: new Date().toISOString(),
      },
    };
  }

  const payload = {
    ewbNo: cleanEwbNo,
    cancelRsnCode: Number(req.cancelReasonCode),
    cancelRmrk: req.cancelRemarks.trim().slice(0, 100),
  };

  try {
    const response = await client.request<{
      status?: number | string;
      data?: {
        cancelDate?: string;
        ewbNo?: string | number;
      };
      cancelDate?: string;
      ewbNo?: string | number;
      message?: string;
    }>({
      method: "POST",
      path: "/ewaybillapi/v1.03/ewayapi/canewb",
      body: payload,
    });

    const cancelDateStr = response.data?.cancelDate || response.cancelDate;

    return {
      success: true,
      ewbNumber: cleanEwbNo,
      cancelledAt: cancelDateStr ? new Date(cancelDateStr) : new Date(),
      message: `Statutory E-Way Bill ${cleanEwbNo} has been cancelled successfully via WhiteBooks.`,
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    if (err instanceof WhiteBooksApiError) {
      throw new Error(`E-Way Bill cancellation rejected: ${err.parsed.message}`);
    }
    throw new Error(`Failed to cancel E-Way Bill via WhiteBooks: ${err.message}`);
  }
}
