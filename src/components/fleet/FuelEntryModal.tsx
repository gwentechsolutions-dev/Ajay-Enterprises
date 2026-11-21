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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { AiScanModal, ExtractedValues } from "./AiScanModal";

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
}

export function FuelEntryModal({
  isOpen,
  onClose,
  onSaved,
  vehicles,
}: FuelEntryModalProps) {
  const [vehicleId, setVehicleId] = React.useState<string>("");
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

  // Attachments & AI tracking
  const [receiptDocumentUrl, setReceiptDocumentUrl] = React.useState<string>("");
  const [meterDocumentUrl, setMeterDocumentUrl] = React.useState<string>("");
  const [odometerDocumentUrl, setOdometerDocumentUrl] = React.useState<string>("");
  const [aiScanned, setAiScanned] = React.useState<boolean>(false);
  const [aiScanOpen, setAiScanOpen] = React.useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [formError, setFormError] = React.useState<string>("");
  const [formWarnings, setFormWarnings] = React.useState<string[]>([]);

  // Fetch last odometer when vehicle changes
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

  const vehicleOptions: ComboboxOption[] = vehicles.map((v) => ({
    value: v.id,
    label: `${v.vehicleNumber} (${v.make} ${v.model})`,
    sublabel: `Odo: ${Number(v.currentOdometer).toLocaleString()} km · Fuel: ${v.fuelType}`,
  }));

  const totalCost =
    typeof quantityLitres === "number" && typeof pricePerUnit === "number" && quantityLitres > 0 && pricePerUnit > 0
      ? Math.round(quantityLitres * pricePerUnit * 100) / 100
      : 0;

  const handleApplyAiExtraction = (ext: ExtractedValues) => {
    setAiScanned(true);
    if (ext.date) setFuelDate(ext.date);
    if (ext.vendor) setFuelStation(ext.vendor);
    if (ext.invoiceNumber) setReceiptNumber(ext.invoiceNumber);
    if (ext.fuelType) setFuelType(ext.fuelType);
    if (ext.quantity != null) setQuantityLitres(ext.quantity);
    if (ext.ratePerUnit != null) setPricePerUnit(ext.ratePerUnit);
    if (ext.odometerKm != null) setOdometerReading(ext.odometerKm);
    if (ext.receiptDocumentUrl) setReceiptDocumentUrl(ext.receiptDocumentUrl);
    if (ext.meterDocumentUrl) setMeterDocumentUrl(ext.meterDocumentUrl);
    if (ext.odometerDocumentUrl) setOdometerDocumentUrl(ext.odometerDocumentUrl);
    if (ext.warnings && ext.warnings.length > 0) setFormWarnings(ext.warnings);
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
          remarks: remarks.trim() || null,
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

      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[FuelEntryModal Submit Error]", err);
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-6 py-4 bg-[#0B1E36] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F26522] flex items-center justify-center text-white">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold">Record Fuel Refill &amp; Mileage</h2>
                <p className="text-xs text-slate-300">
                  {aiScanned ? "Auto-populated from DeepSeek AI Scan" : "Enter fuel log with double-entry accounting"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
                {formError}
              </div>
            )}

            {/* AI Scan Trigger Banner */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50/60 p-3.5 rounded-xl border border-orange-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F26522] text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-[#0B1E36] text-xs">
                    {aiScanned ? "AI Extraction Applied" : "Scan Fuel Receipt / Meter with AI"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {aiScanned
                      ? "Receipt values verified. You can edit any field below."
                      : "Automatically extract liters, rate, total, date & meter reading"}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAiScanOpen(true)}
                className="bg-[#F26522] hover:bg-[#EA580C] text-white text-xs font-bold shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {aiScanned ? "Rescan" : "Scan AI"}
              </Button>
            </div>

            {/* Vehicle Selector (SearchableCombobox per rule 5) */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Company Vehicle *</label>
              <SearchableCombobox
                options={vehicleOptions}
                value={vehicleId}
                onChange={(val) => setVehicleId(val)}
                placeholder="Search and choose company vehicle..."
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fuel Date *</label>
                <Input
                  type="date"
                  value={fuelDate}
                  onChange={(e) => setFuelDate(e.target.value)}
                  required
                />
              </div>

              <div>
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
              <Input
                type="number"
                step="1"
                placeholder="e.g. 48250"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value === "" ? "" : parseFloat(e.target.value))}
                required
              />

              {showOdoWarning && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1.5">
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
              <div>
                <label className="font-bold text-slate-700 block mb-1">Quantity (Litres/kg) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={quantityLitres}
                  onChange={(e) => setQuantityLitres(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Price per Litre (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="98.50"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-slate-900">Total Cost (₹)</label>
                <div className="h-9 px-3 flex items-center bg-slate-100 rounded-md font-mono font-bold text-[#0B1E36] border border-slate-200">
                  ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Fuel Station / Vendor</label>
                <Input
                  placeholder="e.g. Indian Oil, Hosur Road"
                  value={fuelStation}
                  onChange={(e) => setFuelStation(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Receipt / Slip Number</label>
                <Input
                  placeholder="e.g. REC-89214"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
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
                />
              </div>

              <div>
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

            {/* Document attachment links preview if scanned */}
            {receiptDocumentUrl && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-slate-600 font-mono truncate">
                  <Receipt className="w-3.5 h-3.5 text-[#F26522]" />
                  <span>Receipt Attached: {receiptDocumentUrl}</span>
                </div>
                <a
                  href={receiptDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F26522] hover:underline font-bold"
                >
                  View
                </a>
              </div>
            )}

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
          </form>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !vehicleId || totalCost <= 0}
              className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold"
            >
              {isSubmitting ? "Recording…" : "Save Fuel Entry"}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Scanner Sub-Modal */}
      <AiScanModal
        isOpen={aiScanOpen}
        onClose={() => setAiScanOpen(false)}
        onExtracted={handleApplyAiExtraction}
        vehicleId={vehicleId}
        vehicleNumber={selectedVehicle?.vehicleNumber}
        mode="fuel"
      />
    </>
  );
}
