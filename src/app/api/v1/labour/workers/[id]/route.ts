import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { updateLabourWorkerSchema } from "@/lib/schemas/labour";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { id } = await params;
    const worker = await db.labourWorker.findUnique({
      where: { id },
      include: {
        branch: true,
        advances: {
          orderBy: { advanceDate: "desc" },
          take: 10,
        },
        attendances: {
          orderBy: { attendanceDate: "desc" },
          take: 30,
        },
        wageSettlements: {
          orderBy: { periodEnd: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 10,
        },
      },
    });

    if (!worker) {
      return NextResponse.json({ success: false, error: { message: "Worker not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: worker });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "edit");

    const { id } = await params;
    const existing = await db.labourWorker.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Worker not found" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateLabourWorkerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const updated = await db.labourWorker.update({
      where: { id },
      data: {
        name: input.name || undefined,
        mobileNumber: input.mobileNumber || undefined,
        address: input.address !== undefined ? input.address : undefined,
        emergencyContact: input.emergencyContact !== undefined ? input.emergencyContact : undefined,
        category: input.category || undefined,
        skillTrade: input.skillTrade !== undefined ? input.skillTrade : undefined,
        wageType: input.wageType || undefined,
        dailyWage: input.dailyWage !== undefined ? input.dailyWage : undefined,
        monthlySalary: input.monthlySalary !== undefined ? input.monthlySalary : undefined,
        paymentFrequency: input.paymentFrequency || undefined,
        assignedSupervisorId: input.assignedSupervisorId !== undefined ? input.assignedSupervisorId || null : undefined,
        branchId: input.branchId !== undefined ? input.branchId || null : undefined,
        idDocumentUrl: input.idDocumentUrl !== undefined ? input.idDocumentUrl : undefined,
        status: input.status || undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "UPDATE",
      module: "labour",
      entityType: "LabourWorker",
      entityId: updated.id,
      beforeState: existing,
      afterState: updated,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: updated, message: `Worker ${updated.name} updated.` });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

