import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "audit_logs", "view");

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const moduleFilter = searchParams.get("module") || "";
    const actionFilter = searchParams.get("action") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { userName: { contains: search } },
        { action: { contains: search } },
        { entityType: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    if (moduleFilter && moduleFilter !== "ALL") {
      where.module = moduleFilter;
    }

    if (actionFilter && actionFilter !== "ALL") {
      where.action = actionFilter;
    }

    const [total, logs] = await Promise.all([
      db.auditEvent.count({ where }),
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

