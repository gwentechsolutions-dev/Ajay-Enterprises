import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { z } from "zod";

const languageSchema = z.object({
  language: z.enum(["en", "ta", "hi"], {
    errorMap: () => ({ message: "Supported languages are English (en), Tamil (ta), and Hindi (hi)" }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_portal", "view");

    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: { message: "Authenticated user session required" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = languageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message || "Invalid language" } },
        { status: 400 }
      );
    }

    const { language } = parsed.data;

    // Persist to database against driver user record
    await db.user.update({
      where: { id: session.id },
      data: { preferredLanguage: language },
    });

    return NextResponse.json({
      success: true,
      data: { language },
      message: `Preferred language updated to ${language}`,
    });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
