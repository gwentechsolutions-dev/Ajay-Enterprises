import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateCsvExport, generatePrintableHtml, ExportColumn, ExportMetadata } from "@/lib/reports/export-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    try {
      await requirePermission(session, "reports", "export");
    } catch {
      await requirePermission(session, "dashboard", "export");
    }

    const body = await req.json();
    const {
      format = "CSV",
      title = "INVENTRA Report",
      periodLabel,
      columns = [],
      data = [],
      filtersApplied = {},
      totals,
    } = body;

    const metadata: ExportMetadata = {
      reportTitle: title,
      businessName: "AJAY ENTERPRISES",
      softwareName: "INVENTRA",
      periodLabel,
      filtersApplied,
      generatedBy: session ? `${session.name} (${session.role})` : "Authorized User",
      generationDate: new Date(),
    };

    if (format === "CSV") {
      const csvContent = generateCsvExport(columns, data, metadata);
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "PRINT" || format === "HTML") {
      const htmlContent = generatePrintableHtml(columns, data, metadata, totals);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return NextResponse.json({ success: false, error: { message: "Unsupported export format" } }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
