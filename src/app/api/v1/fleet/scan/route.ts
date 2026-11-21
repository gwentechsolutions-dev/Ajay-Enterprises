import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { savePrivateFile, ALLOWED_MIME_TYPES } from "@/lib/storage";
import {
  scanDocumentsWithDeepSeek,
  ScanType,
  ExpenseCategory,
  SCAN_TYPES,
  EXPENSE_CATEGORIES,
  ScanImageInput,
  VisionServiceError,
} from "@/lib/fleet/deepseek-vision";

// ==============================================================================
// INVENTRA: AI FLEET SCAN ENDPOINT
// POST /api/v1/fleet/scan
// ==============================================================================

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "fleet", "create");

    const formData = await req.formData();

    const scanTypeRaw = formData.get("scanType") as string;
    const scanType = (scanTypeRaw || "fuel_receipt") as ScanType;
    if (!SCAN_TYPES.includes(scanType)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid scanType '${scanType}'. Allowed: ${SCAN_TYPES.join(", ")}` } },
        { status: 400 }
      );
    }

    const categoryRaw = formData.get("category") as string;
    const category = categoryRaw && EXPENSE_CATEGORIES.includes(categoryRaw as ExpenseCategory)
      ? (categoryRaw as ExpenseCategory)
      : null;

    const vehicleId = formData.get("vehicleId") as string | null;
    let vehicleContext: { vehicleNumber: string; fuelType?: string; category?: string } | null = null;

    if (vehicleId) {
      const v = await db.vehicle.findUnique({
        where: { id: vehicleId },
        select: { vehicleNumber: true, fuelType: true, category: true },
      });
      if (v) {
        vehicleContext = {
          vehicleNumber: v.vehicleNumber,
          fuelType: v.fuelType,
          category: v.category,
        };
      }
    }

    const imagesToScan: ScanImageInput[] = [];
    let receiptFileUrl: string | null = null;
    let meterFileUrl: string | null = null;
    let odometerFileUrl: string | null = null;

    // Check for combined files
    const receiptFile = (formData.get("receiptImage") || formData.get("receiptFile") || formData.get("file") || formData.get("image")) as File | null;
    const meterFile = (formData.get("meterImage") || formData.get("meterFile")) as File | null;
    const odometerFile = (formData.get("odometerImage") || formData.get("odometerFile")) as File | null;

    async function processUpload(file: File, label: string): Promise<{ buffer: Buffer; mimeType: string; storageUrl: string }> {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = file.type || "image/jpeg";

      if (!ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== "image/jpg") {
        throw new Error(`File '${file.name}' has unsupported format '${mimeType}'. Supported: JPEG, PNG, WEBP, PDF.`);
      }

      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error(`File '${file.name}' exceeds the 10MB size limit.`);
      }

      const saveResult = await savePrivateFile(buffer, file.name, mimeType, "fleet-receipts");
      return { buffer, mimeType, storageUrl: saveResult.fileUrl };
    }

    if (receiptFile && receiptFile.size > 0) {
      const processed = await processUpload(receiptFile, "receipt");
      receiptFileUrl = processed.storageUrl;
      imagesToScan.push({
        buffer: processed.buffer,
        mimeType: processed.mimeType,
        label: "receipt",
      });
    }

    if (meterFile && meterFile.size > 0) {
      const processed = await processUpload(meterFile, "pump_meter");
      meterFileUrl = processed.storageUrl;
      imagesToScan.push({
        buffer: processed.buffer,
        mimeType: processed.mimeType,
        label: "pump_meter",
      });
    }

    if (odometerFile && odometerFile.size > 0) {
      const processed = await processUpload(odometerFile, "odometer");
      odometerFileUrl = processed.storageUrl;
      imagesToScan.push({
        buffer: processed.buffer,
        mimeType: processed.mimeType,
        label: "odometer",
      });
    }

    if (imagesToScan.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No image file uploaded. Please select or capture a photograph." } },
        { status: 400 }
      );
    }

    // Run DeepSeek AI extraction
    const extraction = await scanDocumentsWithDeepSeek({
      images: imagesToScan,
      scanType,
      category,
      vehicleContext,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...extraction,
        fileUrl: receiptFileUrl || meterFileUrl || odometerFileUrl,
        receiptFileUrl,
        meterFileUrl,
        odometerFileUrl,
      },
    });
  } catch (error: any) {
    console.error("[FleetScan API Error]", error);
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : error instanceof VisionServiceError
      ? error.status
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.userMessage || error.message || "An unexpected error occurred during document scanning.",
          code: error.code || "SCAN_ERROR",
        },
      },
      { status }
    );
  }
}
