import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { calculateWageSettlementSchema } from "@/lib/schemas/labour";
import { calculateWorkerWages } from "@/lib/labour/service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const body = await req.json();
    const parsed = calculateWageSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const result = await calculateWorkerWages({
      workerId: input.workerId,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      overtimeRatePerHour: input.overtimeRatePerHour,
      halfDayFactor: input.halfDayFactor,
      bonusAmount: input.bonusAmount,
      otherDeductions: input.otherDeductions,
      advanceDeduction: input.advanceDeduction,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

