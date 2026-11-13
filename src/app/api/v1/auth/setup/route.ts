import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setupOwnerSchema } from "@/lib/schemas/auth";
import { initializeDefaultPermissions } from "@/lib/permissions";
import { DOCUMENT_TYPES, getCurrentFiscalYear } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const userCount = await db.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SETUP_ALREADY_COMPLETED",
            message: "First-run setup has already been completed. Contact the system administrator.",
          },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = setupOwnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Setup form validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const { name, email, username, mobile, password } = parsed.data;
    const fiscalYear = getCurrentFiscalYear();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    let supabaseId: string | null = null;

    if (isSupabaseConfigured) {
      const supabaseAdmin = createAdminClient();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: "OWNER",
          userCode: "USR-0001",
        },
      });

      if (authError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "AUTH_PROVIDER_ERROR", message: authError.message },
          },
          { status: 400 }
        );
      }
      supabaseId = authData.user.id;
    }

    // Perform atomic bootstrapping in Prisma
    const newOwner = await db.$transaction(async (tx) => {
      // 1. Create Owner User linked to Supabase Auth
      const owner = await tx.user.create({
        data: {
          supabaseId,
          userCode: "USR-0001",
          name,
          email: email.toLowerCase().trim(),
          username: username ? username.trim() : null,
          mobile: mobile.trim(),
          role: "OWNER",
          scope: "ALL_BUSINESS",
          isActive: true,
          lastLogin: new Date(),
        },
      });

      // 2. Initialize Company Profile for AJAY ENTERPRISES
      let company = await tx.companyProfile.findFirst();
      if (!company) {
        company = await tx.companyProfile.create({
          data: {
            legalName: "AJAY ENTERPRISES",
            tradeName: "AJAY ENTERPRISES",
            entityType: "PROPRIETORSHIP",
            businessCategory: "Construction Centering Material Rental & Formwork Equipment",
            primaryMobile: mobile.trim(),
            whatsappNumber: mobile.trim(),
            officialEmail: email.toLowerCase().trim(),
            contactPerson: name,
            isOnboardingComplete: false,
          },
        });
      }

      // 3. Initialize Current Financial Year
      const [startYr, endYrShort] = fiscalYear.split("-");
      const fullEndYr = `20${endYrShort}`;
      const startDate = new Date(`${startYr}-04-01T00:00:00Z`);
      const endDate = new Date(`${fullEndYr}-03-31T23:59:59Z`);

      await tx.financialYear.upsert({
        where: { yearCode: fiscalYear },
        update: { isCurrent: true },
        create: {
          yearCode: fiscalYear,
          startDate,
          endDate,
          isCurrent: true,
          isClosed: false,
        },
      });

      // 4. Initialize Baseline Document Series
      for (const doc of DOCUMENT_TYPES) {
        await tx.documentSeries.upsert({
          where: {
            documentType_fiscalYear: {
              documentType: doc.id,
              fiscalYear,
            },
          },
          update: {},
          create: {
            documentType: doc.id,
            prefix: `${doc.defaultPrefix}${fiscalYear}/`,
            fiscalYear,
            currentCounter: 0,
            padding: 4,
            suffix: "",
            isActive: true,
          },
        });
      }

      return owner;
    });

    // Initialize role permissions matrix
    await initializeDefaultPermissions();

    // Sign in user via Supabase Auth SSR to establish session cookies if configured
    if (isSupabaseConfigured) {
      try {
        const supabase = await createServerSupabaseClient();
        await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
      } catch (err) {
        console.warn("Supabase SSR cookie setup warning:", err);
      }
    }

    const sessionUser = {
      id: newOwner.id,
      supabaseId: newOwner.supabaseId,
      userCode: newOwner.userCode,
      name: newOwner.name,
      email: newOwner.email,
      role: newOwner.role,
      scope: newOwner.scope,
    };

    await logAuditEvent({
      userId: newOwner.id,
      userName: newOwner.name,
      userRole: newOwner.role,
      action: "CREATE",
      module: "AUTH",
      entityType: "User",
      entityId: newOwner.id,
      notes: "First-run setup: Initial Owner account created for AJAY ENTERPRISES with Supabase Auth",
    });

    return NextResponse.json({
      success: true,
      data: { user: sessionUser },
      message: "Owner account and foundation initialized successfully",
    });
  } catch (error: any) {
    console.error("Setup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SETUP_FAILED", message: error.message || "Failed to complete setup" },
      },
      { status: 500 }
    );
  }
}
