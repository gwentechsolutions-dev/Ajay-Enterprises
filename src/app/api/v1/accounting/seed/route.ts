import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { seedDefaultChartOfAccounts } from "@/lib/accounting/chart-of-accounts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "create");

    const result = await seedDefaultChartOfAccounts();
    return NextResponse.json({
      success: true,
      data: result,
      message: `Chart of Accounts initialized. Seeded ${result.seededCount} default accounts.`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

