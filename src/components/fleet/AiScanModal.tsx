"use client";

import * as React from "react";
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Receipt,
  Gauge,
  Sparkles,
  Layers,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/portal";

export interface ExtractedValues {
  date?: string;
  time?: string;
  vendor?: string;
  invoiceNumber?: string;
  fuelType?: string;
  quantity?: number;
  quantityUnit?: string;
  ratePerUnit?: number;
  totalAmount?: number;
  taxAmount?: number;
  odometerKm?: number;
  vehicleRegistration?: string;
  paymentMethod?: string;
  description?: string;
  category?: string;
  policyNumber?: string;
  policyExpiryDate?: string;
  receiptDocumentUrl?: string;
  meterDocumentUrl?: string;
  odometerDocumentUrl?: string;
  fileUrl?: string;
  fieldOrigins?: Record<string, string>;
  fieldConfidence?: Record<string, number>;
  warnings?: string[];
}

interface AiScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (values: ExtractedValues) => void;
  vehicleId?: string;
  vehicleNumber?: string;
  mode?: "fuel" | "maintenance";
}

const ROTATING_FUEL_MESSAGES = [
  "Uploading document securely to Supabase Storage…",
  "DeepSeek AI reading the document…",
  "Detecting fuel volume, rate and total amount…",
  "Extracting station name and transaction date…",
  "Cross-checking arithmetic and readings…",
  "Finalizing verified extraction…",
];

const ROTATING_MAINTENANCE_MESSAGES = [
  "Uploading invoice securely to Supabase Storage…",
  "DeepSeek AI reading workshop invoice…",
  "Extracting service provider, items and charges…",
  "Identifying tax / GST breakdown…",
  "Verifying service odometer and dates…",
  "Finalizing maintenance expense…",
];

export function AiScanModal({
  isOpen,
  onClose,
  onExtracted,
  vehicleId,
  vehicleNumber,
  mode = "fuel",
}: AiScanModalProps) {
  // Fuel scanning sub-modes
  const [fuelScanType, setFuelScanType] = React.useState<"fuel_receipt" | "pump_meter" | "odometer" | "combined_fuel">("fuel_receipt");
  
  // Maintenance category
  const [maintenanceCategory, setMaintenanceCategory] = React.useState<string>("service");

  // Files
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [meterFile, setMeterFile] = React.useState<File | null>(null);
  const [odometerFile, setOdometerFile] = React.useState<File | null>(null);

  // Previews
  const [receiptPreview, setReceiptPreview] = React.useState<string | null>(null);
  const [meterPreview, setMeterPreview] = React.useState<string | null>(null);
  const [odometerPreview, setOdometerPreview] = React.useState<string | null>(null);

  // Processing state
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanMessageIndex, setScanMessageIndex] = React.useState(0);
  const [scanError, setScanError] = React.useState("");

  // Extracted Result for Review
  const [extractedData, setExtractedData] = React.useState<ExtractedValues | null>(null);
  const [editableValues, setEditableValues] = React.useState<Record<string, any>>({});

  // Cycle rotating scanning message
  React.useEffect(() => {
    if (!isScanning) return;
    const messages = mode === "fuel" ? ROTATING_FUEL_MESSAGES : ROTATING_MAINTENANCE_MESSAGES;
    const interval = setInterval(() => {
      setScanMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isScanning, mode]);

  if (!isOpen) return null;

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "receipt" | "meter" | "odometer"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    if (type === "receipt") {
      setReceiptFile(file);
      setReceiptPreview(previewUrl);
    } else if (type === "meter") {
      setMeterFile(file);
      setMeterPreview(previewUrl);
    } else if (type === "odometer") {
      setOdometerFile(file);
      setOdometerPreview(previewUrl);
    }
  };

  const handleClearFile = (type: "receipt" | "meter" | "odometer") => {
    if (type === "receipt") {
      setReceiptFile(null);
      setReceiptPreview(null);
    } else if (type === "meter") {
      setMeterFile(null);
      setMeterPreview(null);
    } else if (type === "odometer") {
      setOdometerFile(null);
      setOdometerPreview(null);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanError("");
    setScanMessageIndex(0);

    try {
      const formData = new FormData();
      formData.append("scanType", mode === "fuel" ? fuelScanType : "expense_bill");
      if (mode === "maintenance") {
        formData.append("category", maintenanceCategory);
      }
      if (vehicleId) {
        formData.append("vehicleId", vehicleId);
      }

      if (fuelScanType === "combined_fuel") {
        if (receiptFile) formData.append("receiptImage", receiptFile);
        if (meterFile) formData.append("meterImage", meterFile);
        if (odometerFile) formData.append("odometerImage", odometerFile);
      } else if (fuelScanType === "pump_meter") {
        if (meterFile) formData.append("image", meterFile);
        else if (receiptFile) formData.append("image", receiptFile);
      } else if (fuelScanType === "odometer") {
        if (odometerFile) formData.append("image", odometerFile);
        else if (receiptFile) formData.append("image", receiptFile);
      } else {
        // fuel_receipt or expense_bill
        if (receiptFile) formData.append("image", receiptFile);
      }

      const res = await fetch("/api/v1/fleet/scan", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to scan document with DeepSeek AI");
      }

      const data = json.data;
      const fields = data.fields || {};

      const values: ExtractedValues = {
        date: fields.date || new Date().toISOString().slice(0, 10),
        time: fields.time || "",
        vendor: fields.vendor || "",
        invoiceNumber: fields.invoiceNumber || "",
        fuelType: fields.fuelType || "DIESEL",
        quantity: fields.quantity != null ? Number(fields.quantity) : undefined,
        quantityUnit: fields.quantityUnit || "L",
        ratePerUnit: fields.ratePerUnit != null ? Number(fields.ratePerUnit) : undefined,
        totalAmount: fields.totalAmount != null ? Number(fields.totalAmount) : undefined,
        taxAmount: fields.taxAmount != null ? Number(fields.taxAmount) : undefined,
        odometerKm: fields.odometerKm != null ? Number(fields.odometerKm) : undefined,
        vehicleRegistration: fields.vehicleRegistration || "",
        paymentMethod: fields.paymentMethod || "CASH",
        description: fields.description || "",
        category: fields.category || (mode === "fuel" ? "fuel" : maintenanceCategory),
        policyNumber: fields.policyNumber || "",
        policyExpiryDate: fields.policyExpiryDate || "",
        receiptDocumentUrl: data.receiptFileUrl || data.fileUrl,
        meterDocumentUrl: data.meterFileUrl,
        odometerDocumentUrl: data.odometerFileUrl,
        fileUrl: data.fileUrl,
        fieldOrigins: data.fieldOrigins || {},
        fieldConfidence: data.fieldConfidence || {},
        warnings: data.warnings || [],
      };

      setExtractedData(values);
      setEditableValues({ ...values });
    } catch (err: any) {
      console.error("[AiScanModal Error]", err);
      setScanError(err.message || "An error occurred during AI scanning. Please try again or enter details manually.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = () => {
    if (!editableValues) return;
    onExtracted(editableValues as ExtractedValues);
    onClose();
  };

  const messages = mode === "fuel" ? ROTATING_FUEL_MESSAGES : ROTATING_MAINTENANCE_MESSAGES;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B1E36] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F26522] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                {mode === "fuel" ? "AI Fuel & Refill Scanner" : "AI Vehicle Bill & Expense Scanner"}
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-orange-200 font-bold tracking-wide">
                  DeepSeek Vision
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {vehicleNumber ? `Scanning for Vehicle: ${vehicleNumber}` : "Extract details instantly from receipts, meter displays and invoices"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {scanError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Scanning Issue</p>
                <p className="mt-0.5">{scanError}</p>
              </div>
            </div>
          )}

          {!extractedData ? (
            /* STEP 1: Upload & Options */
            <div className="space-y-5">
              {mode === "fuel" ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Choose What You Are Scanning
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "fuel_receipt", label: "Fuel Receipt", icon: Receipt, desc: "Station slip" },
                      { id: "pump_meter", label: "Pump Meter", icon: Gauge, desc: "Dispenser screen" },
                      { id: "odometer", label: "Odometer", icon: Gauge, desc: "Dashboard cluster" },
                      { id: "combined_fuel", label: "Combined 3-in-1", icon: Layers, desc: "Receipt + Meter + Odo" },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = fuelScanType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFuelScanType(opt.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            active
                              ? "border-[#F26522] bg-orange-50/70 text-[#0B1E36] ring-1 ring-[#F26522]"
                              : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-1.5 ${active ? "text-[#F26522]" : "text-slate-400"}`} />
                          <div className="text-xs font-bold leading-tight">{opt.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Document Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "service", label: "Service Bill" },
                      { id: "repair", label: "Repair Invoice" },
                      { id: "insurance", label: "Insurance Policy" },
                      { id: "accessories", label: "Tyres / Batteries" },
                      { id: "toll", label: "Toll / FASTag" },
                      { id: "parking", label: "Parking Slip" },
                      { id: "other", label: "Other Expense" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setMaintenanceCategory(c.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          maintenanceCategory === c.id
                            ? "border-[#F26522] bg-orange-50/70 text-[#F26522] font-bold ring-1 ring-[#F26522]"
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Slots */}
              {fuelScanType === "combined_fuel" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Receipt Slot */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50 relative hover:bg-slate-100/70 transition-colors">
                    <span className="text-[11px] font-bold text-[#0B1E36] block mb-1">1. Fuel Receipt</span>
                    {receiptPreview ? (
                      <div className="relative group">
                        <img src={receiptPreview} alt="Receipt preview" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => handleClearFile("receipt")}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-4">
                        <Camera className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <span className="text-xs text-[#F26522] font-bold block">Capture / Upload</span>
                        <span className="text-[10px] text-slate-400">Printed slip</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          capture="environment"
                          onChange={(e) => handleFileChange(e, "receipt")}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Meter Slot */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50 relative hover:bg-slate-100/70 transition-colors">
                    <span className="text-[11px] font-bold text-[#0B1E36] block mb-1">2. Pump Meter</span>
                    {meterPreview ? (
                      <div className="relative group">
                        <img src={meterPreview} alt="Meter preview" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => handleClearFile("meter")}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-4">
                        <Gauge className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <span className="text-xs text-[#F26522] font-bold block">Capture / Upload</span>
                        <span className="text-[10px] text-slate-400">Pump display</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileChange(e, "meter")}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Odometer Slot */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50 relative hover:bg-slate-100/70 transition-colors">
                    <span className="text-[11px] font-bold text-[#0B1E36] block mb-1">3. Odometer</span>
                    {odometerPreview ? (
                      <div className="relative group">
                        <img src={odometerPreview} alt="Odometer preview" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => handleClearFile("odometer")}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-4">
                        <Gauge className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <span className="text-xs text-[#F26522] font-bold block">Capture / Upload</span>
                        <span className="text-[10px] text-slate-400">Dashboard reading</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileChange(e, "odometer")}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                /* Single Image Slot */
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  {receiptPreview ? (
                    <div className="space-y-3">
                      <div className="relative inline-block max-w-sm mx-auto">
                        <img src={receiptPreview} alt="Preview" className="max-h-56 rounded-xl border border-slate-200 shadow-sm" />
                        <button
                          type="button"
                          onClick={() => handleClearFile("receipt")}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {receiptFile?.name} ({(receiptFile?.size! / 1024).toFixed(0)} KB)
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-2 py-4">
                      <div className="w-12 h-12 rounded-full bg-orange-100 text-[#F26522] flex items-center justify-center mx-auto mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-[#0B1E36]">
                        Take Photo or Select File
                      </div>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Supports high-resolution camera capture on mobile or drag-and-drop receipt image / PDF
                      </p>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F26522] bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                        <Upload className="w-3.5 h-3.5" />
                        Browse Files
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={(e) => handleFileChange(e, "receipt")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* In-Flight Scanning Progress */}
              {isScanning && (
                <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-xl text-center space-y-2 animate-pulse">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#F26522]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>DeepSeek AI Vision Processing…</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium transition-all duration-300">
                    {messages[scanMessageIndex]}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Review & Edit Extracted Values */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>AI Extraction Complete – Review Values Before Saving</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExtractedData(null);
                    setEditableValues({});
                  }}
                  className="text-xs text-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Rescan
                </Button>
              </div>

              {editableValues.warnings && editableValues.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Info className="w-3.5 h-3.5" />
                    Observations & Arithmetic Checks
                  </div>
                  {editableValues.warnings.map((w: string, i: number) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Date {editableValues.fieldOrigins?.date && <span className="text-[10px] text-orange-600 font-bold">({editableValues.fieldOrigins.date})</span>}
                  </label>
                  <Input
                    type="date"
                    value={editableValues.date || ""}
                    onChange={(e) => setEditableValues({ ...editableValues, date: e.target.value })}
                  />
                </div>

                {mode === "fuel" && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Fuel Type</label>
                    <Input
                      value={editableValues.fuelType || "DIESEL"}
                      onChange={(e) => setEditableValues({ ...editableValues, fuelType: e.target.value.toUpperCase() })}
                    />
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {mode === "fuel" ? "Fuel Station / Vendor" : "Service Provider / Vendor"}
                  </label>
                  <Input
                    placeholder="Merchant name"
                    value={editableValues.vendor || ""}
                    onChange={(e) => setEditableValues({ ...editableValues, vendor: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {mode === "fuel" ? "Receipt / Bill #" : "Invoice #"}
                  </label>
                  <Input
                    placeholder="e.g. 10492"
                    value={editableValues.invoiceNumber || ""}
                    onChange={(e) => setEditableValues({ ...editableValues, invoiceNumber: e.target.value })}
                  />
                </div>

                {mode === "fuel" ? (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Quantity ({editableValues.quantityUnit || "L"})
                        {editableValues.fieldOrigins?.quantity && <span className="text-[10px] text-orange-600 font-bold"> ({editableValues.fieldOrigins.quantity})</span>}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={editableValues.quantity ?? ""}
                        onChange={(e) => {
                          const q = parseFloat(e.target.value) || 0;
                          const rate = editableValues.ratePerUnit || 0;
                          setEditableValues({
                            ...editableValues,
                            quantity: q,
                            totalAmount: q > 0 && rate > 0 ? Math.round(q * rate * 100) / 100 : editableValues.totalAmount,
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Price per {editableValues.quantityUnit || "L"} (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={editableValues.ratePerUnit ?? ""}
                        onChange={(e) => {
                          const r = parseFloat(e.target.value) || 0;
                          const q = editableValues.quantity || 0;
                          setEditableValues({
                            ...editableValues,
                            ratePerUnit: r,
                            totalAmount: q > 0 && r > 0 ? Math.round(q * r * 100) / 100 : editableValues.totalAmount,
                          });
                        }}
                      />
                    </div>
                  </>
                ) : null}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1 text-slate-900 font-bold">
                    Total Amount (₹) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="font-bold font-mono text-[#0B1E36]"
                    value={editableValues.totalAmount ?? ""}
                    onChange={(e) => setEditableValues({ ...editableValues, totalAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Odometer (km)
                    {editableValues.fieldOrigins?.odometerKm && <span className="text-[10px] text-orange-600 font-bold"> ({editableValues.fieldOrigins.odometerKm})</span>}
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 52400"
                    value={editableValues.odometerKm ?? ""}
                    onChange={(e) => setEditableValues({ ...editableValues, odometerKm: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {mode === "maintenance" && (
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Description of Work / Items</label>
                    <Input
                      placeholder="e.g. Engine oil replacement and filter change"
                      value={editableValues.description || ""}
                      onChange={(e) => setEditableValues({ ...editableValues, description: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isScanning}>
            Cancel
          </Button>

          {!extractedData ? (
            <Button
              size="sm"
              onClick={handleScan}
              disabled={isScanning || (!receiptFile && !meterFile && !odometerFile)}
              className="bg-[#F26522] hover:bg-[#EA580C] text-white"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract with DeepSeek AI
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConfirm}
              className="bg-[#0B1E36] hover:bg-slate-800 text-white font-bold"
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
              Confirm &amp; Use Extracted Values
            </Button>
          )}
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
