import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_maintenance", "view");

    const { id } = await params;
    const job = await db.materialRepairJob.findUnique({
      where: { id },
      include: {
        warehouse: true,
        materialVariant: true,
        materialReturnNote: { select: { id: true, mrnNumber: true } },
        rentalBatch: { select: { id: true, batchNumber: true } },
        assignedTechnician: true,
        journalEntry: { select: { id: true, journalNumber: true, totalDebit: true } },
        logs: { orderBy: { logDate: "desc" } },
      },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: { message: "Repair job not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

