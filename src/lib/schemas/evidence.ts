import { z } from "zod";
import { OptionalIndianMobileSchema } from "./common";

export const captureEvidenceSchema = z.object({
  documentType: z.enum(["DELIVERY_NOTE", "RETURN_NOTE", "TRANSFER_NOTE", "GRN"]),
  documentId: z.string().uuid("Document ID is required"),
  photoUrl: z.string().min(5, "Photo URL or storage path is required"),
  storagePath: z.string().optional().nullable(),
  fileChecksum: z.string().optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsAccuracy: z.coerce.number().min(0).optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPhone: OptionalIndianMobileSchema,
  receiverDesignation: z.string().optional().nullable(),
  receiverSignatureUrl: z.string().optional().nullable(),
  missingEvidenceReason: z.string().optional().nullable(),
});

export type CaptureEvidenceInput = z.infer<typeof captureEvidenceSchema>;

