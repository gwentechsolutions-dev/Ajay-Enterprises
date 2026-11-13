import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createUserSchema } from "@/lib/schemas/user";
import { logAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "users", "view");

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { userCode: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
      ];
    }

    if (role && role !== "ALL") {
      where.role = role;
    }

    if (status === "ACTIVE") {
      where.isActive = true;
    } else if (status === "INACTIVE") {
      where.isActive = false;
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true,
          supabaseId: true,
          userCode: true,
          name: true,
          email: true,
          username: true,
          mobile: true,
          role: true,
          scope: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          branch: { select: { id: true, name: true, branchCode: true } },
          warehouse: { select: { id: true, name: true, warehouseCode: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: status === 403 ? "FORBIDDEN" : "ERROR", message: error.message } },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "users", "create");

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "User validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const { name, email, username, mobile, password, role, scope, branchId, warehouseId, isActive } =
      parsed.data;

    // Check duplicate email
    const existingEmail = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_EMAIL", message: "A user with this email address already exists" } },
        { status: 409 }
      );
    }

    // Check duplicate username if provided
    if (username) {
      const existingUsername = await db.user.findUnique({
        where: { username: username.trim() },
      });
      if (existingUsername) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_USERNAME", message: "This username is already taken" } },
          { status: 409 }
        );
      }
    }

    // Generate next user code USR-XXXX
    const lastUser = await db.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { userCode: true },
    });
    let nextNum = 1;
    if (lastUser && lastUser.userCode.startsWith("USR-")) {
      const parsedNum = parseInt(lastUser.userCode.replace("USR-", ""), 10);
      if (!isNaN(parsedNum)) nextNum = parsedNum + 1;
    }
    const userCode = `USR-${nextNum.toString().padStart(4, "0")}`;

    // Create identity in Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    let supabaseId: string | null = null;

    if (isSupabaseConfigured) {
      const supabaseAdmin = createAdminClient();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          userCode,
        },
      });

      if (authError) {
        return NextResponse.json(
          { success: false, error: { code: "SUPABASE_AUTH_ERROR", message: authError.message } },
          { status: 400 }
        );
      }
      supabaseId = authData.user.id;
    }

    const newUser = await db.user.create({
      data: {
        supabaseId,
        userCode,
        name,
        email: email.toLowerCase().trim(),
        username: username ? username.trim() : null,
        mobile: mobile.trim(),
        role,
        scope,
        branchId: branchId || null,
        warehouseId: warehouseId || null,
        isActive,
      },
      select: {
        id: true,
        supabaseId: true,
        userCode: true,
        name: true,
        email: true,
        username: true,
        mobile: true,
        role: true,
        scope: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "USERS",
      entityType: "User",
      entityId: newUser.id,
      afterState: newUser,
      notes: `Created new user ${newUser.name} (${newUser.userCode}) with Supabase Auth integration`,
    });

    return NextResponse.json({
      success: true,
      data: newUser,
      message: "User created successfully",
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json(
      { success: false, error: { code: status === 403 ? "FORBIDDEN" : "ERROR", message: error.message } },
      { status }
    );
  }
}
