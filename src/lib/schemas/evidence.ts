import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const EvidenceCategoryEnum = z.enum([
  "DELIVERY_PHOTO",
  "UNLOADING",
  "RECEIVER_ACKNOWLEDGEMENT",
  "RETURN_PICKUP",
  "RETURN_CONDITION",
  "LOADING",
  "YARD_RECEIVING",
  "SOURCE_PICKUP",
  "DESTINATION_UNLOAD",
  "GODOWN_RETURN",
  "GENERAL_EVIDENCE",
]);

export const captureEvidenceSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "RETURN_NOTE", "TRANSFER_NOTE", "DIRECT_TRANSFER", "GRN"]),
  documentId: z.string().uuid("Document ID is required"),
  photoUrl: z.string().min(5, "Photo URL or storage path is required"),
  storagePath: z.string().optional().nullable(),
  fileChecksum: z.string().optional().nullable(),
  originalPhotoUrl: z.string().optional().nullable(),
  originalStoragePath: z.string().optional().nullable(),
  watermarkedPhotoUrl: z.string().optional().nullable(),
  watermarkedStoragePath: z.string().optional().nullable(),
  geocodedAddress: z.string().optional().nullable(),
  geocodingStatus: z.enum(["SUCCESS", "FAILED", "PENDING_KEY", "PENDING"]).optional().nullable(),
  miniMapStatus: z.enum(["SUCCESS", "FAILED", "PENDING_KEY", "PENDING"]).optional().nullable(),
  evidenceCategory: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  capturedAt: z.coerce.date().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
});

export type CaptureEvidenceInput = z.infer<typeof captureEvidenceSchema>;
