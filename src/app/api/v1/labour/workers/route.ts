import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createLabourWorkerSchema } from "@/lib/schemas/labour";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const workers = await db.labourWorker.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        advances: {
          where: { status: { in: ["APPROVED", "PARTIALLY_RECOVERED"] } },
          select: { outstandingAmount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = workers.map((w) => {
      const totalOutstandingAdvance = w.advances.reduce(
        (sum, a) => sum + Number(a.outstandingAmount),
        0
      );
      return {
        ...w,
        totalOutstandingAdvance,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "create");

    const body = await req.json();
    const parsed = createLabourWorkerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const workerCode = input.workerCode || (await generateNextDocumentNumber("WRK"));

    const worker = await db.labourWorker.create({
      data: {
        workerCode,
        name: input.name,
        mobileNumber: input.mobileNumber,
        address: input.address || null,
        emergencyContact: input.emergencyContact || null,
        category: input.category,
        skillTrade: input.skillTrade || null,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
        wageType: input.wageType,
        dailyWage: input.dailyWage,
        monthlySalary: input.monthlySalary,
        paymentFrequency: input.paymentFrequency,
        assignedSupervisorId: input.assignedSupervisorId || null,
        branchId: input.branchId || null,
        idDocumentUrl: input.idDocumentUrl || null,
        status: input.status,
        notes: input.notes || null,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "labour",
      entityType: "LabourWorker",
      entityId: worker.id,
      afterState: worker,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, data: worker, message: `Worker ${worker.name} (${worker.workerCode}) registered.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

