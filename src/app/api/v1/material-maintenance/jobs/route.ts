import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createMaterialRepairJobSchema } from "@/lib/schemas/material-repair";
import { createMaterialRepairJob } from "@/lib/material-repair/service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_maintenance", "view");

    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const materialVariantId = searchParams.get("materialVariantId") || undefined;
    const status = searchParams.get("status") || undefined;
    const ownershipType = searchParams.get("ownershipType") || undefined;

    const jobs = await db.materialRepairJob.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(materialVariantId ? { materialVariantId } : {}),
        ...(status ? { status } : {}),
        ...(ownershipType ? { ownershipType } : {}),
      },
      include: {
        warehouse: { select: { id: true, name: true, warehouseCode: true } },
        materialVariant: { select: { id: true, name: true, materialCode: true, uom: true } },
        assignedTechnician: { select: { id: true, name: true, workerCode: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_maintenance", "create");

    const body = await req.json();
    const parsed = createMaterialRepairJobSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const job = await createMaterialRepairJob(parsed.data, {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: job, message: `Repair Job ${job.jobCode} created.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

