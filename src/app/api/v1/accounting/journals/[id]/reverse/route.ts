import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { reverseJournalEntry } from "@/lib/accounting/ledger";
import { z } from "zod";

const reverseSchema = z.object({
  reason: z.string().min(5, "Reversal reason must be at least 5 characters"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "accounting", "approve");
    const { id } = await params;

    const body = await req.json();
    const parsed = reverseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Valid reversal reason is required" } },
        { status: 422 }
      );
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const reversal = await reverseJournalEntry(id, parsed.data.reason, actor);

    return NextResponse.json({
      success: true,
      data: reversal,
      message: `Journal entry reversed. Reversal Journal ${reversal.journalNumber} created.`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

