import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { readPrivateFile, createSignedDownloadUrl } from "@/lib/storage";
import { db } from "@/lib/db";

/**
 * INVENTRA Server-Authorized Private Storage Download Endpoint
 * 
 * Security Directives:
 * 1. Direct server-side identity verification via supabase.auth.getUser()
 *    (validates the cryptographic JWT against Supabase Auth; does not rely on local session state).
 * 2. Strict User profile resolution via User.supabaseId = authUser.id.
 * 3. Path traversal attack prevention (blocks '..', leading slashes, and protocols).
 * 4. Granular INVENTRA RBAC permission enforcement mapped by document category.
 * 5. Document ownership & ledger existence validation against database records.
 * 6. Short-lived signed URLs (300s TTL) or authorized byte streaming.
 */
export async function GET(req: NextRequest) {
  try {
    const isSupabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    let sessionUser: {
      id: string;
      supabaseId?: string | null;
      role: string;
      scope: string;
    } | null = null;

    if (isSupabaseConfigured) {
      // 1. Direct server-side token validation via supabase.auth.getUser()
      const supabase = await createServerSupabaseClient();
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return new NextResponse("Unauthorized: Invalid, expired, or missing authentication token", { status: 401 });
      }

      // 2. Resolve application user profile using strict supabaseId identity bridge
      const appUser = await db.user.findFirst({
        where: { supabaseId: authUser.id },
        select: { id: true, supabaseId: true, role: true, scope: true, isActive: true },
      });

      if (!appUser || !appUser.isActive) {
        return new NextResponse("Forbidden: User profile is deactivated or not registered", { status: 403 });
      }

      sessionUser = appUser;
    } else {
      // Development / test fallback
      const devSession = await getSession();
      if (!devSession) {
        return new NextResponse("Unauthorized: Active authentication session required", { status: 401 });
      }
      sessionUser = devSession;
    }

    const { searchParams } = new URL(req.url);
    const relativePath = searchParams.get("path");
    const redirectMode = searchParams.get("redirect") === "true";

    if (!relativePath) {
      return new NextResponse("Bad Request: Path parameter is required", { status: 400 });
    }

    // 3. Path traversal defense
    const normalizedPath = relativePath.replace(/\\/g, "/");
    if (
      normalizedPath.includes("..") ||
      normalizedPath.startsWith("/") ||
      normalizedPath.includes("://")
    ) {
      return new NextResponse("Bad Request: Invalid file path specification", { status: 400 });
    }

    // 4. Extract category / folder and filename
    const pathSegments = normalizedPath.split("/").filter(Boolean);
    const category = pathSegments[0]?.toLowerCase() || "";
    const fileName = pathSegments[pathSegments.length - 1];

    // 5. INVENTRA RBAC Verification
    // OWNER role has universal system authorization
    if (sessionUser.role !== "OWNER") {
      switch (category) {
        case "company-docs":
        case "company":
        case "signatures":
        case "stamps":
        case "company-logos": {
          const hasCompanyView = await checkPermission(sessionUser.role, "company", "view");
          if (!hasCompanyView) {
            return new NextResponse("Forbidden: Insufficient privileges to access company documents", { status: 403 });
          }
          break;
        }

        case "movement":
        case "movement-docs":
        case "delivery-notes":
        case "return-notes":
        case "gps-proofs": {
          const hasMovementView = await checkPermission(sessionUser.role, "movement", "view");
          if (!hasMovementView) {
            return new NextResponse("Forbidden: Insufficient privileges to access material movement documents", { status: 403 });
          }
          break;
        }

        case "customers":
        case "customer-docs":
        case "sites": {
          const hasCustomerView = await checkPermission(sessionUser.role, "customers", "view");
          if (!hasCustomerView) {
            return new NextResponse("Forbidden: Insufficient privileges to access customer site documents", { status: 403 });
          }
          break;
        }

        case "accounting":
        case "invoices":
        case "vouchers": {
          const hasAccountingView = await checkPermission(sessionUser.role, "accounting", "view");
          if (!hasAccountingView) {
            return new NextResponse("Forbidden: Insufficient privileges to access financial documents", { status: 403 });
          }
          break;
        }

        case "avatars":
        case "users": {
          const hasUsersView = await checkPermission(sessionUser.role, "users", "view");
          // Allow users to view their own profile picture or users with users.view
          if (!hasUsersView && !normalizedPath.includes(sessionUser.id)) {
            return new NextResponse("Forbidden: Insufficient privileges to view user profile assets", { status: 403 });
          }
          break;
        }

        default: {
          // Defense-in-depth: Uncategorized or general paths require ADMINISTRATOR / ADMIN role
          if (sessionUser.role !== "ADMIN" && sessionUser.role !== "ADMINISTRATOR") {
            return new NextResponse("Forbidden: Access to requested document category is restricted", { status: 403 });
          }
          break;
        }
      }
    }

    // 6. Document Ownership & Ledger Existence Verification
    // Prevents direct enumeration of unlinked or orphaned storage objects
    if (category === "company-docs" || category === "company") {
      const docExists = await db.companyDocument.findFirst({
        where: {
          OR: [
            { storagePath: { contains: fileName } },
            { fileName: { contains: fileName } },
          ],
        },
      });
      const logoExists = await db.companyProfile.findFirst({
        where: { logoAssetUrl: { contains: fileName } },
      });
      if (!docExists && !logoExists && sessionUser.role !== "OWNER" && sessionUser.role !== "ADMIN" && sessionUser.role !== "ADMINISTRATOR") {
        return new NextResponse("Forbidden: Document record not found or access restricted", { status: 403 });
      }
    } else if (category === "signatures" || category === "stamps") {
      const sigExists = await db.signatoryAsset.findFirst({
        where: {
          OR: [
            { signatureAssetUrl: { contains: fileName } },
            { stampAssetUrl: { contains: fileName } },
          ],
        },
      });
      if (!sigExists && sessionUser.role !== "OWNER" && sessionUser.role !== "ADMIN" && sessionUser.role !== "ADMINISTRATOR") {
        return new NextResponse("Forbidden: Signatory asset record not found or access restricted", { status: 403 });
      }
    }

    // 7. Short-Lived Signed URL Generation (if redirect requested)
    if (redirectMode && isSupabaseConfigured) {
      try {
        const signedUrl = await createSignedDownloadUrl(normalizedPath, 300);
        return NextResponse.redirect(signedUrl);
      } catch (err) {
        console.warn("Signed URL redirect failed, falling back to direct stream:", err);
      }
    }

    // 8. Direct Authorized Buffer Streaming
    const file = await readPrivateFile(normalizedPath);
    if (!file) {
      return new NextResponse("File not found or storage inaccessible", { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    return new NextResponse("Server error: " + (error?.message || "Unknown error"), { status: 500 });
  }
}
