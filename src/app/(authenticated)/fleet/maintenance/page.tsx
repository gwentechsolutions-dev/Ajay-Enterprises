"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wrench,
  Plus,
  RefreshCw,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  FileText,
  IndianRupee,
  Sparkles,
  Receipt,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Car,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/loading-states";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { MaintenanceExpenseModal } from "@/components/fleet/MaintenanceExpenseModal";
import { AiScanModal, ExtractedValues } from "@/components/fleet/AiScanModal";
import { ModalPortal } from "@/components/ui/portal";

export default function FleetMaintenancePage() {
  const [activeTab, setActiveTab] = React.useState<"JOBS" | "EXPENSES">("JOBS");
  const [records, setRecords] = React.useState<any[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Modals
  const [showEntryModal, setShowEntryModal] = React.useState(false);
  const [showAiScanModal, setShowAiScanModal] = React.useState(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, eRes, vRes] = await Promise.all([
        fetch(`/api/v1/fleet/maintenance${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ""}`),
        fetch(`/api/v1/fleet/expenses${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ""}`),
        fetch("/api/v1/fleet/vehicles?status=ACTIVE"),
      ]);
      const [mData, eData, vData] = await Promise.all([mRes.json(), eRes.json(), vRes.json()]);
      if (mData.success) setRecords(mData.data || []);
      if (eData.success) setExpenses(eData.data || []);
      if (vData.success) setVehicles(vData.data || []);
    } catch (err) {
      console.error("Failed to load maintenance records", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [selectedVehicleId]);

  const handleAiExtracted = (ext: ExtractedValues) => {
    setShowEntryModal(true);
  };

  // Filtered maintenance job records
  const filteredRecords = React.useMemo(() => {
    let list = records;
    if (selectedVehicleId) list = list.filter((r) => r.vehicleId === selectedVehicleId);
    if (selectedCategory) list = list.filter((r) => r.serviceCategory === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.recordNumber?.toLowerCase().includes(q) ||
          r.vehicle?.vehicleNumber?.toLowerCase().includes(q) ||
          r.serviceProvider?.toLowerCase().includes(q) ||
          r.descriptionOfWork?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, selectedVehicleId, selectedCategory, searchQuery]);

  // Filtered general expenses
  const filteredExpenses = React.useMemo(() => {
    let list = expenses;
    if (selectedVehicleId) list = list.filter((e) => e.vehicleId === selectedVehicleId);
    if (selectedCategory) list = list.filter((e) => e.expenseCategory === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.expenseNumber?.toLowerCase().includes(q) ||
          e.vehicle?.vehicleNumber?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.paymentReference?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [expenses, selectedVehicleId, selectedCategory, searchQuery]);

  const totalJobCost = filteredRecords.reduce((sum, r) => sum + Number(r.totalCost), 0);
  const totalExpenseCost = filteredExpenses.reduce((sum, e) => sum + Number(e.totalAmount), 0);
  const upcomingServices = records.filter(
    (r) => r.nextServiceDate && new Date(r.nextServiceDate) >= new Date()
  ).length;

  const vehicleFilterOptions: ComboboxOption[] = [
    { value: "", label: "All Company Vehicles" },
    ...vehicles.map((v) => ({
      value: v.id,
      label: `${v.vehicleNumber} (${v.make} ${v.model})`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/fleet"
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Fleet Overview
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">
              Vehicle Maintenance &amp; Expense ERP
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-orange-100 text-[#F26522] border border-orange-200">
              DeepSeek AI Powered
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Preventive servicing, workshop invoices, tyres/batteries, insurance renewals, tolls, and operating expenses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAiScanModal(true)}
            className="bg-[#0B1E36] hover:bg-slate-800 text-white font-bold shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-orange-400" />
            AI Scan Bill
          </Button>

          <Button
            size="sm"
            onClick={() => setShowEntryModal(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Service / Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Workshop Servicing Expenditure
            </span>
            <div className="text-2xl font-bold font-mono text-[#0B1E36] mt-1.5">
              ₹{totalJobCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">General Ledger Account 5035</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F26522] flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Non-Fuel Vehicle Expenses
            </span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1.5">
              ₹{totalExpenseCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Insurance, Tolls, Fitness, Wash, etc.
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Upcoming Service Reminders
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1.5">
              {upcomingServices} Scheduled
            </div>
            <div className="text-xs text-slate-400 mt-1">Monitored thresholds</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl pt-2 gap-2 shadow-sm">
        <button
          onClick={() => setActiveTab("JOBS")}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "JOBS"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Workshop Maintenance Jobs ({records.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("EXPENSES")}
          className={`py-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "EXPENSES"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>All Non-Fuel Vehicle Expenses ({expenses.length})</span>
        </button>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="w-full sm:w-72">
              <SearchableCombobox
                options={vehicleFilterOptions}
                value={selectedVehicleId}
                onChange={(val) => setSelectedVehicleId(val)}
                placeholder="Filter by vehicle..."
              />
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search record #, vendor, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing{" "}
            <strong className="text-slate-800">
              {activeTab === "JOBS" ? filteredRecords.length : filteredExpenses.length}
            </strong>{" "}
            records
          </div>
        </div>

        {/* Tab 1: Workshop Maintenance Jobs */}
        {activeTab === "JOBS" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[900px]">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Record #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                  <th className="px-4 py-3 whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 whitespace-nowrap">Work Done</th>
                  <th className="px-4 py-3 whitespace-nowrap">Workshop / Vendor</th>
                  <th className="px-4 py-3 whitespace-nowrap">Odometer</th>
                  <th className="px-4 py-3 whitespace-nowrap">Total Cost</th>
                  <th className="px-4 py-3 whitespace-nowrap">Next Service</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <TableSkeleton columns={10} rows={5} />
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      <Wrench className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold">No maintenance job records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isAi = r.remarks?.includes("AI Extracted");
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#0B1E36] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{r.recordNumber}</span>
                            {isAi && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-[#F26522] uppercase tracking-wider">
                                AI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {new Date(r.serviceDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          {r.vehicle?.vehicleNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                            {r.serviceCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={r.descriptionOfWork}>
                          {r.descriptionOfWork}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {r.serviceProvider || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {Number(r.odometerReading).toLocaleString()} km
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-[#0B1E36] whitespace-nowrap">
                          ₹{Number(r.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-[11px]">
                          {r.nextServiceDate ? (
                            <span>
                              {new Date(r.nextServiceDate).toLocaleDateString("en-IN")}
                              {r.nextServiceOdometer && ` (${Number(r.nextServiceOdometer).toLocaleString()} km)`}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {r.invoiceDocumentUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewDocumentUrl(r.invoiceDocumentUrl)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F26522] hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Invoice
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: All Non-Fuel Vehicle Expenses */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[900px]">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Expense #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                  <th className="px-4 py-3 whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 whitespace-nowrap">Description</th>
                  <th className="px-4 py-3 whitespace-nowrap">Payment Mode</th>
                  <th className="px-4 py-3 whitespace-nowrap">Reference</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tax / GST</th>
                  <th className="px-4 py-3 whitespace-nowrap">Total Amount</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <TableSkeleton columns={10} rows={5} />
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold">No vehicle expenses recorded</p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => {
                    const isAi = e.description?.includes("AI Extracted");
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#0B1E36] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{e.expenseNumber}</span>
                            {isAi && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-[#F26522] uppercase tracking-wider">
                                AI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {new Date(e.expenseDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          {e.vehicle?.vehicleNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                            {e.expenseCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={e.description}>
                          {e.description}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">
                          {e.paymentMode}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                          {e.paymentReference || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          ₹{Number(e.taxAmount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-[#0B1E36] whitespace-nowrap">
                          ₹{Number(e.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {e.receiptDocumentUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewDocumentUrl(e.receiptDocumentUrl)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F26522] hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Entry Modal */}
      <MaintenanceExpenseModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSaved={loadData}
        vehicles={vehicles}
      />

      {/* AI Scanner Sub-Modal */}
      <AiScanModal
        isOpen={showAiScanModal}
        onClose={() => setShowAiScanModal(false)}
        onExtracted={handleAiExtracted}
        vehicleId={selectedVehicleId}
        mode="maintenance"
      />

      {/* Document Preview Modal */}
      {previewDocumentUrl && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-[#0B1E36]">Document Attachment Preview</h3>
                <button
                  onClick={() => setPreviewDocumentUrl(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Close
                </button>
              </div>
              <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center min-h-[250px]">
                {previewDocumentUrl.endsWith(".pdf") ? (
                  <iframe src={previewDocumentUrl} className="w-full h-80" />
                ) : (
                  <img
                    src={previewDocumentUrl}
                    alt="Invoice"
                    className="max-h-96 w-auto object-contain"
                  />
                )}
              </div>
              <div className="flex justify-between items-center text-xs">
                <a
                  href={previewDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F26522] hover:underline font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open original in new tab
                </a>
                <Button size="sm" variant="outline" onClick={() => setPreviewDocumentUrl(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
