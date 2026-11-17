import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { documentSeriesSchema } from "@/lib/schemas/document-series";
import { DOCUMENT_TYPES, getCurrentFiscalYear, formatDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "document_settings", "view");

    const { searchParams } = new URL(req.url);
    const fiscalYear = searchParams.get("fiscalYear") || getCurrentFiscalYear();

    const [seriesList, fiscalYears] = await Promise.all([
      db.documentSeries.findMany({
        where: { fiscalYear },
        orderBy: { documentType: "asc" },
      }),
      db.financialYear.findMany({
        orderBy: { startDate: "desc" },
      }),
    ]);

    // Format with live preview sample
    const enrichedSeries = seriesList.map((s) => ({
      ...s,
      preview: formatDocumentNumber(s.prefix, s.currentCounter + 1, s.padding, s.suffix || ""),
    }));

    return NextResponse.json({
      success: true,
      data: {
        series: enrichedSeries,
        fiscalYears,
        documentTypes: DOCUMENT_TYPES,
        activeFiscalYear: fiscalYear,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "document_settings", "edit");

    const body = await req.json();
    const parsed = documentSeriesSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;

    const series = await db.documentSeries.upsert({
      where: {
        documentType_fiscalYear: {
          documentType: data.documentType,
          fiscalYear: data.fiscalYear,
        },
      },
      update: {
        prefix: data.prefix,
        currentCounter: data.currentCounter,
        padding: data.padding,
        suffix: data.suffix || "",
        isActive: data.isActive,
      },
      create: {
        documentType: data.documentType,
        fiscalYear: data.fiscalYear,
        prefix: data.prefix,
        currentCounter: data.currentCounter,
        padding: data.padding,
        suffix: data.suffix || "",
        isActive: data.isActive,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "SERIES",
      entityType: "DocumentSeries",
      entityId: series.id,
      notes: `Updated series for ${series.documentType} (${series.fiscalYear}) -> Prefix: ${series.prefix}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...series,
        preview: formatDocumentNumber(series.prefix, series.currentCounter + 1, series.padding, series.suffix || ""),
      },
      message: "Document series saved successfully",
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

