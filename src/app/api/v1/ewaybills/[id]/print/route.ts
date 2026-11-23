import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  buildEWayBillPrintData,
  generateEWayBillHTML,
} from "@/lib/pdf/ewaybill-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (session) {
      await requirePermission(session, "delivery_notes", "view");
    }

    const { id } = await params;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "ajay-enterprises-gwen-tech.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    const ewb = await db.eWayBill.findFirst({
      where: isUuid ? { OR: [{ id }, { ewbNumber: id }] } : { ewbNumber: id },
      include: {
        deliveryNote: {
          include: {
            customer: true,
            customerSite: true,
            sourceWarehouse: true,
            items: {
              include: {
                materialVariant: true,
              },
            },
          },
        },
        transferNote: {
          include: {
            sourceWarehouse: true,
            destinationWarehouse: true,
            items: {
              include: {
                materialVariant: true,
              },
            },
          },
        },
        operations: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!ewb) {
      return new NextResponse(
        `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>E-Way Bill Not Found</h2>
          <p>The requested statutory E-Way Bill <code>${id}</code> could not be found in the database.</p>
          <button onclick="window.close()" style="padding: 8px 16px; cursor: pointer;">Close</button>
        </body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const company = await db.companyProfile.findFirst({
      include: {
        addresses: { where: { isDefaultBilling: true } },
      },
    });

    const printData = await buildEWayBillPrintData(ewb, company);
    const html = generateEWayBillHTML(printData, origin);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "all, index, follow, max-image-preview:large",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return new Response(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Access Error (${status})</h2>
        <p>${error.message}</p>
        <button onclick="window.close()" style="padding: 8px 16px; cursor: pointer;">Close</button>
      </body></html>`,
      {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
