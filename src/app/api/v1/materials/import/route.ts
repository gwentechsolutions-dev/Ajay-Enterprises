import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { bulkMaterialImportSchema } from "@/lib/schemas/material";
import { executeBulkMaterialImport } from "@/lib/materials/bulk-import-service";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "create");

    const body = await req.json();
    const parsed = bulkMaterialImportSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { items, skipDuplicates, autoCreateCategoriesAndTypes } = parsed.data;

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;

    const result = await executeBulkMaterialImport({
      items,
      skipDuplicates,
      autoCreateCategoriesAndTypes,
      session: {
        id: session?.id,
        name: session?.name,
        role: session?.role,
      },
      ipAddress,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Successfully imported ${result.importedCount} material variants (${result.categoriesCreated} new categories, ${result.typesCreated} new types created; ${result.skippedCount} skipped).`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED")
      ? 401
      : error.message?.startsWith("FORBIDDEN")
      ? 403
      : error.message?.includes("already exists in database")
      ? 409
      : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
