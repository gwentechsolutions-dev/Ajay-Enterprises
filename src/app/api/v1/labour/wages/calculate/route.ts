import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { calculateWageSettlementSchema } from "@/lib/schemas/labour";
import { calculateWorkerWages } from "@/lib/labour/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const body = await req.json();
    const parsed = calculateWageSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const result = await calculateWorkerWages({
      workerId: input.workerId,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      overtimeRatePerHour: input.overtimeRatePerHour,
      overtimeMultiplier: input.overtimeMultiplier,
      requireApprovedOvertimeOnly: input.requireApprovedOvertimeOnly,
      halfDayFactor: input.halfDayFactor,
      monthlyProrationPolicy: input.monthlyProrationPolicy,
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

