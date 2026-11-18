import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { SAMPLE_MATERIAL_TEMPLATE_ROWS } from "./bulk-import-constants";

export { SAMPLE_MATERIAL_TEMPLATE_ROWS };

export interface RawImportMaterialRow {
  rowNumber?: number;
  materialCode?: string | null;
  name?: string | null;
  category?: string | null;
  materialType?: string | null;
  size?: string | null;
  uom?: string | null;
  defaultRentalRate?: number | string | null;
  ownershipClassification?: string | null;
  status?: string | null;
  description?: string | null;
}

export interface ValidatedImportRow {
  rowNumber: number;
  materialCode: string | null;
  name: string;
  category: string;
  materialType: string;
  size: string;
  uom: string;
  defaultRentalRate: number;
  ownershipClassification: "OWNED" | "HIRED_IN";
  status: "ACTIVE" | "INACTIVE";
  description: string | null;
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isDuplicateCode: boolean;
  isDuplicateVariant: boolean;
  isExistingVariantInDb: boolean;
  isExistingCodeInDb: boolean;
  categoryStatus: "EXISTS" | "NEW";
  typeStatus: "EXISTS" | "NEW";
  matchedCategoryId?: string;
  matchedTypeId?: string;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newCategories: string[];
  newTypes: Array<{ category: string; type: string }>;
  existingCategoriesCount: number;
  existingTypesCount: number;
  rows: ValidatedImportRow[];
}

/**
 * Validates and enriches raw imported material rows against database state.
 */
export async function validateBulkMaterialRows(
  rawRows: RawImportMaterialRow[],
  tx?: Prisma.TransactionClient
): Promise<ValidationSummary> {
  const runner = tx || db;

  // 1. Fetch existing categories, types, and variants from database for cross-referencing
  const [existingCategories, existingTypes, existingVariants] = await Promise.all([
    runner.materialCategory.findMany({
      select: { id: true, categoryCode: true, name: true, isActive: true },
    }),
    runner.materialType.findMany({
      select: { id: true, typeCode: true, name: true, categoryId: true, isActive: true },
    }),
    runner.materialVariant.findMany({
      select: { id: true, materialCode: true, name: true, size: true, materialTypeId: true },
    }),
  ]);

  // Fast lookup maps (normalized lowercase)
  const categoryByName = new Map<string, (typeof existingCategories)[0]>();
  for (const c of existingCategories) {
    categoryByName.set(c.name.trim().toLowerCase(), c);
  }

  const typeByNameAndCategory = new Map<string, (typeof existingTypes)[0]>();
  for (const t of existingTypes) {
    typeByNameAndCategory.set(`${t.categoryId}:${t.name.trim().toLowerCase()}`, t);
  }

  const existingCodesSet = new Set<string>();
  const existingVariantSignatures = new Set<string>();
  for (const v of existingVariants) {
    existingCodesSet.add(v.materialCode.trim().toUpperCase());
    existingVariantSignatures.add(`${v.name.trim().toLowerCase()}:::${v.size.trim().toLowerCase()}`);
  }

  // Track occurrences within the batch to detect internal file duplicates
  const batchCodeCounts = new Map<string, number>();
  const batchSignatureCounts = new Map<string, number>();

  for (const r of rawRows) {
    if (r.materialCode && r.materialCode.trim()) {
      const codeKey = r.materialCode.trim().toUpperCase();
      batchCodeCounts.set(codeKey, (batchCodeCounts.get(codeKey) || 0) + 1);
    }
    const name = (r.name || "").trim().toLowerCase();
    const size = (r.size || "").trim().toLowerCase();
    if (name && size) {
      const sigKey = `${name}:::${size}`;
      batchSignatureCounts.set(sigKey, (batchSignatureCounts.get(sigKey) || 0) + 1);
    }
  }

  const newCategoriesSet = new Set<string>();
  const newTypesMap = new Map<string, { category: string; type: string }>();

  const validatedRows: ValidatedImportRow[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const rowNum = raw.rowNumber ?? idx + 1;
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const rawCode = (raw.materialCode || "").trim();
    const rawName = (raw.name || "").trim();
    const rawCategory = (raw.category || "").trim();
    const rawType = (raw.materialType || "").trim();
    const rawSize = (raw.size || "").trim();
    const rawUom = (raw.uom || "Nos.").trim();
    const rawRate = raw.defaultRentalRate;
    const rawOwnership = (raw.ownershipClassification || "OWNED").trim().toUpperCase();
    const rawStatus = (raw.status || "ACTIVE").trim().toUpperCase();
    const rawDescription = raw.description ? raw.description.trim() : null;

    // --- Required Field Checks ---
    if (!rawName) {
      errors.name = "Material name is required.";
    }

    if (!rawCategory) {
      errors.category = "Category is required.";
    }

    if (!rawType) {
      errors.materialType = "Material type is required.";
    }

    if (!rawSize) {
      errors.size = "Size / Dimensions specification is required.";
    }

    if (!rawUom) {
      errors.uom = "UOM is required.";
    }

    // --- Rate Checks ---
    let numericRate = 0;
    if (rawRate === undefined || rawRate === null || rawRate === "") {
      errors.defaultRentalRate = "Daily rental rate is required.";
    } else {
      numericRate = Number(rawRate);
      if (isNaN(numericRate)) {
        errors.defaultRentalRate = "Daily rental rate must be a valid number.";
      } else if (numericRate < 0) {
        errors.defaultRentalRate = "Daily rental rate cannot be negative.";
      } else if (numericRate === 0) {
        warnings.defaultRentalRate = "Zero rental rate requires confirmation before billing.";
      }
    }

    // --- Ownership Checks ---
    let validOwnership: "OWNED" | "HIRED_IN" = "OWNED";
    if (rawOwnership === "OWNED" || rawOwnership === "COMPANY_OWNED" || rawOwnership === "OWN") {
      validOwnership = "OWNED";
    } else if (
      rawOwnership === "HIRED_IN" ||
      rawOwnership === "HIRED" ||
      rawOwnership === "HIRED IN" ||
      rawOwnership === "THIRD_PARTY"
    ) {
      validOwnership = "HIRED_IN";
    } else {
      errors.ownershipClassification = "Ownership must be either OWNED or HIRED_IN.";
    }

    // --- Status Checks ---
    let validStatus: "ACTIVE" | "INACTIVE" = "ACTIVE";
    if (rawStatus === "ACTIVE" || rawStatus === "ENABLED" || rawStatus === "TRUE" || rawStatus === "1") {
      validStatus = "ACTIVE";
    } else if (rawStatus === "INACTIVE" || rawStatus === "DISABLED" || rawStatus === "FALSE" || rawStatus === "0") {
      validStatus = "INACTIVE";
    } else {
      errors.status = "Status must be either ACTIVE or INACTIVE.";
    }

    // --- Duplicate Code Checks ---
    let isDuplicateCode = false;
    let isExistingCodeInDb = false;
    if (rawCode) {
      const codeUpper = rawCode.toUpperCase();
      if ((batchCodeCounts.get(codeUpper) || 0) > 1) {
        isDuplicateCode = true;
        errors.materialCode = `Duplicate material code '${rawCode}' appears multiple times in file.`;
      }
      if (existingCodesSet.has(codeUpper)) {
        isExistingCodeInDb = true;
        errors.materialCode = `Material code '${rawCode}' already exists in database.`;
      }
    }

    // --- Duplicate Variant Signature Checks ---
    let isDuplicateVariant = false;
    let isExistingVariantInDb = false;
    if (rawName && rawSize) {
      const sigKey = `${rawName.toLowerCase()}:::${rawSize.toLowerCase()}`;
      if ((batchSignatureCounts.get(sigKey) || 0) > 1) {
        isDuplicateVariant = true;
        warnings.duplicateVariant = `Variant '${rawName} (${rawSize})' appears multiple times in file.`;
      }
      if (existingVariantSignatures.has(sigKey)) {
        isExistingVariantInDb = true;
        warnings.existingInDb = `Variant '${rawName} (${rawSize})' already exists in catalogue.`;
      }
    }

    // --- Category Resolution ---
    let categoryStatus: "EXISTS" | "NEW" = "EXISTS";
    let matchedCatId: string | undefined;
    if (rawCategory) {
      const matchedCat = categoryByName.get(rawCategory.toLowerCase());
      if (matchedCat) {
        categoryStatus = "EXISTS";
        matchedCatId = matchedCat.id;
      } else {
        categoryStatus = "NEW";
        newCategoriesSet.add(rawCategory);
      }
    }

    // --- Material Type Resolution ---
    let typeStatus: "EXISTS" | "NEW" = "EXISTS";
    let matchedTypId: string | undefined;
    if (rawType && rawCategory) {
      if (matchedCatId) {
        const matchedTyp = typeByNameAndCategory.get(`${matchedCatId}:${rawType.toLowerCase()}`);
        if (matchedTyp) {
          typeStatus = "EXISTS";
          matchedTypId = matchedTyp.id;
        } else {
          typeStatus = "NEW";
          newTypesMap.set(`${rawCategory.toLowerCase()}:::${rawType.toLowerCase()}`, {
            category: rawCategory,
            type: rawType,
          });
        }
      } else {
        // Category is new, so type is also treated as new
        typeStatus = "NEW";
        newTypesMap.set(`${rawCategory.toLowerCase()}:::${rawType.toLowerCase()}`, {
          category: rawCategory,
          type: rawType,
        });
      }
    }

    const isValid = Object.keys(errors).length === 0;

    validatedRows.push({
      rowNumber: rowNum,
      materialCode: rawCode || null,
      name: rawName,
      category: rawCategory,
      materialType: rawType,
      size: rawSize,
      uom: rawUom,
      defaultRentalRate: numericRate,
      ownershipClassification: validOwnership,
      status: validStatus,
      description: rawDescription,
      isValid,
      errors,
      warnings,
      isDuplicateCode,
      isDuplicateVariant,
      isExistingVariantInDb,
      isExistingCodeInDb,
      categoryStatus,
      typeStatus,
      matchedCategoryId: matchedCatId,
      matchedTypeId: matchedTypId,
    });
  }

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.filter((r) => !r.isValid).length;
  const duplicateCount = validatedRows.filter((r) => r.isDuplicateCode || r.isDuplicateVariant || r.isExistingCodeInDb).length;

  return {
    totalRows: validatedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
    newCategories: Array.from(newCategoriesSet),
    newTypes: Array.from(newTypesMap.values()),
    existingCategoriesCount: categoryByName.size,
    existingTypesCount: typeByNameAndCategory.size,
    rows: validatedRows,
  };
}

/**
 * Generates an automatic category code (e.g. "CAT-SCAFFOLDING" or "CAT-01")
 */
function makeCategoryCode(name: string, index: number): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
  return clean ? `CAT-${clean}` : `CAT-${String(index + 1).padStart(2, "0")}`;
}

/**
 * Generates an automatic type code (e.g. "TYP-PROPS" or "TYP-01")
 */
function makeTypeCode(name: string, index: number): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
  return clean ? `TYP-${clean}` : `TYP-${String(index + 1).padStart(2, "0")}`;
}

export interface BulkImportOptions {
  items: Array<{
    rowNumber?: number;
    materialCode?: string | null;
    name: string;
    category: string;
    materialType: string;
    size: string;
    uom?: string;
    defaultRentalRate: number;
    ownershipClassification?: "OWNED" | "HIRED_IN";
    status?: "ACTIVE" | "INACTIVE";
    description?: string | null;
  }>;
  skipDuplicates?: boolean;
  autoCreateCategoriesAndTypes?: boolean;
  session?: { id?: string; name?: string; role?: string };
  ipAddress?: string;
}

export interface BulkImportResult {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  categoriesCreated: number;
  typesCreated: number;
  createdVariants: Array<{
    id: string;
    materialCode: string;
    name: string;
    size: string;
    rate: number;
  }>;
  errors: Array<{
    rowNumber?: number;
    materialCode?: string | null;
    name?: string;
    reason: string;
  }>;
}

/**
 * Executes atomic bulk import of validated materials within a PostgreSQL transaction.
 */
export async function executeBulkMaterialImport(
  options: BulkImportOptions
): Promise<BulkImportResult> {
  const { items, skipDuplicates = false, session, ipAddress } = options;

  if (!items || items.length === 0) {
    throw new Error("No items provided for import.");
  }

  return await db.$transaction(
    async (tx) => {
      // 1. Fetch current categories & types
      const allCategories = await tx.materialCategory.findMany();
      const allTypes = await tx.materialType.findMany();

      const categoryMap = new Map<string, (typeof allCategories)[0]>();
      for (const c of allCategories) {
        categoryMap.set(c.name.trim().toLowerCase(), c);
      }

      const typeMap = new Map<string, (typeof allTypes)[0]>();
      for (const t of allTypes) {
        typeMap.set(`${t.categoryId}:${t.name.trim().toLowerCase()}`, t);
      }

      let categoriesCreated = 0;
      let typesCreated = 0;

      // Ensure all required categories exist
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const catKey = item.category.trim().toLowerCase();
        if (!categoryMap.has(catKey)) {
          let codeCandidate = makeCategoryCode(item.category, allCategories.length + categoriesCreated);
          // Check collision
          const codeExists = await tx.materialCategory.findUnique({ where: { categoryCode: codeCandidate } });
          if (codeExists) {
            codeCandidate = `CAT-${Date.now().toString().slice(-4)}${categoriesCreated + 1}`;
          }

          const createdCat = await tx.materialCategory.create({
            data: {
              categoryCode: codeCandidate,
              name: item.category.trim(),
              description: `Bulk imported category for ${item.category.trim()}`,
              isActive: true,
            },
          });
          categoryMap.set(catKey, createdCat);
          categoriesCreated++;
        }
      }

      // Ensure all required types exist
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const catKey = item.category.trim().toLowerCase();
        const cat = categoryMap.get(catKey)!;
        const typeKey = `${cat.id}:${item.materialType.trim().toLowerCase()}`;

        if (!typeMap.has(typeKey)) {
          let typeCodeCandidate = makeTypeCode(item.materialType, allTypes.length + typesCreated);
          const typeCodeExists = await tx.materialType.findUnique({ where: { typeCode: typeCodeCandidate } });
          if (typeCodeExists) {
            typeCodeCandidate = `TYP-${Date.now().toString().slice(-4)}${typesCreated + 1}`;
          }

          const createdType = await tx.materialType.create({
            data: {
              categoryId: cat.id,
              typeCode: typeCodeCandidate,
              name: item.materialType.trim(),
              description: `Bulk imported material type for ${item.materialType.trim()}`,
              isActive: true,
            },
          });
          typeMap.set(typeKey, createdType);
          typesCreated++;
        }
      }

      // Fetch existing material codes in DB for conflict check
      const existingVariants = await tx.materialVariant.findMany({
        select: { materialCode: true, name: true, size: true },
      });
      const existingDbCodes = new Set<string>(existingVariants.map((v) => v.materialCode.toUpperCase()));
      const existingDbSignatures = new Set<string>(
        existingVariants.map((v) => `${v.name.trim().toLowerCase()}:::${v.size.trim().toLowerCase()}`)
      );

      const createdVariants: BulkImportResult["createdVariants"] = [];
      const importErrors: BulkImportResult["errors"] = [];
      let importedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNumber = item.rowNumber ?? i + 1;

        const catKey = item.category.trim().toLowerCase();
        const cat = categoryMap.get(catKey);
        if (!cat) {
          importErrors.push({ rowNumber, name: item.name, reason: `Category '${item.category}' could not be resolved.` });
          continue;
        }

        const typeKey = `${cat.id}:${item.materialType.trim().toLowerCase()}`;
        const typ = typeMap.get(typeKey);
        if (!typ) {
          importErrors.push({ rowNumber, name: item.name, reason: `Material type '${item.materialType}' could not be resolved.` });
          continue;
        }

        // Check duplicate code if manually provided
        let finalCode = (item.materialCode || "").trim().toUpperCase();
        if (finalCode) {
          if (existingDbCodes.has(finalCode)) {
            if (skipDuplicates) {
              skippedCount++;
              continue;
            } else {
              throw new Error(`Row ${rowNumber}: Material code '${finalCode}' already exists in database.`);
            }
          }
        } else {
          // Concurrency-safe automatic code generation via DocumentSeries inside transaction
          finalCode = await generateNextDocumentNumber("MAT", undefined, tx);
        }

        // Check identical variant duplicate
        const sig = `${item.name.trim().toLowerCase()}:::${item.size.trim().toLowerCase()}`;
        if (existingDbSignatures.has(sig)) {
          if (skipDuplicates) {
            skippedCount++;
            continue;
          }
          // If skipDuplicates is false, similar names with different specs are allowed,
          // but identical name+size is flagged
        }

        const rateDecimal = new Prisma.Decimal(item.defaultRentalRate || 0);

        // Create MaterialVariant
        const variant = await tx.materialVariant.create({
          data: {
            materialCode: finalCode,
            materialTypeId: typ.id,
            name: item.name.trim(),
            size: item.size.trim(),
            uom: (item.uom || "Nos.").trim(),
            defaultRentalRate: rateDecimal,
            purchaseCost: null, // Per instructions: Do not invent purchase costs
            replacementValue: null,
            minimumStock: new Prisma.Decimal(0),
            ownershipClassification: item.ownershipClassification || "OWNED",
            isActive: item.status !== "INACTIVE",
            description: item.description ? item.description.trim() : null,
          },
        });

        // Create initial MaterialRateHistory entry
        await tx.materialRateHistory.create({
          data: {
            materialVariantId: variant.id,
            rentalRate: rateDecimal,
            previousRate: null,
            effectiveFrom: new Date(),
            reason: rateDecimal.isZero()
              ? "Bulk imported material (Rate requires confirmation before billing)"
              : "Bulk material import: initial catalogue definition",
            changedById: session?.id || null,
          },
        });

        existingDbCodes.add(finalCode);
        existingDbSignatures.add(sig);

        createdVariants.push({
          id: variant.id,
          materialCode: finalCode,
          name: variant.name,
          size: variant.size,
          rate: Number(variant.defaultRentalRate),
        });

        importedCount++;
      }

      // Log Audit Event
      await logAuditEvent(
        {
          userId: session?.id,
          userName: session?.name,
          userRole: session?.role,
          ipAddress,
          action: "IMPORT",
          module: "INVENTORY",
          entityType: "MaterialVariant",
          notes: `Bulk imported ${importedCount} material variants (${categoriesCreated} categories, ${typesCreated} types created; ${skippedCount} skipped).`,
        },
        tx
      );

      return {
        success: true,
        totalProcessed: items.length,
        importedCount,
        skippedCount,
        failedCount: importErrors.length,
        categoriesCreated,
        typesCreated,
        createdVariants,
        errors: importErrors,
      };
    },
    {
      timeout: 30000, // 30s timeout for large batch processing
    }
  );
}
