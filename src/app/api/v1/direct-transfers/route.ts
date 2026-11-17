import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createDirectTransferSchema } from "@/lib/schemas/direct-transfer";
import { validationErrorResponse } from "@/lib/api-validation";
import {
  createDirectTransfer,
  getDirectTransferList,
  DirectTransferError,
} from "@/lib/direct-transfers/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "direct_transfers", "view");

    const { searchParams } = new URL(req.url);
    const sourceCustomerId = searchParams.get("sourceCustomerId") || undefined;
    const destinationCustomerId = searchParams.get("destinationCustomerId") || undefined;
    const sourceCustomerSiteId = searchParams.get("sourceCustomerSiteId") || undefined;
    const destinationCustomerSiteId = searchParams.get("destinationCustomerSiteId") || undefined;
    const status = searchParams.get("status") || undefined;

    const transfers = await getDirectTransferList({
      sourceCustomerId,
      destinationCustomerId,
      sourceCustomerSiteId,
      destinationCustomerSiteId,
      status,
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "direct_transfers", "create");

    const body = await req.json();
    const parsed = createDirectTransferSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const transfer = await createDirectTransfer(parsed.data, actor);

    return NextResponse.json({ success: true, data: transfer }, { status: 201 });
  } catch (error: any) {
    const status =
      error.statusCode ||
      (error instanceof DirectTransferError ? (error.statusCode || 400) : 400);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || "DIRECT_TRANSFER_ERROR",
          message: error.message,
        },
      },
      { status }
    );
  }
}
