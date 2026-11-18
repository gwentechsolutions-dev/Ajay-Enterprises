import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { validateBulkMaterialRows } from "@/lib/materials/bulk-import-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "view");

    const body = await req.json();
    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid request payload. Expected { rows: [...] }" } },
        { status: 400 }
      );
    }

    if (body.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No data rows provided for validation." } },
        { status: 400 }
      );
    }

    if (body.rows.length > 2500) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Upload contains ${body.rows.length} rows, which exceeds the maximum limit of 2,000 rows. Please split the file into smaller batches.`,
          },
        },
        { status: 400 }
      );
    }

    const summary = await validateBulkMaterialRows(body.rows);

    return NextResponse.json({
      success: true,
      data: summary,
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
