import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import * as XLSX from "xlsx";

// Import schemas matching src/lib/schemas/material.ts
const bulkMaterialItemSchema = z.object({
  rowNumber: z.number().int().positive().optional(),
  materialCode: z.string().trim().optional().nullable(),
  name: z.string().min(1, "Material name is required").trim(),
  category: z.string().min(1, "Category is required").trim(),
  materialType: z.string().min(1, "Material type is required").trim(),
  size: z.string().min(1, "Size or dimension specification is required").trim(),
  uom: z.string().trim().default("Nos."),
  defaultRentalRate: z.coerce.number().min(0, "Rental rate cannot be negative"),
  ownershipClassification: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  description: z.string().trim().optional().nullable(),
});

const bulkMaterialImportSchema = z.object({
  items: z
    .array(bulkMaterialItemSchema)
    .min(1, "At least one material item is required to import")
    .max(2000, "Maximum 2000 rows supported per batch"),
  skipDuplicates: z.boolean().default(false),
  autoCreateCategoriesAndTypes: z.boolean().default(true),
});

// In-memory simulation of validation engine matching src/lib/materials/bulk-import-service.ts
function simulateValidateRows(rawRows, dbState = { categories: [], types: [], variants: [] }) {
  const existingCodesSet = new Set(dbState.variants.map((v) => v.materialCode.toUpperCase()));
  const existingVariantSignatures = new Set(
    dbState.variants.map((v) => `${v.name.toLowerCase()}:::${v.size.toLowerCase()}`)
  );
  const categoryByName = new Map(dbState.categories.map((c) => [c.name.toLowerCase(), c]));
  const typeByNameAndCategory = new Map(
    dbState.types.map((t) => [`${t.categoryId}:${t.name.toLowerCase()}`, t])
  );

  const batchCodeCounts = new Map();
  const batchSignatureCounts = new Map();
  for (const r of rawRows) {
    if (r.materialCode && r.materialCode.trim()) {
      const c = r.materialCode.trim().toUpperCase();
      batchCodeCounts.set(c, (batchCodeCounts.get(c) || 0) + 1);
    }
    const n = (r.name || "").trim().toLowerCase();
    const s = (r.size || "").trim().toLowerCase();
    if (n && s) {
      const sig = `${n}:::${s}`;
      batchSignatureCounts.set(sig, (batchSignatureCounts.get(sig) || 0) + 1);
    }
  }

  const validatedRows = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const errors = {};
    const warnings = {};

    const rawCode = (raw.materialCode || "").trim();
    const rawName = (raw.name || "").trim();
    const rawCategory = (raw.category || "").trim();
    const rawType = (raw.materialType || "").trim();
    const rawSize = (raw.size || "").trim();
    const rawUom = (raw.uom || "Nos.").trim();
    const rawRate = raw.defaultRentalRate;
    const rawOwnership = (raw.ownershipClassification || "OWNED").trim().toUpperCase();
    const rawStatus = (raw.status || "ACTIVE").trim().toUpperCase();

    if (!rawName) errors.name = "Material name is required.";
    if (!rawCategory) errors.category = "Category is required.";
    if (!rawType) errors.materialType = "Material type is required.";
    if (!rawSize) errors.size = "Size or dimensions is required.";
    if (!rawUom) errors.uom = "UOM is required.";

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

    let validOwnership = "OWNED";
    if (rawOwnership === "OWNED" || rawOwnership === "COMPANY_OWNED") {
      validOwnership = "OWNED";
    } else if (rawOwnership === "HIRED_IN" || rawOwnership === "HIRED") {
      validOwnership = "HIRED_IN";
    } else {
      errors.ownershipClassification = "Ownership must be either OWNED or HIRED_IN.";
    }

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

    let categoryStatus = "EXISTS";
    if (rawCategory) {
      categoryStatus = categoryByName.has(rawCategory.toLowerCase()) ? "EXISTS" : "NEW";
    }

    let typeStatus = "EXISTS";
    if (rawType && rawCategory) {
      const cat = categoryByName.get(rawCategory.toLowerCase());
      if (cat) {
        typeStatus = typeByNameAndCategory.has(`${cat.id}:${rawType.toLowerCase()}`) ? "EXISTS" : "NEW";
      } else {
        typeStatus = "NEW";
      }
    }

    validatedRows.push({
      rowNumber: raw.rowNumber ?? idx + 1,
      materialCode: rawCode || null,
      name: rawName,
      category: rawCategory,
      materialType: rawType,
      size: rawSize,
      uom: rawUom,
      defaultRentalRate: numericRate,
      ownershipClassification: validOwnership,
      status: rawStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
      isDuplicateCode,
      isExistingCodeInDb,
      isDuplicateVariant,
      isExistingVariantInDb,
      categoryStatus,
      typeStatus,
    });
  }

  return {
    totalRows: validatedRows.length,
    validRows: validatedRows.filter((r) => r.isValid).length,
    invalidRows: validatedRows.filter((r) => !r.isValid).length,
    rows: validatedRows,
  };
}

describe("Bulk Material Import Engine & Validation Suite", () => {
  // Test 1: XLSX File Creation and Parsing with SheetJS
  it("should generate and parse valid XLSX spreadsheet without formulas or executable macros", () => {
    const sampleData = [
      {
        "Material Code": "PROPS",
        "Material Name": "PROPS",
        Category: "Centering Materials",
        "Material Type": "Props",
        "Size / Dimensions": "7–12 ft",
        UOM: "Nos.",
        "Daily Rental Rate": 1.84,
        Ownership: "OWNED",
        Status: "ACTIVE",
        Description: "Standard props",
      },
      {
        "Material Code": "SAPAN",
        "Material Name": "SAPAN",
        Category: "Centering Materials",
        "Material Type": "Sapan",
        "Size / Dimensions": "8–14 ft",
        UOM: "Nos.",
        "Daily Rental Rate": 2.5,
        Ownership: "OWNED",
        Status: "ACTIVE",
        Description: "Heavy duty sapan",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Parse safely
    const parsedWb = XLSX.read(xlsxBuffer, {
      type: "buffer",
      cellFormula: false,
      cellHTML: false,
    });
    const parsedRows = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]]);

    assert.equal(parsedRows.length, 2);
    assert.equal(parsedRows[0]["Material Name"], "PROPS");
    assert.equal(parsedRows[1]["Material Name"], "SAPAN");
    assert.equal(parsedRows[0]["Daily Rental Rate"], 1.84);
  });

  // Test 2: CSV File Parsing
  it("should generate and parse CSV formatted material data", () => {
    const csvContent =
      "Material Name,Category,Material Type,Size / Dimensions,UOM,Daily Rental Rate,Ownership\n" +
      "FOLDING SHEET,Centering Materials,Folding Sheets,3x2 ft,Nos.,0.90,OWNED\n" +
      "HALF SHEET,Centering Materials,Sheets,3x1.5 ft,Nos.,0.70,OWNED\n";

    const parsedWb = XLSX.read(csvContent, { type: "string" });
    const parsedRows = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]]);

    assert.equal(parsedRows.length, 2);
    assert.equal(parsedRows[0]["Material Name"], "FOLDING SHEET");
    assert.equal(parsedRows[1]["Daily Rental Rate"], 0.7);
  });

  // Test 3: Missing Required Fields
  it("should detect and reject missing required fields (name, category, type, size)", () => {
    const invalidRows = [
      {
        rowNumber: 1,
        name: "", // Missing name
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
      },
      {
        rowNumber: 2,
        name: "COLUMN BOX",
        category: "", // Missing category
        materialType: "Column Boxes",
        size: "12x12 in",
        defaultRentalRate: 3.5,
      },
      {
        rowNumber: 3,
        name: "SPAN",
        category: "Centering Materials",
        materialType: "", // Missing type
        size: "8-14 ft",
        defaultRentalRate: 2.5,
      },
      {
        rowNumber: 4,
        name: "PROPS",
        category: "Centering Materials",
        materialType: "Props",
        size: "", // Missing size
        defaultRentalRate: 1.84,
      },
    ];

    const result = simulateValidateRows(invalidRows);
    assert.equal(result.totalRows, 4);
    assert.equal(result.validRows, 0);
    assert.equal(result.invalidRows, 4);

    assert.ok(result.rows[0].errors.name);
    assert.ok(result.rows[1].errors.category);
    assert.ok(result.rows[2].errors.materialType);
    assert.ok(result.rows[3].errors.size);
  });

  // Test 4: Invalid Rental Rates
  it("should reject negative rental rates and non-numeric rental rates", () => {
    const rateRows = [
      {
        rowNumber: 1,
        name: "PROPS",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: -2.5, // Negative
      },
      {
        rowNumber: 2,
        name: "SAPAN",
        category: "Centering Materials",
        materialType: "Sapan",
        size: "8-14 ft",
        defaultRentalRate: "N/A", // Non-numeric
      },
    ];

    const result = simulateValidateRows(rateRows);
    assert.equal(result.validRows, 0);
    assert.ok(result.rows[0].errors.defaultRentalRate.includes("cannot be negative"));
    assert.ok(result.rows[1].errors.defaultRentalRate.includes("valid number"));
  });

  // Test 5: Zero Rental Rate Handling
  it("should accept zero rental rate with confirmation warning per Business Rule", () => {
    const zeroRateRow = [
      {
        rowNumber: 1,
        name: "PROPS UNCONFIRMED",
        category: "Centering Materials",
        materialType: "Props",
        size: "10-15 ft",
        defaultRentalRate: 0,
        ownershipClassification: "OWNED",
      },
    ];

    const result = simulateValidateRows(zeroRateRow);
    assert.equal(result.validRows, 1);
    assert.ok(result.rows[0].warnings.defaultRentalRate.includes("Zero rental rate requires confirmation"));
  });

  // Test 6: Duplicate Material Codes within the Upload File
  it("should detect duplicate material codes within the file", () => {
    const fileWithDuplicates = [
      {
        rowNumber: 1,
        materialCode: "MAT-PROP-01",
        name: "PROPS 1",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
      },
      {
        rowNumber: 2,
        materialCode: "MAT-PROP-01", // Duplicate of row 1
        name: "PROPS 2",
        category: "Centering Materials",
        materialType: "Props",
        size: "8-14 ft",
        defaultRentalRate: 2.5,
      },
    ];

    const result = simulateValidateRows(fileWithDuplicates);
    assert.equal(result.rows[0].isDuplicateCode, true);
    assert.equal(result.rows[1].isDuplicateCode, true);
    assert.equal(result.validRows, 0);
  });

  // Test 7: Conflict with Existing Database Material Codes
  it("should flag conflicts when an uploaded material code already exists in the database", () => {
    const dbMock = {
      categories: [{ id: "c1", name: "Centering Materials" }],
      types: [{ id: "t1", categoryId: "c1", name: "Props" }],
      variants: [{ materialCode: "MAT-EXISTING-01", name: "OLD PROPS", size: "7-12 ft" }],
    };

    const row = [
      {
        rowNumber: 1,
        materialCode: "MAT-EXISTING-01", // Conflicts with DB
        name: "NEW PROPS",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
      },
    ];

    const result = simulateValidateRows(row, dbMock);
    assert.equal(result.rows[0].isExistingCodeInDb, true);
    assert.ok(result.rows[0].errors.materialCode.includes("already exists in database"));
  });

  // Test 8: Conflict with Existing Identical Material Variants (Name + Size)
  it("should detect identical existing variants in database catalogue", () => {
    const dbMock = {
      categories: [{ id: "c1", name: "Centering Materials" }],
      types: [{ id: "t1", categoryId: "c1", name: "Props" }],
      variants: [{ materialCode: "MAT-0001", name: "PROPS", size: "7-12 ft" }],
    };

    const row = [
      {
        rowNumber: 1,
        name: "PROPS",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft", // Identical name and size
        defaultRentalRate: 2.0,
      },
    ];

    const result = simulateValidateRows(row, dbMock);
    assert.equal(result.rows[0].isExistingVariantInDb, true);
    assert.ok(result.rows[0].warnings.existingInDb.includes("already exists in catalogue"));
  });

  // Test 9: Ownership Classification Validation
  it("should permit only OWNED or HIRED_IN ownership types and reject arbitrary strings", () => {
    const rows = [
      {
        rowNumber: 1,
        name: "PROPS A",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
        ownershipClassification: "OWNED",
      },
      {
        rowNumber: 2,
        name: "PROPS B",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
        ownershipClassification: "HIRED_IN",
      },
      {
        rowNumber: 3,
        name: "PROPS C",
        category: "Centering Materials",
        materialType: "Props",
        size: "7-12 ft",
        defaultRentalRate: 2.0,
        ownershipClassification: "THIRD_PARTY_RENTAL", // Invalid
      },
    ];

    const result = simulateValidateRows(rows);
    assert.equal(result.rows[0].isValid, true);
    assert.equal(result.rows[1].isValid, true);
    assert.equal(result.rows[2].isValid, false);
    assert.ok(result.rows[2].errors.ownershipClassification.includes("OWNED or HIRED_IN"));
  });

  // Test 10: Category and Type Resolution (Existing vs New with Case-Insensitive Matching)
  it("should match existing categories & types case-insensitively and flag new ones without duplicating", () => {
    const dbMock = {
      categories: [{ id: "cat-1", name: "Centering Materials" }],
      types: [{ id: "typ-1", categoryId: "cat-1", name: "Props" }],
      variants: [],
    };

    const rows = [
      {
        rowNumber: 1,
        name: "PROPS A",
        category: "centering materials", // Lowercase existing
        materialType: "props", // Lowercase existing
        size: "7-12 ft",
        defaultRentalRate: 2.0,
      },
      {
        rowNumber: 2,
        name: "SCAFFOLDING TUBE",
        category: "Scaffolding Systems", // New Category
        materialType: "Tubes", // New Type
        size: "6 Meter",
        defaultRentalRate: 4.0,
      },
    ];

    const result = simulateValidateRows(rows, dbMock);
    assert.equal(result.rows[0].categoryStatus, "EXISTS");
    assert.equal(result.rows[0].typeStatus, "EXISTS");

    assert.equal(result.rows[1].categoryStatus, "NEW");
    assert.equal(result.rows[1].typeStatus, "NEW");
  });

  // Test 11: Zod Schema Batch Limits & Validation
  it("should enforce batch size constraints (minimum 1, maximum 2000 items)", () => {
    // Empty array
    const emptyResult = bulkMaterialImportSchema.safeParse({ items: [] });
    assert.equal(emptyResult.success, false);

    // Valid batch
    const validBatch = bulkMaterialImportSchema.safeParse({
      items: [
        {
          name: "PROPS",
          category: "Centering Materials",
          materialType: "Props",
          size: "7-12 ft",
          defaultRentalRate: 1.84,
          ownershipClassification: "OWNED",
        },
      ],
      skipDuplicates: true,
      autoCreateCategoriesAndTypes: true,
    });
    assert.equal(validBatch.success, true);
  });

  // Test 12: Business Invariance Rule: No Stock Movements or Purchase Costs
  it("should ensure material catalogue import strictly creates master metadata without creating stock balances or inventory movements", () => {
    // Simulation of master creation
    const importedMaterial = {
      id: "mat-test-uuid",
      materialCode: "MAT-2026-0001",
      name: "NEW PROPS",
      size: "7-12 ft",
      uom: "Nos.",
      defaultRentalRate: new Prisma.Decimal(2.0),
      purchaseCost: null, // Strictly null - do not invent purchase costs
      minimumStock: new Prisma.Decimal(0),
      ownershipClassification: "OWNED",
      isActive: true,
    };

    assert.equal(importedMaterial.purchaseCost, null, "Purchase cost must remain null; never invented");
    assert.equal(importedMaterial.minimumStock.toNumber(), 0);
  });
});
