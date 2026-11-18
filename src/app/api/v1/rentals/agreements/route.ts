import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createRentalAgreementSchema } from "@/lib/schemas/rental";
import { validationErrorResponse } from "@/lib/api-validation";
import { createRentalAgreementFromOrder } from "@/lib/rentals/agreement-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const customerSiteId = searchParams.get("customerSiteId") || undefined;
    const status = searchParams.get("status") || undefined;

    const agreements = await db.rentalAgreement.findMany({
      where: {
        customerId,
        customerSiteId,
        status: status === "ALL" ? undefined : status,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, primaryMobile: true, whatsappNumber: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true, fullAddress: true, siteInCharge: true, siteContactDetails: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, materialCode: true, size: true, uom: true } },
          },
        },
        _count: {
          select: { deposits: true, statements: true, deliveryNotes: true, rentalBatches: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: agreements });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "rentals", "create");

    const body = await req.json();
    const parsed = createRentalAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
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

    const result = await createRentalAgreementFromOrder(
      {
        customerId: input.customerId,
        customerSiteId: input.customerSiteId,
        startDate: input.startDate,
        endDate: input.endDate,
        billingFrequency: input.billingFrequency,
        billingCycleDay: input.billingCycleDay,
        depositAmount: input.depositAmount,
        depositStatus: input.depositStatus,
        paymentTerms: input.paymentTerms || undefined,
        specialTerms: input.specialTerms || undefined,
        notes: input.notes || undefined,
        orderReference: (input as any).orderReference || null,
        autoSendWhatsApp: (input as any).autoSendWhatsApp ?? true,
        items: input.items.map((it) => ({
          materialVariantId: it.materialVariantId,
          agreedDailyRate: it.agreedDailyRate,
          quantity: (it as any).quantity ? Number((it as any).quantity) : 0,
          securityDepositRate: it.securityDepositRate,
          remarks: it.remarks,
        })),
      },
      actor,
      origin
    );

    return NextResponse.json(
      {
        success: true,
        data: result.agreement,
        whatsApp: result.whatsApp,
        message: result.message,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

