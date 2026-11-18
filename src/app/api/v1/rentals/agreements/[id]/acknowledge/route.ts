import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { acknowledgeRentalAgreement } from "@/lib/rentals/agreement-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: "Security token is required to view this agreement." } },
        { status: 400 }
      );
    }

    const agreement = await db.rentalAgreement.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            customerCode: true,
            billingAddress: true,
            gstin: true,
            pan: true,
            primaryMobile: true,
            whatsappNumber: true,
          },
        },
        customerSite: {
          select: {
            id: true,
            siteName: true,
            siteCode: true,
            fullAddress: true,
            siteInCharge: true,
            siteContactDetails: true,
          },
        },
        items: {
          include: {
            materialVariant: {
              select: {
                id: true,
                name: true,
                materialCode: true,
                size: true,
                uom: true,
              },
            },
          },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json({ success: false, error: { message: "Rental Agreement not found." } }, { status: 404 });
    }

    if (agreement.acknowledgementToken !== token) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid or unauthorized acknowledgement token." } },
        { status: 403 }
      );
    }

    const isExpired = agreement.tokenExpiresAt ? new Date() > agreement.tokenExpiresAt : false;

    return NextResponse.json({
      success: true,
      data: {
        ...agreement,
        isExpired,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { token, action, signerName, signerPhone, signerDesignation, rejectionReason } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Token is required." } }, { status: 400 });
    }
    if (!action || (action !== "ACCEPT" && action !== "REJECT")) {
      return NextResponse.json({ success: false, error: { message: "Action must be ACCEPT or REJECT." } }, { status: 400 });
    }
    if (!signerName || signerName.trim().length === 0) {
      return NextResponse.json({ success: false, error: { message: "Signer name is required." } }, { status: 400 });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = await acknowledgeRentalAgreement(id, token, action, {
      signerName: signerName.trim(),
      signerPhone: signerPhone?.trim(),
      signerDesignation: signerDesignation?.trim(),
      rejectionReason: rejectionReason?.trim(),
      ipAddress,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}
