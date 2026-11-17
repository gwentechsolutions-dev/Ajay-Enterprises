import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { validationErrorResponse } from "@/lib/api-validation";

const approveAttendanceSchema = z.object({
  attendanceIds: z.array(z.string().uuid()).min(1, "At least one attendance ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "labour", "approve");

    const body = await req.json();
    const parsed = approveAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { attendanceIds } = parsed.data;

    const result = await db.labourAttendance.updateMany({
      where: { id: { in: attendanceIds } },
      data: {
        isApproved: true,
        approvedById: session!.id,
        approvedAt: new Date(),
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "APPROVE",
      module: "labour",
      entityType: "LabourAttendance",
      afterState: { approvedCount: result.count, ids: attendanceIds },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Approved ${result.count} attendance records.`,
      data: { count: result.count },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

