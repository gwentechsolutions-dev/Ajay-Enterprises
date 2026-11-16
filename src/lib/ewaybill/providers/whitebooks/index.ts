/**
 * WhiteBooks Primary E-Way Bill Provider Implementation
 * Operating Business: AJAY ENTERPRISES
 */

import {
  EWayBillProvider,
  EwbProviderName,
  ConnectionTestResult,
  GenerateEwbRequest,
  GenerateEwbResponse,
  EwbDetailsResponse,
  UpdateVehicleRequest,
  UpdateVehicleResponse,
  CancelEwbRequest,
  CancelEwbResponse,
  GstinLookupResponse,
  HsnLookupResponse,
  AuditActor,
} from "../../types";
import { WhiteBooksConfig, getWhiteBooksConfig } from "../../config";
import { WhiteBooksClient } from "./client";
import { executeWhiteBooksGenerate } from "./generate";
import { executeWhiteBooksVehicleUpdate } from "./vehicle";
import { executeWhiteBooksCancel } from "./cancel";
import {
  executeWhiteBooksGetDetails,
  executeWhiteBooksGstinLookup,
  executeWhiteBooksHsnLookup,
} from "./retrieval";

export class WhiteBooksProvider implements EWayBillProvider {
  readonly name: EwbProviderName = "WHITEBOOKS";
  private client: WhiteBooksClient;

  constructor(config?: WhiteBooksConfig) {
    const activeConfig = config || getWhiteBooksConfig();
    this.client = new WhiteBooksClient(activeConfig);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const result = await this.client.authService.testConnection();
    return {
      success: result.success,
      provider: "WHITEBOOKS",
      environment: this.client.config.environment,
      latencyMs: result.latencyMs,
      message: result.message,
      details: result.details,
    };
  }

  async generateEWayBill(req: GenerateEwbRequest, actor: AuditActor): Promise<GenerateEwbResponse> {
    return executeWhiteBooksGenerate(this.client, req);
  }

  async getEWayBillDetails(ewbNumber: string): Promise<EwbDetailsResponse> {
    return executeWhiteBooksGetDetails(this.client, ewbNumber);
  }

  async updateVehicle(req: UpdateVehicleRequest, actor: AuditActor): Promise<UpdateVehicleResponse> {
    return executeWhiteBooksVehicleUpdate(this.client, req);
  }

  async cancelEWayBill(req: CancelEwbRequest, actor: AuditActor): Promise<CancelEwbResponse> {
    return executeWhiteBooksCancel(this.client, req);
  }

  async lookupGSTIN(gstin: string): Promise<GstinLookupResponse> {
    return executeWhiteBooksGstinLookup(this.client, gstin);
  }

  async lookupHSN(hsnCode: string): Promise<HsnLookupResponse> {
    return executeWhiteBooksHsnLookup(this.client, hsnCode);
  }
}
