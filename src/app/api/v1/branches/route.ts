import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { branchSchema } from "@/lib/schemas/branch";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "branches", "view");

    const branches = await db.branch.findMany({
      include: {
        _count: { select: { warehouses: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: branches });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "branches", "create");

    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Check duplicate branch code
    const existing = await db.branch.findUnique({
      where: { branchCode: data.branchCode.toUpperCase() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: "Branch code already exists" } },
        { status: 409 }
      );
    }

    const newBranch = await db.branch.create({
      data: {
        branchCode: data.branchCode.toUpperCase(),
        name: data.name,
        branchType: data.branchType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        email: data.email || null,
        isActive: data.isActive,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "BRANCHES",
      entityType: "Branch",
      entityId: newBranch.id,
      afterState: newBranch,
      notes: `Created branch ${newBranch.name} (${newBranch.branchCode})`,
    });

    return NextResponse.json({ success: true, data: newBranch, message: "Branch created successfully" }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

