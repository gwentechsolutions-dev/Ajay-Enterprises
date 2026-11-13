import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getCurrentFiscalYear } from "@/lib/document-series";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const fiscalYear = searchParams.get("fiscalYear") || getCurrentFiscalYear();

    const periods = await db.accountingPeriod.findMany({
      where: { fiscalYear },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ success: true, data: periods });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "approve");

    const body = await req.json();
    const { fiscalYear, periodName, startDate, endDate, notes } = body;

    if (!fiscalYear || !periodName || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: { message: "Missing required period fields" } }, { status: 422 });
    }

    const period = await db.accountingPeriod.create({
      data: {
        fiscalYear,
        periodName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

