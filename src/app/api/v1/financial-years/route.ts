import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { financialYearSchema } from "@/lib/schemas/document-series";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "document_settings", "view");

    const years = await db.financialYear.findMany({
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({ success: true, data: years });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "document_settings", "create");

    const body = await req.json();
    const parsed = financialYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Check duplicate
    const existing = await db.financialYear.findUnique({
      where: { yearCode: data.yearCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_YEAR", message: "Financial year already configured" } },
        { status: 409 }
      );
    }

    if (data.isCurrent) {
      await db.financialYear.updateMany({
        data: { isCurrent: false },
      });
    }

    const newYear = await db.financialYear.create({
      data: {
        yearCode: data.yearCode,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent,
        isClosed: data.isClosed,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "SERIES",
      entityType: "FinancialYear",
      entityId: newYear.id,
      notes: `Configured financial year ${newYear.yearCode}`,
    });

    return NextResponse.json({ success: true, data: newYear, message: "Financial year added successfully" }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

