/**
 * WhiteBooks Part-B / Vehicle Update Service
 * Endpoint: POST /ewaybillapi/v1.03/ewayapi/vehewb
 */

import { WhiteBooksClient, WhiteBooksApiError } from "./client";
import { UpdateVehicleRequest, UpdateVehicleResponse } from "../../types";
import { sanitizeAndValidateVehicleNumber } from "./mapper";
import { ewbLogger, sanitizePayload } from "../../logger";

export async function executeWhiteBooksVehicleUpdate(
  client: WhiteBooksClient,
  req: UpdateVehicleRequest
): Promise<UpdateVehicleResponse> {
  const cleanVehicleNo = sanitizeAndValidateVehicleNumber(req.newVehicleNumber);
  const cleanEwbNo = req.ewbNumber.trim();

  // If simulation mode
  if (cleanEwbNo.startsWith("3312") || !client.config.clientId) {
    ewbLogger.info(`[WhiteBooks Vehicle Update Simulation] Updating vehicle for EWB ${cleanEwbNo} to ${cleanVehicleNo}`);
    return {
      success: true,
      ewbNumber: cleanEwbNo,
      vehicleNumber: cleanVehicleNo,
      updatedDate: new Date(),
      message: `Vehicle updated to ${cleanVehicleNo} successfully via WhiteBooks Sandbox.`,
      rawResponse: {
        status: "SUCCESS",
        mode: "SANDBOX_SIMULATION",
        ewbNo: cleanEwbNo,
        vehNo: cleanVehicleNo,
      },
    };
  }

  const payload = {
    ewbNo: cleanEwbNo,
    vehicleNo: cleanVehicleNo,
    fromPlace: req.fromPlace.slice(0, 50),
    fromState: req.fromStateCode,
    reasonCode: req.reasonCode,
    reasonRem: (req.reasonDescription || "Vehicle change during transit").slice(0, 50),
    transDocNo: req.transDocNo || "",
    transDocDate: req.transDocDate || "",
    transMode: req.transMode || "1",
  };

  try {
    const response = await client.request<{
      status?: number | string;
      data?: {
        vehUpdDate?: string;
        validUpto?: string;
      };
      vehUpdDate?: string;
      validUpto?: string;
      message?: string;
    }>({
      method: "POST",
      path: "/ewaybillapi/v1.03/ewayapi/vehewb",
      body: payload,
    });

    const updDateStr = response.data?.vehUpdDate || response.vehUpdDate;
    const validUptoStr = response.data?.validUpto || response.validUpto;

    return {
      success: true,
      ewbNumber: cleanEwbNo,
      vehicleNumber: cleanVehicleNo,
      updatedDate: updDateStr ? new Date(updDateStr) : new Date(),
      validUntil: validUptoStr ? new Date(validUptoStr) : undefined,
      message: `Part-B vehicle details updated to ${cleanVehicleNo} successfully via WhiteBooks.`,
      rawResponse: sanitizePayload(response),
    };
  } catch (err: any) {
    if (err instanceof WhiteBooksApiError) {
      throw new Error(`Vehicle update rejected: ${err.parsed.message}`);
    }
    throw new Error(`Failed to update vehicle via WhiteBooks: ${err.message}`);
  }
}
