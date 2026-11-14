import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { completeMaterialRepairSchema } from "@/lib/schemas/material-repair";
import { completeMaterialRepair } from "@/lib/material-repair/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_maintenance", "approve");

    const { id } = await params;
    const body = await req.json();
    const parsed = completeMaterialRepairSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const updatedJob = await completeMaterialRepair(
      id,
      parsed.data,
      {
        id: session!.id,
        name: session!.name,
        role: session!.role,
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      }
    );

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: `Successfully completed repair of ${parsed.data.repairedQuantity} units. Remaining under repair: ${updatedJob.remainingQuantity.toString()}`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

