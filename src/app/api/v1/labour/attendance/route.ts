import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { bulkAttendanceSchema } from "@/lib/schemas/labour";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "view");

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const workerId = searchParams.get("workerId") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    let dateFilter: any = {};
    if (dateStr) {
      dateFilter = new Date(dateStr);
    } else if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const attendances = await db.labourAttendance.findMany({
      where: {
        ...(Object.keys(dateFilter).length ? { attendanceDate: dateFilter } : {}),
        ...(workerId ? { workerId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        worker: { select: { id: true, name: true, workerCode: true, category: true, wageType: true, dailyWage: true } },
        branch: { select: { id: true, name: true } },
        customerSite: { select: { id: true, siteName: true } },
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ success: true, data: attendances });
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
    const parsed = bulkAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const attDate = new Date(input.attendanceDate);

    const results = await db.$transaction(async (tx) => {
      const savedRecords = [];

      for (const rec of input.records) {
        const recordDate = new Date(rec.attendanceDate);

        // Upsert to handle authorized edits while preventing duplicate entries for the same worker and date
        const att = await tx.labourAttendance.upsert({
          where: {
            workerId_attendanceDate: {
              workerId: rec.workerId,
              attendanceDate: recordDate,
            },
          },
          update: {
            status: rec.status,
            checkInTime: rec.checkInTime ? new Date(rec.checkInTime) : undefined,
            checkOutTime: rec.checkOutTime ? new Date(rec.checkOutTime) : undefined,
            overtimeHours: rec.overtimeHours,
            supervisorRemarks: rec.supervisorRemarks || undefined,
            branchId: rec.branchId || input.branchId || undefined,
            customerSiteId: rec.customerSiteId || input.customerSiteId || undefined,
          },
          create: {
            workerId: rec.workerId,
            attendanceDate: recordDate,
            status: rec.status,
            checkInTime: rec.checkInTime ? new Date(rec.checkInTime) : null,
            checkOutTime: rec.checkOutTime ? new Date(rec.checkOutTime) : null,
            overtimeHours: rec.overtimeHours,
            supervisorRemarks: rec.supervisorRemarks || null,
            branchId: rec.branchId || input.branchId || null,
            customerSiteId: rec.customerSiteId || input.customerSiteId || null,
            recordedById: session!.id,
          },
        });
        savedRecords.push(att);
      }

      return savedRecords;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "CREATE",
      module: "labour",
      entityType: "LabourAttendance",
      afterState: { date: input.attendanceDate, count: results.length },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(
      { success: true, data: results, message: `Recorded attendance for ${results.length} workers.` },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

