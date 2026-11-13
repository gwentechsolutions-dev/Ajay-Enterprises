import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "billing", "view");
    const { id } = await params;

    const statement = await db.rentalStatement.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        rentalAgreement: true,
        siteSummaries: {
          include: {
            customerSite: { select: { id: true, siteName: true, siteCode: true, fullAddress: true } },
          },
        },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, materialCode: true, uom: true, size: true } },
            customerSite: { select: { id: true, siteName: true, siteCode: true } },
            rentalBatch: { select: { id: true, batchNumber: true, deliveryDate: true } },
            dayDetails: {
              orderBy: { calculationDate: "asc" },
            },
          },
          orderBy: [{ customerSiteId: "asc" }, { materialVariantId: "asc" }],
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ success: false, error: { message: "Rental Statement not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: statement });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

