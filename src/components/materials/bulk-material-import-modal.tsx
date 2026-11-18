"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FileText,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { SAMPLE_MATERIAL_TEMPLATE_ROWS } from "@/lib/materials/bulk-import-constants";

interface TargetFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

const TARGET_FIELDS: TargetFieldDefinition[] = [
  {
    key: "materialCode",
    label: "Material Code",
    required: false,
    aliases: ["material code", "materialcode", "mat code", "code", "item code", "sku"],
    description: "Unique code (leave blank to auto-generate sequentially)",
  },
  {
    key: "name",
    label: "Material Name",
    required: true,
    aliases: ["material name", "materialname", "item name", "name", "material", "item"],
    description: "Name of the centering equipment (e.g. PROPS, SAPAN)",
  },
  {
    key: "category",
    label: "Category",
    required: true,
    aliases: ["category", "category name", "material category", "cat"],
    description: "Main category (e.g. Centering Materials, Scaffolding)",
  },
  {
    key: "materialType",
    label: "Material Type",
    required: true,
    aliases: ["material type", "materialtype", "type", "type name", "typ"],
    description: "Specific type under category (e.g. Props, Sheets, Sapan)",
  },
  {
    key: "size",
    label: "Size / Dimensions",
    required: true,
    aliases: ["size / dimensions", "size/dimensions", "size", "dimensions", "dimension", "spec", "specification"],
    description: "Dimension or span (e.g. 7–12 ft, 3×2 ft)",
  },
  {
    key: "uom",
    label: "UOM",
    required: true,
    aliases: ["uom", "unit", "unit of measure", "u.o.m.", "units"],
    description: "Unit of measure (e.g. Nos., Set, Bundle, Meter)",
  },
  {
    key: "defaultRentalRate",
    label: "Daily Rental Rate (₹)",
    required: true,
    aliases: ["daily rental rate", "rental rate", "rate", "daily rate", "rent/day", "rentalrate", "rate (₹)"],
    description: "Standard daily hire charge in INR",
  },
  {
    key: "ownershipClassification",
    label: "Ownership",
    required: true,
    aliases: ["ownership", "ownership classification", "ownership type", "owner", "pool"],
    description: "OWNED or HIRED_IN",
  },
  {
    key: "status",
    label: "Status",
    required: false,
    aliases: ["status", "active", "is active", "state"],
    description: "ACTIVE or INACTIVE (defaults to ACTIVE)",
  },
  {
    key: "description",
    label: "Description / Notes",
    required: false,
    aliases: ["description", "desc", "notes", "remarks"],
    description: "Optional specifications or reference notes",
  },
];

interface BulkMaterialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkMaterialImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkMaterialImportModalProps) {
  // Stepper state: 1: Upload, 2: Column Mapping, 3: Preview & Validation, 4: Summary Result
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4>(1);

  // File state
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [rawHeaders, setRawHeaders] = React.useState<string[]>([]);
  const [rawSheetData, setRawSheetData] = React.useState<any[]>([]);

  // Mapping state: targetKey -> rawHeader
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});

  // Validation state
  const [validating, setValidating] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<any | null>(null);
  const [validatedRows, setValidatedRows] = React.useState<any[]>([]);
  const [filterTab, setFilterTab] = React.useState<"ALL" | "VALID" | "INVALID" | "WARNINGS">("ALL");
  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  // Options & submission
  const [skipDuplicates, setSkipDuplicates] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<any | null>(null);

  // Reset modal state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setUploadedFile(null);
      setRawHeaders([]);
      setRawSheetData([]);
      setColumnMapping({});
      setValidationResult(null);
      setValidatedRows([]);
      setImportResult(null);
      setPage(1);
      setFilterTab("ALL");
    }
  }, [isOpen]);

  // Download Sample Template
  const handleDownloadTemplate = (format: "xlsx" | "csv") => {
    if (format === "csv") {
      window.open("/api/v1/materials/import/template?format=csv", "_blank");
    } else {
      window.open("/api/v1/materials/import/template?format=xlsx", "_blank");
    }
  };

  // Safe client-side file reading with XLSX (disabled formula & HTML execution)
  const processUploadedFile = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      toast.error("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit. Please upload a smaller file.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      // Hardened parsing options per security requirements
      const wb = XLSX.read(buffer, {
        type: "array",
        cellFormula: false, // NEVER execute formulas
        cellHTML: false,    // NEVER render HTML
        cellStyles: false,
        sheetRows: 2500,    // Protection against excessive row counts
      });

      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        toast.error("Spreadsheet contains no sheets.");
        return;
      }

      const ws = wb.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("Spreadsheet has no data rows.");
        return;
      }

      if (jsonData.length > 2000) {
        toast.error(
          `File contains ${jsonData.length} rows, exceeding the 2,000 maximum row limit. Please split the file into smaller batches.`
        );
        return;
      }

      // Extract headers from the first row object keys
      const headers = Object.keys(jsonData[0] || {});
      if (headers.length === 0) {
        toast.error("No valid column headers found in spreadsheet.");
        return;
      }

      setUploadedFile(file);
      setRawHeaders(headers);
      setRawSheetData(jsonData);

      // Auto-map headers
      const initialMapping: Record<string, string> = {};
      for (const target of TARGET_FIELDS) {
        // Direct exact match
        const exact = headers.find(
          (h) => h.trim().toLowerCase() === target.label.toLowerCase() || h.trim().toLowerCase() === target.key.toLowerCase()
        );
        if (exact) {
          initialMapping[target.key] = exact;
          continue;
        }

        // Alias match
        const aliasMatch = headers.find((h) => {
          const cleanH = h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          return target.aliases.some((alias) => cleanH === alias.replace(/[^a-z0-9]/g, ""));
        });
        if (aliasMatch) {
          initialMapping[target.key] = aliasMatch;
        }
      }

      setColumnMapping(initialMapping);
      setCurrentStep(2);
      toast.success(`Parsed ${jsonData.length} rows and ${headers.length} columns from ${file.name}.`);
    } catch (err: any) {
      console.error("File parse error:", err);
      toast.error(`Failed to read file: ${err.message || "Malformed spreadsheet"}`);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Run validation on mapped rows
  const handleProceedToValidation = async () => {
    // Check required fields mapped
    const unmappedRequired = TARGET_FIELDS.filter((f) => f.required && !columnMapping[f.key]);
    if (unmappedRequired.length > 0) {
      toast.error(`Please map required field(s): ${unmappedRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    try {
      setValidating(true);

      // Transform raw rows using mapping
      const mappedRows = rawSheetData.map((row, idx) => {
        const item: Record<string, any> = { rowNumber: idx + 1 };
        for (const [targetKey, rawCol] of Object.entries(columnMapping)) {
          if (rawCol && row[rawCol] !== undefined) {
            item[targetKey] = row[rawCol];
          }
        }
        return item;
      });

      const res = await fetch("/api/v1/materials/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mappedRows }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Validation failed.");
      }

      setValidationResult(json.data);
      setValidatedRows(json.data.rows);
      setCurrentStep(3);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setValidating(false);
    }
  };

  // Remove a row from preview
  const handleRemoveRow = (rowNumber: number) => {
    const updated = validatedRows.filter((r) => r.rowNumber !== rowNumber);
    setValidatedRows(updated);
    toast.info(`Removed row #${rowNumber} from import batch.`);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    const validItems = validatedRows.filter((r) => r.isValid);
    if (validItems.length === 0) {
      toast.error("No valid rows available to import. Please review and fix errors first.");
      return;
    }

    try {
      setIsImporting(true);

      const payload = {
        items: validItems.map((r) => ({
          rowNumber: r.rowNumber,
          materialCode: r.materialCode || undefined,
          name: r.name,
          category: r.category,
          materialType: r.materialType,
          size: r.size,
          uom: r.uom,
          defaultRentalRate: r.defaultRentalRate,
          ownershipClassification: r.ownershipClassification,
          status: r.status,
          description: r.description || undefined,
        })),
        skipDuplicates,
        autoCreateCategoriesAndTypes: true,
      };

      const res = await fetch("/api/v1/materials/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to import materials.");
      }

      setImportResult(json.data);
      setCurrentStep(4);
      toast.success(json.message);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Download Import Result Report as CSV
  const handleDownloadReport = () => {
    if (!importResult && validatedRows.length === 0) return;

    const reportRows = validatedRows.map((r) => {
      const isImported = importResult?.createdVariants?.some((cv: any) => cv.name === r.name && cv.size === r.size);
      return {
        "Row Number": r.rowNumber,
        "Material Code": r.materialCode || "AUTO-GENERATED",
        "Material Name": r.name,
        Category: r.category,
        "Material Type": r.materialType,
        Size: r.size,
        UOM: r.uom,
        "Rental Rate (₹)": r.defaultRentalRate,
        Ownership: r.ownershipClassification,
        Status: isImported ? "IMPORTED_SUCCESSFULLY" : r.isValid ? "READY_NOT_IMPORTED" : "VALIDATION_FAILED",
        "Validation Errors": Object.values(r.errors || {}).join(" | "),
        Warnings: Object.values(r.warnings || {}).join(" | "),
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventra-material-import-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered rows for Step 3
  const filteredRows = React.useMemo(() => {
    if (filterTab === "VALID") return validatedRows.filter((r) => r.isValid);
    if (filterTab === "INVALID") return validatedRows.filter((r) => !r.isValid);
    if (filterTab === "WARNINGS") return validatedRows.filter((r) => Object.keys(r.warnings || {}).length > 0);
    return validatedRows;
  }, [validatedRows, filterTab]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const validRowsCount = validatedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = validatedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50/50">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B1E36] text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 text-[#F26522]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Bulk Material Catalogue Import
                <Badge className="bg-[#F26522] text-white text-[10px] font-bold tracking-wider uppercase">
                  XLSX • XLS • CSV
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                AJAY ENTERPRISES Centering Material & Formwork Catalogue Bulk Ingestion
              </p>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded font-medium ${currentStep === 1 ? "bg-[#F26522] text-white" : "bg-white/10 text-slate-300"}`}>
              1. Upload
            </span>
            <span className="text-slate-500">→</span>
            <span className={`px-2 py-1 rounded font-medium ${currentStep === 2 ? "bg-[#F26522] text-white" : "bg-white/10 text-slate-300"}`}>
              2. Map
            </span>
            <span className="text-slate-500">→</span>
            <span className={`px-2 py-1 rounded font-medium ${currentStep === 3 ? "bg-[#F26522] text-white" : "bg-white/10 text-slate-300"}`}>
              3. Validate
            </span>
            <span className="text-slate-500">→</span>
            <span className={`px-2 py-1 rounded font-medium ${currentStep === 4 ? "bg-emerald-600 text-white" : "bg-white/10 text-slate-300"}`}>
              4. Complete
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Template Download Banner */}
              <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 text-[#F26522] rounded-lg mt-0.5">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Download Material Import Template</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Use our standardized format containing sample Props, Sheets, Sapan, and Scaffolding columns.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate("xlsx")}
                    className="bg-white border-orange-200 text-slate-800 hover:bg-orange-100 text-xs font-semibold"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-[#F26522]" />
                    Excel (.xlsx)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate("csv")}
                    className="bg-white border-orange-200 text-slate-800 hover:bg-orange-100 text-xs font-semibold"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1 text-slate-600" />
                    CSV (.csv)
                  </Button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer bg-white ${
                  isDragging
                    ? "border-[#F26522] bg-orange-50/30 scale-[0.99]"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/50"
                }`}
                onClick={() => document.getElementById("material-bulk-file-input")?.click()}
              >
                <input
                  id="material-bulk-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 text-[#0B1E36] flex items-center justify-center mb-3 shadow-inner">
                  <Upload className="h-7 w-7 text-[#F26522]" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Click to browse or drag and drop your spreadsheet here
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv). Max file size 10MB, up to 2,000 material rows.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    <Check className="h-3 w-3 text-emerald-600" /> Secure formula-free parsing
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    <Check className="h-3 w-3 text-emerald-600" /> Auto-creates missing categories
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">File: {uploadedFile?.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {rawSheetData.length} rows detected • Match your spreadsheet columns to INVENTRA material catalogue fields.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Change File
                </Button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-1/3">Target INVENTRA Field</th>
                      <th className="p-3 w-1/3">Spreadsheet Column (From File)</th>
                      <th className="p-3 w-1/3">First Row Sample</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {TARGET_FIELDS.map((target) => {
                      const currentMappedCol = columnMapping[target.key] || "";
                      const sampleValue = currentMappedCol && rawSheetData[0] ? String(rawSheetData[0][currentMappedCol] ?? "") : "—";

                      return (
                        <tr key={target.key} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {target.label}
                              {target.required ? (
                                <Badge className="bg-red-50 text-red-600 border border-red-200 text-[9px] px-1 py-0 font-bold">
                                  Required
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 text-[9px] px-1 py-0 font-normal">
                                  Optional
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{target.description}</div>
                          </td>
                          <td className="p-3">
                            <select
                              value={currentMappedCol}
                              onChange={(e) => setColumnMapping({ ...columnMapping, [target.key]: e.target.value })}
                              className={`w-full h-8 text-xs rounded-md border px-2 focus:outline-none focus:ring-1 focus:ring-[#F26522] ${
                                target.required && !currentMappedCol
                                  ? "border-red-300 bg-red-50/30 text-red-700 font-medium"
                                  : "border-slate-300 bg-white text-slate-800"
                              }`}
                            >
                              <option value="">-- Do Not Import / Leave Blank --</option>
                              {rawHeaders.map((header) => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 font-mono text-slate-600 truncate max-w-xs">
                            {sampleValue}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* Validation Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="border-slate-200 shadow-2xs">
                  <CardContent className="p-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Rows</span>
                    <span className="text-xl font-bold text-slate-900">{validatedRows.length}</span>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/30 shadow-2xs">
                  <CardContent className="p-3">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Valid Rows</span>
                    <span className="text-xl font-bold text-emerald-600">{validRowsCount}</span>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/30 shadow-2xs">
                  <CardContent className="p-3">
                    <span className="text-[10px] text-red-700 font-bold uppercase block">Invalid / Errors</span>
                    <span className="text-xl font-bold text-red-600">{invalidRowsCount}</span>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/30 shadow-2xs">
                  <CardContent className="p-3">
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">New Categories</span>
                    <span className="text-xl font-bold text-blue-600">
                      {validationResult?.newCategories?.length || 0}
                    </span>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/30 shadow-2xs">
                  <CardContent className="p-3">
                    <span className="text-[10px] text-purple-700 font-bold uppercase block">New Types</span>
                    <span className="text-xl font-bold text-purple-600">
                      {validationResult?.newTypes?.length || 0}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Filter Tabs & Duplicate Options */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant={filterTab === "ALL" ? "default" : "outline"}
                    onClick={() => { setFilterTab("ALL"); setPage(1); }}
                    className={`h-7 text-xs ${filterTab === "ALL" ? "bg-[#0B1E36]" : ""}`}
                  >
                    All ({validatedRows.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterTab === "VALID" ? "default" : "outline"}
                    onClick={() => { setFilterTab("VALID"); setPage(1); }}
                    className={`h-7 text-xs ${filterTab === "VALID" ? "bg-emerald-600 text-white" : "text-emerald-700"}`}
                  >
                    Valid Only ({validRowsCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterTab === "INVALID" ? "default" : "outline"}
                    onClick={() => { setFilterTab("INVALID"); setPage(1); }}
                    className={`h-7 text-xs ${filterTab === "INVALID" ? "bg-red-600 text-white" : "text-red-700"}`}
                  >
                    Errors Only ({invalidRowsCount})
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    id="skipDuplicatesCheck"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#F26522] focus:ring-[#F26522]"
                  />
                  <label htmlFor="skipDuplicatesCheck" className="text-slate-700 cursor-pointer font-medium">
                    Skip existing duplicates automatically
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-2.5 w-12 text-center">#</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Material Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">UOM</th>
                      <th className="p-2.5 text-right">Rate (₹)</th>
                      <th className="p-2.5 text-center">Ownership</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5">Validation Result</th>
                      <th className="p-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-slate-400">
                          No material rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            !row.isValid ? "bg-red-50/20" : ""
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono text-slate-400">
                            {row.rowNumber}
                          </td>
                          <td className="p-2.5 font-mono font-medium">
                            {row.materialCode ? (
                              <span className={row.errors?.materialCode ? "text-red-600 font-bold" : "text-slate-900"}>
                                {row.materialCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">&lt;Auto MAT-xxxx&gt;</span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900">
                            <span className={row.errors?.name ? "text-red-600 font-bold" : ""}>
                              {row.name || "—"}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <span>{row.category}</span>
                              {row.categoryStatus === "NEW" && (
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-1 py-0 font-bold">
                                  +New Cat
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <span>{row.materialType}</span>
                              {row.typeStatus === "NEW" && (
                                <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] px-1 py-0 font-bold">
                                  +New Type
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-medium">{row.size}</td>
                          <td className="p-2.5 text-slate-600">{row.uom}</td>
                          <td className="p-2.5 text-right font-mono font-medium">
                            ₹{Number(row.defaultRentalRate || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                row.ownershipClassification === "OWNED"
                                  ? "bg-slate-50 text-slate-700"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {row.ownershipClassification}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                row.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                              title={row.status}
                            />
                          </td>
                          <td className="p-2.5 max-w-xs">
                            {row.isValid ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                                </span>
                                {Object.values(row.warnings || {}).map((w: any, idx) => (
                                  <span key={idx} className="text-[10px] text-amber-700">
                                    ⚠️ {w}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]">
                                  <XCircle className="h-3.5 w-3.5" /> Invalid
                                </span>
                                {Object.entries(row.errors || {}).map(([field, msg]: any) => (
                                  <p key={field} className="text-[10px] text-red-600 leading-tight">
                                    • {msg}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRow(row.rowNumber)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete row from import batch"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredRows.length)} of{" "}
                    {filteredRows.length} rows
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="h-7 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                    </Button>
                    <span className="font-medium text-slate-700">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUMMARY & SUCCESS */}
          {currentStep === 4 && importResult && (
            <div className="space-y-6 text-center py-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Material Catalogue Import Complete!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  New materials have been registered with initial rental rate histories and master category links.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="p-4 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Successfully Imported</span>
                  <span className="text-2xl font-bold text-emerald-600">{importResult.importedCount}</span>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Skipped / Duplicates</span>
                  <span className="text-2xl font-bold text-slate-600">{importResult.skippedCount}</span>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">New Categories</span>
                  <span className="text-2xl font-bold text-blue-600">{importResult.categoriesCreated}</span>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">New Types</span>
                  <span className="text-2xl font-bold text-purple-600">{importResult.typesCreated}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadReport}
                  className="text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download Import Log (CSV)
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white text-xs font-semibold px-6"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep === 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Upload
              </Button>
            )}
            {currentStep === 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(2)}
                className="text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Adjust Column Mapping
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep !== 4 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isImporting || validating}
                className="text-xs text-slate-500"
              >
                Cancel
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                type="button"
                size="sm"
                onClick={handleProceedToValidation}
                isLoading={validating}
                loadingText="Validating..."
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                Next: Validate Rows <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteImport}
                disabled={validRowsCount === 0 || isImporting}
                isLoading={isImporting}
                loadingText="Importing Materials..."
                className="bg-[#F26522] hover:bg-[#EA580C] text-white text-xs font-semibold shadow-sm px-4"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Import {validRowsCount} Valid Material{validRowsCount !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
