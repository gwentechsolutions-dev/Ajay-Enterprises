/**
 * INVENTRA ERP - Evidence Uploader Service
 * Operating Business: AJAY ENTERPRISES
 * 
 * Implements strict separation of original photo and watermarked derivative
 * per Section 10 & 12 of INVENTRA Architecture:
 * 1. Takes original photo from device camera
 * 2. Burns GPS Camera watermark (Google Geocoding + Maps Static) onto a separate canvas
 * 3. Uploads untouched original photo to private storage
 * 4. Uploads watermarked derivative to private storage
 * 5. Records MovementEvidence linking both files, GPS coords, address, and statuses
 */

import { stampGpsWatermarkOnPhoto } from "./gps-watermark";

export interface UploadEvidenceParams {
  file: File;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
  documentType: "DELIVERY_NOTE" | "RETURN_NOTE" | "TRANSFER_NOTE" | "DIRECT_TRANSFER" | "GRN";
  documentId: string;
  documentNumber?: string;
  siteName?: string;
  customerName?: string;
  evidenceCategory?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverDesignation?: string;
  receiverSignatureUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
}

export interface UploadEvidenceResult {
  originalUrl: string;
  watermarkedUrl: string;
  originalStoragePath?: string;
  watermarkedStoragePath?: string;
  dataUrl: string;
  evidenceId?: string;
  addressLine1: string;
  addressLine2: string;
  geocodingStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
  miniMapStatus: "SUCCESS" | "PENDING_KEY" | "FAILED" | "OFFLINE";
}

/**
 * Uploads a file buffer/blob to /api/v1/storage/upload.
 */
async function uploadToStorage(file: File, folder: string): Promise<{ url: string; storagePath?: string; sha256?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/v1/storage/upload", {
    method: "POST",
    body: formData,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || "Storage upload failed");
  }

  const url =
    json.data?.url ||
    (json.data?.storagePath ? `/api/v1/storage/download?path=${encodeURIComponent(json.data.storagePath)}` : "");

  return {
    url,
    storagePath: json.data?.storagePath,
    sha256: json.data?.sha256,
  };
}

/**
 * Executes the complete watermark, upload, and evidence linking pipeline.
 */
export async function uploadEvidenceWithWatermark(
  params: UploadEvidenceParams
): Promise<UploadEvidenceResult> {
  const {
    file,
    latitude,
    longitude,
    accuracy = 5.0,
    timestamp = new Date(),
    documentType,
    documentId,
    documentNumber,
    siteName,
    customerName,
    evidenceCategory = "DELIVERY_PHOTO",
    receiverName,
    receiverPhone,
    receiverDesignation,
    receiverSignatureUrl,
    addressLine1,
    addressLine2,
  } = params;

  // 1. Generate Watermark Derivative via Canvas
  const watermarkResult = await stampGpsWatermarkOnPhoto({
    file,
    latitude,
    longitude,
    accuracy,
    siteName,
    customerName,
    documentNumber,
    timestamp,
    addressLine1,
    addressLine2,
  });

  // 2. Upload Untouched Original Photo & Watermarked Derivative concurrently in parallel
  const [originalUpload, watermarkedUpload] = await Promise.all([
    uploadToStorage(
      watermarkResult.originalFile,
      `${documentType.toLowerCase()}-originals`
    ),
    uploadToStorage(
      watermarkResult.watermarkedFile,
      `${documentType.toLowerCase()}-watermarked`
    ),
  ]);

  // 4. Construct Full Geocoded Address
  const fullAddress = [watermarkResult.addressLine1, watermarkResult.addressLine2].filter(Boolean).join(", ");

  // 5. Create MovementEvidence record in database
  let evidenceId: string | undefined;
  try {
    const evidenceRes = await fetch("/api/v1/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType,
        documentId,
        photoUrl: watermarkedUpload.url,
        storagePath: watermarkedUpload.storagePath,
        fileChecksum: watermarkedUpload.sha256,
        originalPhotoUrl: originalUpload.url,
        originalStoragePath: originalUpload.storagePath,
        watermarkedPhotoUrl: watermarkedUpload.url,
        watermarkedStoragePath: watermarkedUpload.storagePath,
        geocodedAddress: fullAddress || null,
        geocodingStatus: watermarkResult.geocodingStatus,
        miniMapStatus: watermarkResult.miniMapStatus,
        evidenceCategory,
        gpsLatitude: latitude,
        gpsLongitude: longitude,
        gpsAccuracy: accuracy,
        capturedAt: timestamp,
        receiverName,
        receiverPhone,
        receiverDesignation,
        receiverSignatureUrl,
      }),
    });

    if (evidenceRes.ok) {
      const evidenceJson = await evidenceRes.json();
      evidenceId = evidenceJson.data?.id;
    }
  } catch (evErr) {
    console.warn("Evidence record creation warning:", evErr);
  }

  return {
    originalUrl: originalUpload.url,
    watermarkedUrl: watermarkedUpload.url,
    originalStoragePath: originalUpload.storagePath,
    watermarkedStoragePath: watermarkedUpload.storagePath,
    dataUrl: watermarkResult.dataUrl,
    evidenceId,
    addressLine1: watermarkResult.addressLine1,
    addressLine2: watermarkResult.addressLine2,
    geocodingStatus: watermarkResult.geocodingStatus,
    miniMapStatus: watermarkResult.miniMapStatus,
  };
}
