import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const permissions = await db.rolePermission.findMany({
    where: { role: session.role, isAllowed: true },
    select: { module: true, action: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      user: session,
      permissions,
    },
  });
}

