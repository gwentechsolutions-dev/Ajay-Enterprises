"use client";

import * as React from "react";
import {
  Fuel,
  Sparkles,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  IndianRupee,
  Gauge,
  Receipt,
  RotateCcw,
  Camera,
  Upload,
  Keyboard,
  ArrowLeft,
  ScanLine,
  ChevronDown,
  Check,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { ModalPortal } from "@/components/ui/portal";
import { OdometerInputWithScan } from "./OdometerInputWithScan";

export type FlowStep = "method" | "scan_fuel" | "scan_odometer" | "review" | "saved";

const SCAN_MESSAGES_BY_TYPE: Record<string, string[]> = {
  fuel_receipt: [
    "Reading the fuel receipt…",
    "Detecting fuel quantity & price…",
    "Extracting station & tax details…",
    "Verifying the readings…",
    "Almost done…",
  ],
  pump_meter: [
    "Reading the pump display…",
    "Detecting dispenser volume…",
    "Checking rate per unit…",
    "Verifying the readings…",
    "Almost done…",
  ],
  odometer: [
    "Reading the instrument cluster…",
    "Detecting total odometer reading…",
    "Filtering out trip meters…",
    "Verifying reading…",
    "Almost done…",
  ],
};

interface FuelEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicles: Array<{
    id: string;
    vehicleNumber: string;
    make: string;
    model: string;
    fuelType: string;
    currentOdometer: any;
  }>;
  initialStep?: FlowStep;
  defaultVehicleId?: string;
}

export function FuelEntryModal({
  isOpen,
  onClose,
  onSaved,
  vehicles = [],
  initialStep = "method",
  defaultVehicleId,
}: FuelEntryModalProps) {
  // Step progression
  const [step, setStep] = React.useState<FlowStep>(initialStep);
  const [scanType, setScanType] = React.useState<"fuel_receipt" | "pump_meter">("fuel_receipt");

  // Selected Vehicle
  const [vehicleId, setVehicleId] = React.useState<string>(() => {
    if (defaultVehicleId && vehicles.some((v) => v.id === defaultVehicleId)) return defaultVehicleId;
    return vehicles[0]?.id || "";
  });
  const [vehiclePickerOpen, setVehiclePickerOpen] = React.useState<boolean>(false);

  // Form Fields
  const [fuelDate, setFuelDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fuelType, setFuelType] = React.useState<string>("DIESEL");
  const [fuelStation, setFuelStation] = React.useState<string>("");
  const [receiptNumber, setReceiptNumber] = React.useState<string>("");
  const [quantityLitres, setQuantityLitres] = React.useState<number | "">("");
  const [pricePerUnit, setPricePerUnit] = React.useState<number | "">(98.5);
  const [odometerReading, setOdometerReading] = React.useState<number | "">("");
  const [isFullTank, setIsFullTank] = React.useState<boolean>(true);
  const [paymentMode, setPaymentMode] = React.useState<string>("CASH");
  const [postToAccounts, setPostToAccounts] = React.useState<boolean>(true);
  const [remarks, setRemarks] = React.useState<string>("");

  // Odometer context & reset confirmation
  const [lastOdometerKm, setLastOdometerKm] = React.useState<number | null>(null);
  const [allowOdometerReset, setAllowOdometerReset] = React.useState<boolean>(false);
  const [showOdoWarning, setShowOdoWarning] = React.useState<boolean>(false);

  // Scan Previews & URLs
  const [fuelPreviewUrl, setFuelPreviewUrl] = React.useState<string | null>(null);
  const [odoPreviewUrl, setOdoPreviewUrl] = React.useState<string | null>(null);
  const [receiptDocumentUrl, setReceiptDocumentUrl] = React.useState<string>("");
  const [meterDocumentUrl, setMeterDocumentUrl] = React.useState<string>("");
  const [odometerDocumentUrl, setOdometerDocumentUrl] = React.useState<string>("");
  const [aiScanned, setAiScanned] = React.useState<boolean>(false);

  // Scanning State
  const [isScanning, setIsScanning] = React.useState<boolean>(false);
  const [scanningMessage, setScanningMessage] = React.useState<string>("Analyzing image with DeepSeek AI…");
  const [scanError, setScanError] = React.useState<string>("");
  const [dragActive, setDragActive] = React.useState<boolean>(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [formError, setFormError] = React.useState<string>("");
  const [formWarnings, setFormWarnings] = React.useState<string[]>([]);
  const [savedResult, setSavedResult] = React.useState<any>(null);

  // Hidden File Inputs
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync initialStep when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setFormError("");
      setScanError("");
      setSavedResult(null);
    }
  }, [isOpen, initialStep]);

  // Set default vehicle if none selected
  React.useEffect(() => {
    if (!vehicleId && vehicles.length > 0) {
      setVehicleId(vehicles[0].id);
    }
  }, [vehicles, vehicleId]);

  // Fetch last recorded odometer when vehicle changes
  React.useEffect(() => {
    if (!vehicleId) {
      setLastOdometerKm(null);
      return;
    }

    const selected = vehicles.find((v) => v.id === vehicleId);
    if (selected) {
      setFuelType(selected.fuelType || "DIESEL");
    }

    fetch(`/api/v1/fleet/vehicles/${vehicleId}/last-odometer`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.lastOdometerKm != null) {
          const lastOdo = Number(data.data.lastOdometerKm);
          setLastOdometerKm(lastOdo);
          if (odometerReading === "") {
            setOdometerReading(lastOdo);
          }
        }
      })
      .catch((err) => console.error("Error fetching last odometer", err));
  }, [vehicleId, vehicles]);

  // Rotating scanning status messages
  React.useEffect(() => {
    if (!isScanning) return;
    const currentScanType = step === "scan_odometer" ? "odometer" : scanType;
    const messages = SCAN_MESSAGES_BY_TYPE[currentScanType] || SCAN_MESSAGES_BY_TYPE.fuel_receipt;
    let idx = 0;
    setScanningMessage(messages[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setScanningMessage(messages[idx]);
    }, 1400);
    return () => clearInterval(timer);
  }, [isScanning, step, scanType]);

  // Check odometer regression
  React.useEffect(() => {
    if (lastOdometerKm != null && odometerReading !== "" && Number(odometerReading) < lastOdometerKm) {
      setShowOdoWarning(true);
    } else {
      setShowOdoWarning(false);
      setAllowOdometerReset(false);
    }
  }, [odometerReading, lastOdometerKm]);

  if (!isOpen) return null;

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || vehicles[0];

  const totalCost =
    typeof quantityLitres === "number" && typeof pricePerUnit === "number" && quantityLitres > 0 && pricePerUnit > 0
      ? Math.round(quantityLitres * pricePerUnit * 100) / 100
      : 0;

  // Handle Scan Upload & Immediate Auto-Progression
  const handleScanFile = async (file: File, type: "fuel_receipt" | "pump_meter" | "odometer") => {
    if (!file) return;
    setIsScanning(true);
    setScanError("");
    const preview = URL.createObjectURL(file);
    if (type === "odometer") {
      setOdoPreviewUrl(preview);
    } else {
      setFuelPreviewUrl(preview);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scanType", type);
      if (vehicleId) formData.append("vehicleId", vehicleId);

      const res = await fetch("/api/v1/fleet/scan", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to scan image.");
      }

      const { fields, file: uploadedFile, fileUrl, odometerFileUrl, receiptFileUrl, warnings } = json.data;
      if (warnings && warnings.length > 0) {
        setFormWarnings((prev) => [...prev, ...warnings]);
      }

      setAiScanned(true);

      const resolvedUrl = odometerFileUrl || fileUrl || receiptFileUrl || uploadedFile?.url;
      if (type === "odometer") {
        if (fields.odometerKm != null) {
          setOdometerReading(Number(fields.odometerKm));
        }
        if (resolvedUrl) {
          setOdometerDocumentUrl(resolvedUrl);
        }
        setIsScanning(false);
        // Step 3 -> Step 4: Immediately and automatically move to Review!
        setStep("review");
      } else {
        // Step 2 -> Step 3: Fuel receipt or pump meter
        if (fields.date) setFuelDate(fields.date);
        if (fields.vendor) setFuelStation(fields.vendor);
        if (fields.invoiceNumber) setReceiptNumber(fields.invoiceNumber);
        if (fields.fuelType) setFuelType(fields.fuelType);
        if (fields.quantity != null) setQuantityLitres(Number(fields.quantity));
        if (fields.ratePerUnit != null) setPricePerUnit(Number(fields.ratePerUnit));
        if (uploadedFile?.url) {
          if (type === "pump_meter") {
            setMeterDocumentUrl(uploadedFile.url);
          } else {
            setReceiptDocumentUrl(uploadedFile.url);
          }
        }
        setIsScanning(false);
        // Step 2 -> Step 3: Immediately and automatically open scan odometer screen!
        setStep("scan_odometer");
      }
    } catch (err: any) {
      console.error("[AI Scan Error]", err);
      setIsScanning(false);
      setScanError(err.message || "Could not analyze the image. Please try again or enter details manually.");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: "fuel_receipt" | "pump_meter" | "odometer") => {
    const file = e.target.files?.[0];
    if (file) handleScanFile(file, type);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent, type: "fuel_receipt" | "pump_meter" | "odometer") => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleScanFile(file, type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      setFormError("Please select a company vehicle.");
      return;
    }
    if (quantityLitres === "" || quantityLitres <= 0) {
      setFormError("Please enter a valid fuel quantity.");
      return;
    }
    if (pricePerUnit === "" || pricePerUnit <= 0) {
      setFormError("Please enter a valid price per unit.");
      return;
    }
    if (odometerReading === "" || odometerReading < 0) {
      setFormError("Please enter a valid odometer reading.");
      return;
    }
    if (showOdoWarning && !allowOdometerReset) {
      setFormError("Current odometer is lower than last recorded reading. Please check the reading or confirm an odometer reset.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/fleet/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          fuelDate,
          fuelType,
          fuelStation: fuelStation.trim() || null,
          receiptNumber: receiptNumber.trim() || null,
          quantityLitres: Number(quantityLitres),
          pricePerUnit: Number(pricePerUnit),
          odometerReading: Number(odometerReading),
          allowOdometerReset,
          isFullTank,
          paymentMode,
          postToAccounts,
          remarks: remarks.trim() || (aiScanned ? "AI Scanned Entry" : null),
          receiptDocumentUrl: receiptDocumentUrl || null,
          meterDocumentUrl: meterDocumentUrl || null,
          odometerDocumentUrl: odometerDocumentUrl || null,
          aiScanned,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to record fuel log.");
      }

      setSavedResult(json.data);
      setStep("saved");
    } catch (err: any) {
      console.error("[FuelEntryModal Submit Error]", err);
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForAnother = () => {
    setStep("method");
    setQuantityLitres("");
    setReceiptNumber("");
    setFuelStation("");
    setFuelPreviewUrl(null);
    setOdoPreviewUrl(null);
    setReceiptDocumentUrl("");
    setMeterDocumentUrl("");
    setOdometerDocumentUrl("");
    setAiScanned(false);
    setFormError("");
    setScanError("");
    setSavedResult(null);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
        
        {/* Hidden File Inputs for Camera vs Gallery Upload */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileInputChange(e, step === "scan_odometer" ? "odometer" : scanType)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFileInputChange(e, step === "scan_odometer" ? "odometer" : scanType)}
        />

        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#0B1E36] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F26522] flex items-center justify-center text-white shadow-sm">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold">Quick Fuel Log</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[#F26522] text-white">
                  AI VISION
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {selectedVehicle
                  ? `${selectedVehicle.vehicleNumber} · AJAY ENTERPRISES`
                  : "AJAY ENTERPRISES Company Fleet"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Container */}
        <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4 flex-1 text-xs">
          
          {/* Top Vehicle Card (Always visible across all steps) */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F26522] flex items-center justify-center shrink-0">
                <Fuel className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-[#0B1E36] text-xs sm:text-sm tracking-tight truncate">
                  {selectedVehicle?.vehicleNumber || "Select Vehicle"}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">
                  {selectedVehicle?.make} {selectedVehicle?.model} · {selectedVehicle?.fuelType || "Diesel"}
                  {lastOdometerKm != null && ` · Last: ${lastOdometerKm.toLocaleString()} km`}
                </div>
              </div>
            </div>

            {vehicles.length > 1 && (
              <button
                type="button"
                onClick={() => setVehiclePickerOpen(!vehiclePickerOpen)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 transition-all shrink-0"
              >
                <span>Change</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${vehiclePickerOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          {/* Vehicle Dropdown Selector when 'Change' is clicked */}
          {vehiclePickerOpen && (
            <div className="bg-white border border-slate-200 rounded-2xl p-2 divide-y divide-slate-100 shadow-lg animate-in fade-in-50">
              {vehicles.map((v) => {
                const isSelected = v.id === vehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVehicleId(v.id);
                      setVehiclePickerOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                      isSelected ? "bg-orange-50/80 text-[#F26522]" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{v.vehicleNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {v.make} {v.model} · {v.fuelType} · Odo: {Number(v.currentOdometer).toLocaleString()} km
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#F26522]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: METHOD SELECTION (Matches UnblockNow Image 2 & Image 5)          */}
          {/* ========================================================================= */}
          {step === "method" && (
            <div className="space-y-3 pt-1 animate-in fade-in-50">
              <div className="text-center sm:text-left">
                <h3 className="text-sm font-extrabold text-[#0B1E36]">How would you like to capture it?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  DeepSeek AI scans your receipt or pump display and auto-extracts liters, rate, and total cost.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* Option 1: Scan Fuel Receipt */}
                <button
                  type="button"
                  onClick={() => {
                    setScanType("fuel_receipt");
                    setStep("scan_fuel");
                  }}
                  className="w-full text-left p-4 rounded-2xl border-2 border-orange-500/90 bg-orange-50/50 hover:bg-orange-50 flex items-start gap-3.5 transition-all shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#F26522] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">Scan fuel receipt</span>
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-orange-100 text-[#F26522]">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                      The printed slip or tax bill from the fuel station.
                    </p>
                  </div>
                </button>

                {/* Option 2: Scan Pump Meter */}
                <button
                  type="button"
                  onClick={() => {
                    setScanType("pump_meter");
                    setStep("scan_fuel");
                  }}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 flex items-start gap-3.5 transition-all shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-sm text-slate-900 block">Scan the pump meter</span>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      The dispenser display showing volume in litres, rate and total amount.
                    </p>
                  </div>
                </button>

                {/* Option 3: Enter Manually */}
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 flex items-start gap-3.5 transition-all shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-sm text-slate-900 block">Enter details manually</span>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Skip AI scanning and type the litres, rate and amount yourself.
                    </p>
                  </div>
                </button>
              </div>

              <div className="pt-2 text-center">
                <span className="text-[11px] text-slate-400 font-medium">
                  Protected with Double-Entry General Ledger Guarantee · Account 5030
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SCAN FUEL RECEIPT / PUMP METER (Matches UnblockNow Image 3)      */}
          {/* ========================================================================= */}
          {step === "scan_fuel" && (
            <div className="space-y-4 pt-1 animate-in fade-in-50">
              <button
                type="button"
                onClick={() => setStep("method")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to method choice
              </button>

              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-base font-extrabold text-[#0B1E36]">
                    {scanType === "pump_meter" ? "Scan the pump meter" : "Scan fuel receipt"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {scanType === "pump_meter"
                      ? "Photograph the fuel dispenser screen showing volume in litres, price and total."
                      : "Fill the frame and keep it flat and well lit. Cropping close to the printed figures gives the best result."}
                  </p>
                </div>

                {/* Drag & Drop Capture Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => handleDrop(e, scanType)}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                    dragActive
                      ? "border-[#F26522] bg-orange-50/50"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  {isScanning ? (
                    <div className="space-y-3 py-4">
                      {fuelPreviewUrl && (
                        <div className="w-20 h-24 mx-auto rounded-xl overflow-hidden border-2 border-[#F26522] shadow-md relative">
                          <img src={fuelPreviewUrl} alt="Scanning" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-[#F26522]/20 animate-pulse" />
                        </div>
                      )}
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-[#F26522] font-bold text-xs animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{scanningMessage}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">DeepSeek AI vision is analyzing the image</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto text-[#F26522]">
                        <ScanLine className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Take a photo, choose one from your gallery, or drop an image here.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG or WebP, up to 10 MB.</p>
                      </div>

                      {scanError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium text-left">
                          {scanError}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full sm:w-auto bg-[#F26522] hover:bg-[#EA580C] text-white font-bold text-xs px-5 shadow-sm"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Use camera
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full sm:w-auto border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("scan_odometer")}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Enter the details manually instead</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SCAN CURRENT ODOMETER (Matches UnblockNow Image 4)                */}
          {/* ========================================================================= */}
          {step === "scan_odometer" && (
            <div className="space-y-4 pt-1 animate-in fade-in-50">
              <button
                type="button"
                onClick={() => setStep("scan_fuel")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to fuel document
              </button>

              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-base font-extrabold text-[#0B1E36]">Scan current odometer</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Make sure the total odometer is visible and in focus. Trip meters (TRIP A / TRIP B) are a different reading.
                  </p>
                </div>

                {/* Drag & Drop Capture Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => handleDrop(e, "odometer")}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                    dragActive
                      ? "border-[#F26522] bg-orange-50/50"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  {isScanning ? (
                    <div className="space-y-3 py-4">
                      {odoPreviewUrl && (
                        <div className="w-20 h-24 mx-auto rounded-xl overflow-hidden border-2 border-[#F26522] shadow-md relative">
                          <img src={odoPreviewUrl} alt="Scanning" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-[#F26522]/20 animate-pulse" />
                        </div>
                      )}
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-[#F26522] font-bold text-xs animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{scanningMessage}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">DeepSeek AI vision is reading total kilometers</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto text-[#F26522]">
                        <Gauge className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Take a photo, choose one from your gallery, or drop an image here.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG or WebP, up to 10 MB.</p>
                      </div>

                      {scanError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium text-left">
                          {scanError}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full sm:w-auto bg-[#F26522] hover:bg-[#EA580C] text-white font-bold text-xs px-5 shadow-sm"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Use camera
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full sm:w-auto border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Links */}
                <div className="flex items-center justify-between text-xs font-bold pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("review")}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Enter the details manually instead</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("review")}
                    className="text-slate-400 hover:text-slate-700 underline"
                  >
                    Skip for now
                  </button>
                </div>

                {/* Mileage Warning Callout (Matches Image 4) */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-900 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Without an odometer reading this entry cannot contribute to your mileage tracking.</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: REVIEW & CONFIRM (Review Form & Save)                              */}
          {/* ========================================================================= */}
          {step === "review" && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("scan_odometer")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to odometer scan
                </button>
                {aiScanned && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-[#F26522] border border-orange-200">
                    AI Extracted · Please verify values
                  </span>
                )}
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              {/* Scanned Attachments Preview Pill Bar */}
              {(fuelPreviewUrl || odoPreviewUrl || receiptDocumentUrl || odometerDocumentUrl) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    {fuelPreviewUrl && (
                      <div className="flex items-center gap-2">
                        <img src={fuelPreviewUrl} alt="Receipt" className="w-8 h-8 rounded-lg object-cover border" />
                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">Fuel Document</div>
                          <button
                            type="button"
                            onClick={() => {
                              setScanType("fuel_receipt");
                              setStep("scan_fuel");
                            }}
                            className="text-[10px] text-[#F26522] hover:underline font-bold"
                          >
                            Rescan
                          </button>
                        </div>
                      </div>
                    )}
                    {odoPreviewUrl && (
                      <div className="flex items-center gap-2">
                        <img src={odoPreviewUrl} alt="Odometer" className="w-8 h-8 rounded-lg object-cover border" />
                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">Odometer</div>
                          <button
                            type="button"
                            onClick={() => setStep("scan_odometer")}
                            className="text-[10px] text-[#F26522] hover:underline font-bold"
                          >
                            Rescan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">2 files attached</span>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Fuel Date *</label>
                  <Input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>

                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Fuel Type *</label>
                  <SearchableCombobox
                    options={[
                      { value: "DIESEL", label: "Diesel (HSD)" },
                      { value: "PETROL", label: "Petrol (MS)" },
                      { value: "CNG", label: "CNG" },
                      { value: "ELECTRIC", label: "Electric" },
                    ]}
                    value={fuelType}
                    onChange={(val) => setFuelType(val)}
                    allowClear={false}
                    showSearch={false}
                    popoverClassName="w-full min-w-full"
                    align="right"
                  />
                </div>
              </div>

              {/* Odometer Reading with Regression Warning */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Current Odometer (km) *</label>
                  {lastOdometerKm != null && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Last recorded: {lastOdometerKm.toLocaleString()} km
                    </span>
                  )}
                </div>
                <OdometerInputWithScan
                  step="1"
                  placeholder="e.g. 48250"
                  value={odometerReading}
                  vehicleId={vehicleId || undefined}
                  onChange={(val) => setOdometerReading(val === "" ? "" : parseFloat(val))}
                  onScanSuccess={({ odometerKm, fileUrl }) => {
                    setOdometerReading(odometerKm);
                    if (fileUrl) setOdometerDocumentUrl(fileUrl);
                    setAiScanned(true);
                  }}
                  required
                />

                {showOdoWarning && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      Odometer reading is lower than previous reading ({lastOdometerKm?.toLocaleString()} km)
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={allowOdometerReset}
                        onChange={(e) => setAllowOdometerReset(e.target.checked)}
                        className="rounded text-[#F26522] focus:ring-[#F26522]"
                      />
                      <span className="text-[11px] font-semibold text-amber-900">
                        Confirm odometer cluster replacement / reset
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Quantity, Rate, Total */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1 truncate">Quantity (Litres/kg) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={quantityLitres}
                    onChange={(e) => setQuantityLitres(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    required
                    className="w-full"
                  />
                </div>

                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1 truncate">Price per Litre (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="98.50"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    required
                    className="w-full"
                  />
                </div>

                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1 text-slate-900 truncate">Total Cost (₹)</label>
                  <div className="h-9 px-3 flex items-center bg-slate-100 rounded-md font-mono font-bold text-[#0B1E36] border border-slate-200 truncate">
                    ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Fuel Station / Vendor</label>
                  <Input
                    placeholder="e.g. Indian Oil, Hosur Road"
                    value={fuelStation}
                    onChange={(e) => setFuelStation(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Receipt / Slip Number</label>
                  <Input
                    placeholder="e.g. REC-89214"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <SearchableCombobox
                    options={[
                      { value: "CASH", label: "Cash" },
                      { value: "UPI", label: "UPI / QR Payment" },
                      { value: "BANK_TRANSFER", label: "Bank Account Transfer" },
                      { value: "CHEQUE", label: "Cheque" },
                    ]}
                    value={paymentMode}
                    onChange={(val) => setPaymentMode(val)}
                    allowClear={false}
                    showSearch={false}
                    popoverClassName="w-full min-w-full"
                  />
                </div>

                <div className="min-w-0">
                  <label className="font-bold text-slate-700 block mb-1">Full Tank Refill?</label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fullTank"
                        checked={isFullTank}
                        onChange={() => setIsFullTank(true)}
                        className="text-[#F26522] focus:ring-[#F26522]"
                      />
                      <span className="font-semibold text-slate-800">Yes (Full Tank)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fullTank"
                        checked={!isFullTank}
                        onChange={() => setIsFullTank(false)}
                        className="text-[#F26522] focus:ring-[#F26522]"
                      />
                      <span className="font-semibold text-slate-800">Partial Refill</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Accounting Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postToAccounts}
                    onChange={(e) => setPostToAccounts(e.target.checked)}
                    className="rounded text-[#F26522] focus:ring-[#F26522]"
                  />
                  <span className="font-bold text-[#0B1E36]">
                    Post double-entry voucher to General Ledger (Account 5030)
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 pl-5">
                  Automatically debits Account 5030 (Transport &amp; Vehicle Fuel Costs) and credits the selected payment account.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={isSubmitting || !vehicleId || totalCost <= 0}
                  className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold px-6 shadow-sm"
                >
                  {isSubmitting ? "Saving fuel log…" : "Save Fuel Entry"}
                </Button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: SAVED SUCCESS SCREEN                                              */}
          {/* ========================================================================= */}
          {step === "saved" && (
            <div className="py-6 text-center space-y-4 animate-in fade-in-50">
              <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Fuel Log Saved Successfully</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Recorded against vehicle {selectedVehicle?.vehicleNumber}. General Ledger voucher created on Account 5030.
                </p>
              </div>

              {savedResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-sm mx-auto text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Log Number:</span>
                    <span className="font-mono font-bold text-[#0B1E36]">{savedResult.logNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-mono font-bold text-[#0B1E36]">
                      ₹{Number(savedResult.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {savedResult.mileageKmPerLitre != null && (
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="font-bold text-emerald-700">Calculated Mileage:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {Number(savedResult.mileageKmPerLitre).toFixed(2)} km/L
                      </span>
                    </div>
                  )}
                  {savedResult.distanceTravelled != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Distance Travelled:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {Number(savedResult.distanceTravelled).toLocaleString()} km
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <Button
                  type="button"
                  onClick={resetForAnother}
                  className="w-full sm:w-auto bg-[#F26522] hover:bg-[#EA580C] text-white font-bold text-xs px-6"
                >
                  Log Another Refill
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onSaved();
                    onClose();
                  }}
                  className="w-full sm:w-auto border-slate-200 text-slate-700 font-bold text-xs px-6"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
