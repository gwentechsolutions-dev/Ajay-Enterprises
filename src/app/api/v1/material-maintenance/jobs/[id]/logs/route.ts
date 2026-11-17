import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { addRepairLogSchema } from "@/lib/schemas/material-repair";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_maintenance", "edit");

    const { id } = await params;
    const body = await req.json();
    const parsed = addRepairLogSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const job = await db.materialRepairJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ success: false, error: { message: "Repair job not found" } }, { status: 404 });
    }

    const input = parsed.data;
    const log = await db.materialRepairLog.create({
      data: {
        repairJobId: id,
        action: input.action,
        notes: input.notes,
        technicianName: input.technicianName || null,
        partsUsed: input.partsUsed || null,
        cost: input.cost,
      },
    });

    return NextResponse.json({ success: true, data: log, message: "Progress log added." }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

