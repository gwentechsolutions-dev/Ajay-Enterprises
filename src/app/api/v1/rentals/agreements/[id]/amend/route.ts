import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createRentalAgreementAmendment } from "@/lib/rentals/agreement-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "create");

    const { id } = await params;
    const body = await req.json();

    if (!body.amendmentReason || body.amendmentReason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Amendment reason is required." } },
        { status: 400 }
      );
    }
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "At least one material variant rate item is required." } },
        { status: 400 }
      );
    }

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const amended = await createRentalAgreementAmendment(
      id,
      {
        amendmentReason: body.amendmentReason.trim(),
        startDate: body.startDate,
        endDate: body.endDate,
        paymentTerms: body.paymentTerms,
        specialTerms: body.specialTerms,
        depositAmount: body.depositAmount !== undefined ? Number(body.depositAmount) : undefined,
        items: body.items.map((it: any) => ({
          materialVariantId: it.materialVariantId,
          agreedDailyRate: Number(it.agreedDailyRate) || 0,
          quantity: it.quantity ? Number(it.quantity) : 0,
          remarks: it.remarks || null,
        })),
      },
      actor,
      origin
    );

    return NextResponse.json(
      {
        success: true,
        data: amended,
        message: `Agreement Amendment ${amended.agreementNumber} created successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
