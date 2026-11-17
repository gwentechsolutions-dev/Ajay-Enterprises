import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { calculateStatementSchema } from "@/lib/schemas/rental";
import { calculateRentalStatement } from "@/lib/rentals/calculator";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");

    const body = await req.json();
    const parsed = calculateStatementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const calculation = await calculateRentalStatement(parsed.data);

    return NextResponse.json({
      success: true,
      data: calculation,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

