import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createJournalEntrySchema } from "@/lib/schemas/accounting";
import { postJournalEntry } from "@/lib/accounting/ledger";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "view");

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const fiscalYear = searchParams.get("fiscalYear");
    const status = searchParams.get("status");

    const journals = await db.journalEntry.findMany({
      where: {
        ...(type ? { journalType: type } : {}),
        ...(fiscalYear ? { fiscalYear } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, accountCode: true, accountName: true } },
            customer: { select: { id: true, name: true, customerCode: true } },
            supplier: { select: { id: true, name: true, supplierCode: true } },
          },
          orderBy: { lineOrder: "asc" },
        },
      },
      orderBy: { postingDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: journals });
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
    const parsed = createJournalEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const journal = await postJournalEntry(input, actor);

    return NextResponse.json(
      {
        success: true,
        data: journal,
        message: `Journal entry ${journal.journalNumber} posted successfully. Total: ₹${journal.totalDebit.toFixed(2)}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : error.message?.includes("UNBALANCED_JOURNAL") || error.message?.includes("ACCOUNTING_PERIOD_LOCKED")
      ? 400
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

