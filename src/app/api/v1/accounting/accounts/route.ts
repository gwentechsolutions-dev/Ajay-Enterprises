import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAccountSchema } from "@/lib/schemas/accounting";
import { logAuditEvent } from "@/lib/audit";
import { seedDefaultChartOfAccounts } from "@/lib/accounting/chart-of-accounts";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    // Ensure default accounts exist
    await seedDefaultChartOfAccounts();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");

    const accounts = await db.chartOfAccount.findMany({
      where: {
        isActive: true,
        ...(category ? { accountCategory: category } : {}),
        ...(subcategory ? { accountSubcategory: subcategory } : {}),
      },
      orderBy: { accountCode: "asc" },
      include: {
        parentAccount: { select: { id: true, accountCode: true, accountName: true } },
      },
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "create");

    const body = await req.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // Check duplicate account code
    const existing = await db.chartOfAccount.findUnique({
      where: { accountCode: input.accountCode },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: `Account code ${input.accountCode} already exists.` } },
        { status: 409 }
      );
    }

    const account = await db.chartOfAccount.create({
      data: {
        accountCode: input.accountCode,
        accountName: input.accountName,
        accountCategory: input.accountCategory,
        accountSubcategory: input.accountSubcategory,
        parentAccountId: input.parentAccountId || null,
        currency: input.currency || "INR",
        openingBalance: input.openingBalance,
        openingBalanceType: input.openingBalanceType,
        currentBalance: input.openingBalance,
        isControlAccount: input.isControlAccount,
        bankAccountId: input.bankAccountId || null,
        notes: input.notes || null,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "ACCOUNTING",
      entityType: "ChartOfAccount",
      entityId: account.id,
      notes: `Created Account ${account.accountCode} - ${account.accountName} (${account.accountCategory})`,
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

