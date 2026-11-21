"use client";

import * as React from "react";
import {
  Wrench,
  Sparkles,
  Receipt,
  FileText,
  Calendar,
  IndianRupee,
  AlertTriangle,
  X,
  CheckCircle2,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { AiScanModal, ExtractedValues } from "./AiScanModal";

interface MaintenanceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicles: Array<{
    id: string;
    vehicleNumber: string;
    make: string;
    model: string;
    currentOdometer: any;
  }>;
}

export const MAINTENANCE_CATEGORIES = [
  { value: "REGULAR_SERVICE", label: "Scheduled Servicing / Periodic Maintenance", type: "JOB" },
  { value: "MECHANICAL_REPAIR", label: "Mechanical Repairs & Overhaul", type: "JOB" },
  { value: "ELECTRICAL_REPAIR", label: "Electrical & Wiring Repairs", type: "JOB" },
  { value: "TYRES_BATTERIES", label: "Tyres & Battery Replacements", type: "JOB" },
  { value: "SPARE_PARTS", label: "Spare Parts & Fitments", type: "JOB" },
  { value: "INSURANCE", label: "Insurance Premium Payment / Renewal", type: "EXPENSE" },
  { value: "POLLUTION_CERTIFICATE", label: "Pollution (PUC) Certificate Renewal", type: "EXPENSE" },
  { value: "PERMIT_FITNESS", label: "RTO Fitness & Permit Renewal", type: "EXPENSE" },
  { value: "VEHICLE_WASHING", label: "Vehicle Washing & Detailing", type: "EXPENSE" },
  { value: "TOLL_PARKING", label: "Tolls & Commercial Parking", type: "EXPENSE" },
  { value: "OTHER", label: "Other Vehicle-Related Expenses", type: "EXPENSE" },
] as const;

export function MaintenanceExpenseModal({
  isOpen,
  onClose,
  onSaved,
  vehicles,
}: MaintenanceExpenseModalProps) {
  const [vehicleId, setVehicleId] = React.useState<string>("");
  const [entryType, setEntryType] = React.useState<"JOB" | "EXPENSE">("JOB");
  const [category, setCategory] = React.useState<string>("REGULAR_SERVICE");
  const [serviceDate, setServiceDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = React.useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = React.useState<string>("");
  const [odometerReading, setOdometerReading] = React.useState<number | "">("");
  const [description, setDescription] = React.useState<string>("");

  // Costs
  const [partsCost, setPartsCost] = React.useState<number | "">(0);
  const [labourCost, setLabourCost] = React.useState<number | "">(0);
  const [taxAmount, setTaxAmount] = React.useState<number | "">(0);
  const [totalCost, setTotalCost] = React.useState<number | "">(0);

  // Next service thresholds (for Jobs)
  const [nextServiceDate, setNextServiceDate] = React.useState<string>("");
  const [nextServiceOdometer, setNextServiceOdometer] = React.useState<number | "">("");

  // Payment & Accounting
  const [paymentMode, setPaymentMode] = React.useState<string>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = React.useState<string>("");
  const [postToAccounts, setPostToAccounts] = React.useState<boolean>(true);
  const [remarks, setRemarks] = React.useState<string>("");

  // Document URLs & AI
  const [documentUrl, setDocumentUrl] = React.useState<string>("");
  const [aiScanned, setAiScanned] = React.useState<boolean>(false);
  const [aiScanOpen, setAiScanOpen] = React.useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [formError, setFormError] = React.useState<string>("");

  // Update odometer when vehicle selected
  React.useEffect(() => {
    if (!vehicleId) return;
    const v = vehicles.find((item) => item.id === vehicleId);
    if (v) {
      const odo = Number(v.currentOdometer);
      setOdometerReading(odo);
      setNextServiceOdometer(odo + 10000);
    }
  }, [vehicleId, vehicles]);

  // Recalculate total if parts or labour changes
  React.useEffect(() => {
    if (entryType === "JOB") {
      const p = typeof partsCost === "number" ? partsCost : 0;
      const l = typeof labourCost === "number" ? labourCost : 0;
      const t = typeof taxAmount === "number" ? taxAmount : 0;
      setTotalCost(Math.round((p + l + t) * 100) / 100);
    }
  }, [partsCost, labourCost, taxAmount, entryType]);

  if (!isOpen) return null;

  const vehicleOptions: ComboboxOption[] = vehicles.map((v) => ({
    value: v.id,
    label: `${v.vehicleNumber} (${v.make} ${v.model})`,
    sublabel: `Odo: ${Number(v.currentOdometer).toLocaleString()} km`,
  }));

  const categoryOptions: ComboboxOption[] = MAINTENANCE_CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
    badge: c.type === "JOB" ? "Workshop Job" : "Direct Expense",
  }));

  const handleCategorySelect = (catVal: string) => {
    setCategory(catVal);
    const item = MAINTENANCE_CATEGORIES.find((c) => c.value === catVal);
    if (item) {
      setEntryType(item.type);
    }
  };

  const handleApplyAiExtraction = (ext: ExtractedValues) => {
    setAiScanned(true);
    if (ext.date) setServiceDate(ext.date);
    if (ext.vendor) setVendorName(ext.vendor);
    if (ext.invoiceNumber) setInvoiceNumber(ext.invoiceNumber);
    if (ext.description) setDescription(ext.description);
    if (ext.odometerKm != null) setOdometerReading(ext.odometerKm);
    if (ext.taxAmount != null) setTaxAmount(ext.taxAmount);
    if (ext.totalAmount != null) {
      setTotalCost(ext.totalAmount);
      if (entryType === "JOB") {
        setPartsCost(ext.totalAmount);
      }
    }
    if (ext.receiptDocumentUrl || ext.fileUrl) {
      setDocumentUrl(ext.receiptDocumentUrl || ext.fileUrl || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      setFormError("Please select a company vehicle.");
      return;
    }
    const finalAmount = typeof totalCost === "number" ? totalCost : 0;
    if (finalAmount <= 0) {
      setFormError("Please enter a valid expense / service cost.");
      return;
    }
    if (!description.trim()) {
      setFormError("Please provide a description of the work or expense.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (entryType === "JOB") {
        // Record as Vehicle Maintenance Record
        const res = await fetch("/api/v1/fleet/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId,
            serviceCategory: category,
            serviceDate,
            odometerReading: Number(odometerReading) || 0,
            serviceProvider: vendorName.trim() || null,
            descriptionOfWork: description.trim(),
            partsCost: typeof partsCost === "number" ? partsCost : 0,
            labourCost: typeof labourCost === "number" ? labourCost : 0,
            taxAmount: typeof taxAmount === "number" ? taxAmount : 0,
            invoiceDocumentUrl: documentUrl || null,
            nextServiceDate: nextServiceDate || null,
            nextServiceOdometer: nextServiceOdometer !== "" ? Number(nextServiceOdometer) : null,
            invoiceNumber: invoiceNumber.trim() || null,
            remarks: remarks.trim() || null,
            postToAccounts,
            paymentMode,
            aiScanned,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || "Failed to record service job.");
      } else {
        // Record as General Vehicle Expense
        const res = await fetch("/api/v1/fleet/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId,
            expenseCategory: category,
            expenseDate: serviceDate,
            amount: finalAmount - (typeof taxAmount === "number" ? taxAmount : 0),
            taxAmount: typeof taxAmount === "number" ? taxAmount : 0,
            paymentMode,
            paymentReference: paymentReference.trim() || invoiceNumber.trim() || null,
            receiptDocumentUrl: documentUrl || null,
            description: `${vendorName ? vendorName + ": " : ""}${description.trim()}`,
            aiScanned,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || "Failed to record vehicle expense.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[MaintenanceExpenseModal Submit Error]", err);
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
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold">Record Maintenance &amp; Vehicle Expense</h2>
                <p className="text-xs text-slate-300">
                  {entryType === "JOB" ? "Workshop Servicing Record" : "Non-Fuel Operating Expense"}
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

          {/* Form Body */}
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
                    {aiScanned ? "AI Extraction Applied" : "Scan Workshop Invoice / Bill with AI"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {aiScanned
                      ? "Invoice values extracted. You can edit any field below."
                      : "DeepSeek AI extracts vendor, amount, taxes, invoice # & work description"}
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
                {aiScanned ? "Rescan" : "Scan Bill"}
              </Button>
            </div>

            {/* Vehicle Selection */}
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

            {/* Category Selection */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Expense / Service Category *</label>
              <SearchableCombobox
                options={categoryOptions}
                value={category}
                onChange={(val) => handleCategorySelect(val)}
                placeholder="Select expense category..."
                allowClear={false}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date *</label>
                <Input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {entryType === "JOB" ? "Service Odometer (km) *" : "Current Odometer (km)"}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 52400"
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  required={entryType === "JOB"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Service Provider / Workshop / Vendor
                </label>
                <Input
                  placeholder="e.g. TVS Auto Spares / Bosch Car Care"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Invoice / Receipt #</label>
                <Input
                  placeholder="e.g. INV-2026-881"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Description of Work / Expense *</label>
              <Input
                placeholder="e.g. Front brake pad replacement and wheel alignment"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Cost Breakdown */}
            {entryType === "JOB" ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Parts Cost (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={partsCost}
                    onChange={(e) => setPartsCost(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Labour Cost (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={labourCost}
                    onChange={(e) => setLabourCost(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">GST Tax (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-900 block mb-1">Total Cost (₹)</label>
                  <div className="h-9 px-3 flex items-center bg-white rounded-md font-mono font-bold text-[#0B1E36] border border-slate-300">
                    ₹{typeof totalCost === "number" ? totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Total Expense Amount (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="font-bold font-mono text-[#0B1E36]"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">GST / Tax Amount (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Next Service Thresholds for Jobs */}
            {entryType === "JOB" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Next Service Date (Optional)</label>
                  <Input
                    type="date"
                    value={nextServiceDate}
                    onChange={(e) => setNextServiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Next Service Odometer (km)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 62400"
                    value={nextServiceOdometer}
                    onChange={(e) => setNextServiceOdometer(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Payment & Ledger Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <SearchableCombobox
                  options={[
                    { value: "BANK_TRANSFER", label: "Bank Account Transfer" },
                    { value: "UPI", label: "UPI" },
                    { value: "CASH", label: "Cash" },
                    { value: "CHEQUE", label: "Cheque" },
                  ]}
                  value={paymentMode}
                  onChange={(val) => setPaymentMode(val)}
                  allowClear={false}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment / Cheque Reference</label>
                <Input
                  placeholder="e.g. UTR / Transaction ID"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>

            {/* Document preview */}
            {documentUrl && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-slate-600 font-mono truncate">
                  <FileText className="w-3.5 h-3.5 text-[#F26522]" />
                  <span>Invoice Attached: {documentUrl}</span>
                </div>
                <a href={documentUrl} target="_blank" rel="noreferrer" className="text-[#F26522] hover:underline font-bold">
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
                  Post double-entry voucher to General Ledger ({entryType === "JOB" ? "Account 5035" : "Account 5030"})
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-5">
                Automatically posts debit to {entryType === "JOB" ? "5035 (Vehicle Servicing & Maintenance)" : "5030 (Fleet Running Costs)"} and credits payment account.
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
              disabled={isSubmitting || !vehicleId || Number(totalCost) <= 0}
              className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold"
            >
              {isSubmitting ? "Recording…" : "Save Record"}
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
        mode="maintenance"
      />
    </>
  );
}
