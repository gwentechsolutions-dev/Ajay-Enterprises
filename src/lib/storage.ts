import crypto from "crypto";
import path from "path";
import { createAdminClient } from "./supabase/admin";

export const BUCKET_NAME = process.env.STORAGE_BUCKET || "inventra-private-documents";
const MAX_FILE_SIZE_BYTES = (parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB || "10", 10)) * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export interface SaveFileResult {
  fileName: string;
  fileMime: string;
  fileSize: number;
  storagePath: string;
  fileUrl: string;
  sha256: string;
}

/**
 * Validates file size and MIME type
 */
export function validateFile(buffer: Buffer, mimeType: string): void {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size limit of ${process.env.STORAGE_MAX_FILE_SIZE_MB || 10}MB`);
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`File type '${mimeType}' is not permitted. Only PNG, JPEG, WEBP and PDF are allowed.`);
  }
}

/**
 * Calculates SHA-256 hash of a buffer
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Saves a private file securely to Supabase Storage
 */
export async function savePrivateFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  subfolder: string = "general"
): Promise<SaveFileResult> {
  validateFile(buffer, mimeType);

  const sha256 = calculateChecksum(buffer);
  const ext = path.extname(originalFilename).toLowerCase() || (mimeType.includes("pdf") ? ".pdf" : ".png");
  const randomName = `${crypto.randomUUID()}${ext}`;
  const safeSubfolder = subfolder.replace(/[^a-zA-Z0-9_\-]/g, "");
  const storagePath = `${safeSubfolder}/${randomName}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

  if (isConfigured) {
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
  }

  const fileUrl = `/api/v1/storage/download?path=${encodeURIComponent(storagePath)}`;

  return {
    fileName: originalFilename,
    fileMime: mimeType,
    fileSize: buffer.length,
    storagePath,
    fileUrl,
    sha256,
  };
}

/**
 * Creates a short-lived signed URL for accessing a private document
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds: number = 300 // 5 minutes
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

  if (isConfigured) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate signed download URL: ${error?.message || "Unknown error"}`);
    }
    return data.signedUrl;
  }

  // Fallback endpoint for development/testing
  return `/api/v1/storage/download?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Downloads a private document directly from Supabase Storage
 */
export async function readPrivateFile(storagePath: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

  if (isConfigured) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error || !data) {
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mime: data.type || "application/octet-stream",
    };
  }

  return null;
}
