import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getSystemEwbConfig } from "@/lib/ewaybill/config";
import { ewbSettingsSchema } from "@/lib/schemas/ewaybill";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company_profile", "read");

    const config = getSystemEwbConfig();

    // Aggregate statistics
    const [wbCount, fynCount, activeCount, cancelledCount] = await Promise.all([
      db.eWayBill.count({ where: { provider: "WHITEBOOKS" } }),
      db.eWayBill.count({ where: { provider: "FYN" } }),
      db.eWayBill.count({ where: { status: "ACTIVE" } }),
      db.eWayBill.count({ where: { status: "CANCELLED" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeProvider: config.activeProvider,
        environment: config.whitebooks.environment,
        whitebooks: {
          configured: !!(config.whitebooks.clientId && config.whitebooks.email),
          environment: config.whitebooks.environment,
          gstin: config.whitebooks.gstin,
          username: config.whitebooks.username,
          baseUrl: config.whitebooks.baseUrl,
        },
        fyn: {
          configured: !!config.fyn.apiKey,
          isSandbox: config.fyn.isSandbox,
          baseUrl: config.fyn.baseUrl,
        },
        stats: {
          whitebooksGenerated: wbCount,
          fynGenerated: fynCount,
          activeTotal: activeCount,
          cancelledTotal: cancelledCount,
        },
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company_profile", "update");

    const body = await req.json();
    const parsed = ewbSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    if (parsed.data.environment === "PRODUCTION") {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Production environment is currently locked during Phase 6 sandbox testing.",
          },
        },
        { status: 403 }
      );
    }

    // Persist provider preference in process environment / metadata
    process.env.EWAYBILL_ACTIVE_PROVIDER = parsed.data.activeProvider;

    return NextResponse.json({
      success: true,
      data: {
        activeProvider: parsed.data.activeProvider,
        environment: "SANDBOX",
        message: `Active statutory E-Way Bill provider updated to ${parsed.data.activeProvider} (Sandbox).`,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
