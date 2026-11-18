import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { SAMPLE_MATERIAL_TEMPLATE_ROWS } from "@/lib/materials/bulk-import-constants";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    // Prepare workbook
    const ws = XLSX.utils.json_to_sheet(SAMPLE_MATERIAL_TEMPLATE_ROWS);

    // Auto-fit column widths for better visual readability
    ws["!cols"] = [
      { wch: 18 }, // Material Code
      { wch: 22 }, // Material Name
      { wch: 24 }, // Category
      { wch: 20 }, // Material Type
      { wch: 20 }, // Size / Dimensions
      { wch: 10 }, // UOM
      { wch: 18 }, // Daily Rental Rate
      { wch: 14 }, // Ownership
      { wch: 12 }, // Status
      { wch: 38 }, // Description
    ];

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="inventra-material-import-template.csv"',
        },
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Catalogue Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="inventra-material-import-template.xlsx"',
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
