import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");
    const { id } = await params;

    const agreement = await db.rentalAgreement.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
        deposits: true,
        statements: {
          select: {
            id: true,
            statementNumber: true,
            periodStartDate: true,
            periodEndDate: true,
            netPayableAmount: true,
            status: true,
          },
          orderBy: { periodStartDate: "desc" },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json({ success: false, error: { message: "Rental Agreement not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: agreement });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

