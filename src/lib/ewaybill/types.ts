/**
 * INVENTRA E-Way Bill Integration: Common Provider Interface & Types
 * Operating Business: AJAY ENTERPRISES
 * Primary Provider: WhiteBooks (BVM IT Consulting Services India Pvt. Ltd.)
 * Backup Provider: FYN Gateway (Fynamics Techno Solutions Pvt. Ltd.)
 */

export type EwbProviderName = "WHITEBOOKS" | "FYN";
export type EwbEnvironment = "SANDBOX" | "PRODUCTION";

export type EwbStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "UNKNOWN" | "FAILED" | "ERROR";
export type OperationStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "UNKNOWN";
export type EwbOperationType =
  | "GENERATE"
  | "UPDATE_VEHICLE"
  | "CANCEL"
  | "GET_DETAILS"
  | "TEST_CONNECTION"
  | "LOOKUP_GSTIN"
  | "LOOKUP_HSN";

export interface AuditActor {
  id: string;
  name: string;
  role: string;
  ipAddress?: string;
}

export interface EwbItemInput {
  materialName: string;
  description?: string;
  hsnCode: string;
  quantity: number;
  uom: string; // "NOS", "SET", "BND", "MTR", "KGS", etc.
  taxableValue: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
}

export interface GenerateEwbRequest {
  documentType: "DELIVERY_NOTE" | "TRANSFER_NOTE";
  documentId: string;
  documentNumber: string;
  documentDate: Date;
  
  // Consignor
  fromGstin: string;
  fromTradeName: string;
  fromAddress1: string;
  fromAddress2?: string;
  fromPlace: string;
  fromPincode: string;
  fromStateCode: number; // e.g. 33 (TN), 29 (KA)

  // Consignee
  toGstin?: string; // "URP" if unregistered
  toTradeName: string;
  toAddress1: string;
  toAddress2?: string;
  toPlace: string;
  toPincode: string;
  toStateCode: number;

  // Transportation
  vehicleNumber: string;
  transMode?: "1" | "2" | "3" | "4"; // 1 = Road
  vehicleType?: "R" | "O"; // Regular, Over-dimensional
  distanceKm: number;

  // Supply classification
  supplyType?: "O" | "I"; // Default "O"
  subSupplyType?: string; // "4" (Job work), "5" (Own use), "8" (Others)
  subSupplyDesc?: string;
  docType?: "CHL" | "INV";

  // Financials
  totalTaxableValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue?: number;
  totalInvoiceValue: number;

  items: EwbItemInput[];
  idempotencyKey?: string;
}

export interface GenerateEwbResponse {
  success: boolean;
  ewbNumber?: string;
  ewbDate?: Date;
  validUntil?: Date;
  status: EwbStatus;
  provider: EwbProviderName;
  environment: EwbEnvironment;
  referenceId?: string;
  errorCode?: string;
  message: string;
  rawResponse?: any;
  requiresReconciliation?: boolean;
}

export interface UpdateVehicleRequest {
  ewbNumber: string;
  newVehicleNumber: string;
  fromPlace: string;
  fromStateCode: number;
  reasonCode: "1" | "2" | "3"; // 1: Break Down, 2: Transshipment, 3: Others
  reasonDescription: string;
  transMode?: "1" | "2" | "3" | "4";
  transDocNo?: string;
  transDocDate?: string;
}

export interface UpdateVehicleResponse {
  success: boolean;
  ewbNumber: string;
  vehicleNumber: string;
  updatedDate: Date;
  validUntil?: Date;
  message: string;
  rawResponse?: any;
}

export interface CancelEwbRequest {
  ewbNumber: string;
  cancelReasonCode: "1" | "2" | "3" | "4"; // 1: Duplicate, 2: Order Cancelled, 3: Data Entry Error, 4: Others
  cancelRemarks: string;
}

export interface CancelEwbResponse {
  success: boolean;
  ewbNumber: string;
  cancelledAt: Date;
  message: string;
  rawResponse?: any;
}

export interface EwbDetailsResponse {
  success: boolean;
  ewbNumber: string;
  status: EwbStatus;
  validUntil?: Date;
  vehicleNumber?: string;
  fromGstin?: string;
  toGstin?: string;
  documentNumber?: string;
  documentDate?: string;
  totalValue?: number;
  rawResponse?: any;
  message?: string;
}

export interface GstinLookupResponse {
  success: boolean;
  gstin: string;
  tradeName?: string;
  legalName?: string;
  status?: string;
  address?: {
    buildingName?: string;
    street?: string;
    location?: string;
    pincode?: string;
    stateCode?: string;
  };
  message?: string;
  rawResponse?: any;
}

export interface HsnLookupResponse {
  success: boolean;
  hsnCode: string;
  description?: string;
  gstRate?: number;
  message?: string;
  rawResponse?: any;
}

export interface ConnectionTestResult {
  success: boolean;
  provider: EwbProviderName;
  environment: EwbEnvironment;
  latencyMs: number;
  message: string;
  details?: {
    gstin?: string;
    authenticatedUser?: string;
    tokenExpiry?: string;
  };
}

/**
 * Common Statutory E-Way Bill Provider Interface
 */
export interface EWayBillProvider {
  readonly name: EwbProviderName;

  testConnection(): Promise<ConnectionTestResult>;
  generateEWayBill(req: GenerateEwbRequest, actor: AuditActor): Promise<GenerateEwbResponse>;
  getEWayBillDetails(ewbNumber: string): Promise<EwbDetailsResponse>;
  updateVehicle(req: UpdateVehicleRequest, actor: AuditActor): Promise<UpdateVehicleResponse>;
  cancelEWayBill(req: CancelEwbRequest, actor: AuditActor): Promise<CancelEwbResponse>;
  lookupGSTIN?(gstin: string): Promise<GstinLookupResponse>;
  lookupHSN?(hsnCode: string): Promise<HsnLookupResponse>;
}
