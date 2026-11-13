import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

interface InitialCatalogueItem {
  categoryName: string;
  categoryCode: string;
  typeName: string;
  typeCode: string;
  variantCode: string;
  variantName: string;
  size: string;
  rate: number;
  isDuplicateFlag?: boolean;
  notes?: string;
}

const INITIAL_CATALOGUE: InitialCatalogueItem[] = [
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Props",
    typeCode: "TYP-PROPS",
    variantCode: "MAT-PROP-7-12-NEW",
    variantName: "NEW PROPS",
    size: "7–12 ft",
    rate: 2.0,
    notes: "New condition props",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Props",
    typeCode: "TYP-PROPS",
    variantCode: "MAT-PROP-10-15-A",
    variantName: "PROPS",
    size: "10–15 ft",
    rate: 0.0,
    notes: "Rate requires confirmation before rental billing",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Props",
    typeCode: "TYP-PROPS",
    variantCode: "MAT-PROP-10-18",
    variantName: "PROPS",
    size: "10–18 ft",
    rate: 0.0,
    notes: "Rate requires confirmation before rental billing",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Props",
    typeCode: "TYP-PROPS",
    variantCode: "MAT-PROP-10-15-DUP",
    variantName: "PROPS (Duplicate Source Entry)",
    size: "10–15 ft",
    rate: 0.0,
    isDuplicateFlag: true,
    notes: "Flagged: duplicate source catalogue record preserved for review. Rate unconfirmed.",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Props",
    typeCode: "TYP-PROPS",
    variantCode: "MAT-PROP-7-12-STD",
    variantName: "PROPS",
    size: "7–12 ft",
    rate: 1.84,
    notes: "Standard centering props",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Sapan / Runners",
    typeCode: "TYP-SAPAN",
    variantCode: "MAT-SPAN-8-14",
    variantName: "SAPAN",
    size: "8–14 ft",
    rate: 2.5,
    notes: "Centering spans",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Sheets",
    typeCode: "TYP-SHEETS",
    variantCode: "MAT-SHT-S-HALF",
    variantName: "S HALF SHEET",
    size: "2 × 1.5 ft",
    rate: 0.6,
    notes: "Small half steel plate sheet",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Sheets",
    typeCode: "TYP-SHEETS",
    variantCode: "MAT-SHT-HALF",
    variantName: "HALF SHEET",
    size: "3 × 1.5 ft",
    rate: 0.7,
    notes: "Half steel plate sheet",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Folding Sheets",
    typeCode: "TYP-FOLDING",
    variantCode: "MAT-SHT-BIG-FOLD",
    variantName: "BIG FOLDING SHEET",
    size: "3.9 × 2 ft",
    rate: 1.0,
    notes: "Large folding formwork sheet",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Folding Sheets",
    typeCode: "TYP-FOLDING",
    variantCode: "MAT-SHT-FOLD",
    variantName: "FOLDING SHEET",
    size: "3 × 2 ft",
    rate: 0.9,
    notes: "Standard folding formwork sheet",
  },
  {
    categoryName: "Centering Materials",
    categoryCode: "CAT-CENTERING",
    typeName: "Angle Sheets",
    typeCode: "TYP-ANGLE",
    variantCode: "MAT-SHT-ANGLE",
    variantName: "ANGLE SHEET",
    size: "3 × 2 ft",
    rate: 0.9,
    notes: "Angle sheet for beam/column edges",
  },
];

export async function POST() {
  try {
    const session = await getSession();
    await requirePermission(session, "inventory", "create");

    let createdCount = 0;
    let existingCount = 0;

    for (const item of INITIAL_CATALOGUE) {
      // 1. Ensure category
      const category = await db.materialCategory.upsert({
        where: { categoryCode: item.categoryCode },
        update: {},
        create: {
          categoryCode: item.categoryCode,
          name: item.categoryName,
          description: "AJAY ENTERPRISES Primary Material Category",
          isActive: true,
        },
      });

      // 2. Ensure type
      const materialType = await db.materialType.upsert({
        where: { typeCode: item.typeCode },
        update: {},
        create: {
          categoryId: category.id,
          typeCode: item.typeCode,
          name: item.typeName,
          description: `Centering Type: ${item.typeName}`,
          isActive: true,
        },
      });

      // 3. Check if variant already exists
      const existing = await db.materialVariant.findUnique({
        where: { materialCode: item.variantCode },
      });

      if (!existing) {
        const rate = new Prisma.Decimal(item.rate);
        const variant = await db.materialVariant.create({
          data: {
            materialCode: item.variantCode,
            materialTypeId: materialType.id,
            name: item.variantName,
            size: item.size,
            uom: "Nos.",
            defaultRentalRate: rate,
            description: item.notes || null,
            minimumStock: new Prisma.Decimal(0),
            ownershipClassification: "OWNED",
            isActive: true,
          },
        });

        // Create initial rate history
        await db.materialRateHistory.create({
          data: {
            materialVariantId: variant.id,
            rentalRate: rate,
            previousRate: null,
            effectiveFrom: new Date(),
            reason: item.isDuplicateFlag
              ? "Initial source catalogue definition (Flagged for duplicate verification)"
              : item.rate === 0
              ? "Initial source catalogue definition (Rate requires confirmation)"
              : "Initial source catalogue rental rate",
            changedById: session?.id || null,
          },
        });

        createdCount++;
      } else {
        existingCount++;
      }
    }

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "INVENTORY",
      entityType: "MaterialVariant",
      notes: `Seeded initial material catalogue. Created: ${createdCount}, Existing: ${existingCount}`,
    });

    return NextResponse.json({
      success: true,
      message: `Initial material catalogue synchronized. ${createdCount} created, ${existingCount} already present.`,
      data: { createdCount, existingCount },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

