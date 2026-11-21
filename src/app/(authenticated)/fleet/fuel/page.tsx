"use client";

import * as React from "react";
import Link from "next/link";
import {
  Fuel,
  Plus,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Receipt,
  Gauge,
  Calendar,
  FileText,
  Search,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/loading-states";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { MileageTrendChart } from "@/components/fleet/MileageTrendChart";
import { FuelEntryModal } from "@/components/fleet/FuelEntryModal";
import { AiScanModal, ExtractedValues } from "@/components/fleet/AiScanModal";
import { MileageDataPoint } from "@/lib/fleet/fuel-calculations";

export default function FleetFuelPage() {
  const [fuelLogs, setFuelLogs] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [trendData, setTrendData] = React.useState<MileageDataPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [trendLoading, setTrendLoading] = React.useState(false);

  // Filters
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [showChart, setShowChart] = React.useState<boolean>(true);

  // Modals
  const [showEntryModal, setShowEntryModal] = React.useState<boolean>(false);
  const [showDirectScanModal, setShowDirectScanModal] = React.useState<boolean>(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fRes, vRes] = await Promise.all([
        fetch(`/api/v1/fleet/fuel${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ""}`),
        fetch("/api/v1/fleet/vehicles?status=ACTIVE"),
      ]);
      const [fData, vData] = await Promise.all([fRes.json(), vRes.json()]);
      if (fData.success) setFuelLogs(fData.data || []);
      if (vData.success) setVehicles(vData.data || []);
    } catch (err) {
      console.error("Failed to load fuel data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrendData = async () => {
    setTrendLoading(true);
    try {
      const res = await fetch(
        `/api/v1/fleet/fuel/mileage-trend${selectedVehicleId ? `?vehicleId=${selectedVehicleId}` : ""}`
      );
      const data = await res.json();
      if (data.success) {
        setTrendData(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load mileage trend", err);
    } finally {
      setTrendLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
    loadTrendData();
  }, [selectedVehicleId]);

  const handleDirectScanExtracted = (ext: ExtractedValues) => {
    // Open entry modal with prefilled data
    setShowEntryModal(true);
  };

  // Filtered Fuel Logs
  const filteredLogs = React.useMemo(() => {
    let result = fuelLogs;
    if (selectedVehicleId) {
      result = result.filter((l) => l.vehicleId === selectedVehicleId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.logNumber?.toLowerCase().includes(q) ||
          l.vehicle?.vehicleNumber?.toLowerCase().includes(q) ||
          l.fuelStation?.toLowerCase().includes(q) ||
          l.remarks?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [fuelLogs, selectedVehicleId, searchQuery]);

  const totalFuelCost = filteredLogs.reduce((sum, f) => sum + Number(f.totalCost), 0);
  const totalLitres = filteredLogs.reduce((sum, f) => sum + Number(f.quantityLitres), 0);
  const validMileageLogs = filteredLogs.filter(
    (f) => f.mileageKmPerLitre != null && Number(f.mileageKmPerLitre) > 0
  );
  const avgMileage =
    validMileageLogs.length > 0
      ? validMileageLogs.reduce((sum, f) => sum + Number(f.mileageKmPerLitre), 0) /
        validMileageLogs.length
      : null;

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
              Fuel Management &amp; Mileage ERP
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-orange-100 text-[#F26522] border border-orange-200">
              DeepSeek AI Powered
            </span>
          </div>
          <p className="text-sm text-slate-500">
            AI-powered fuel receipt and dispenser meter scanning, automated mileage tracking, and double-entry fuel accounting for AJAY ENTERPRISES
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadData();
              loadTrendData();
            }}
            isLoading={isLoading || trendLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowDirectScanModal(true)}
            className="bg-[#0B1E36] hover:bg-slate-800 text-white font-bold shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-orange-400" />
            AI Scan Refill
          </Button>

          <Button
            size="sm"
            onClick={() => setShowEntryModal(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Fuel Entry
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total Fuel Expenditure
          </span>
          <div className="text-2xl font-bold font-mono text-[#0B1E36] mt-1.5">
            ₹{totalFuelCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">General Ledger Account 5030</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total Fuel Consumed
          </span>
          <div className="text-2xl font-bold font-mono text-slate-800 mt-1.5">
            {totalLitres.toLocaleString("en-IN", { minimumFractionDigits: 2 })} L
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {filteredLogs.length} Recorded Refills
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Weighted Average Price
          </span>
          <div className="text-2xl font-bold font-mono text-[#F26522] mt-1.5">
            ₹{totalLitres > 0 ? (totalFuelCost / totalLitres).toFixed(2) : "0.00"} / L
          </div>
          <div className="text-xs text-slate-400 mt-1">Purchase rate across stations</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Fleet Average Mileage
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1.5">
            {avgMileage != null ? `${avgMileage.toFixed(2)} km/L` : "—"}
          </div>
          <div className="text-xs text-slate-400 mt-1">Calculated from full-tank cycles</div>
        </div>
      </div>

      {/* Mileage Trend Chart Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowChart(!showChart)}
            className="text-xs font-bold text-slate-700 hover:text-[#F26522] flex items-center gap-1.5 transition-colors"
          >
            <TrendingUp className="w-4 h-4 text-[#F26522]" />
            <span>{showChart ? "Hide Mileage Trend Line Chart" : "Show Mileage Trend Line Chart"}</span>
          </button>
        </div>

        {showChart && (
          <MileageTrendChart
            dataPoints={trendData}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onVehicleChange={(vId) => setSelectedVehicleId(vId)}
          />
        )}
      </div>

      {/* Fuel Logs Filter Bar & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters Bar */}
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
                placeholder="Search log #, vehicle, station, receipt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing <strong className="text-slate-800">{filteredLogs.length}</strong> entries
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 min-w-[950px]">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Log Number</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                <th className="px-4 py-3 whitespace-nowrap">Odometer</th>
                <th className="px-4 py-3 whitespace-nowrap">Quantity</th>
                <th className="px-4 py-3 whitespace-nowrap">Rate</th>
                <th className="px-4 py-3 whitespace-nowrap">Total Cost</th>
                <th className="px-4 py-3 whitespace-nowrap">Mileage (KM/L)</th>
                <th className="px-4 py-3 whitespace-nowrap">Running Cost</th>
                <th className="px-4 py-3 whitespace-nowrap">Refill Type</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={11} rows={6} />
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    <Fuel className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold">No fuel logs found matching criteria</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Use the &quot;AI Scan Refill&quot; button above to scan and save your first fuel receipt.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((f) => {
                  const isAi = f.remarks?.includes("AI Extracted");
                  const receiptDoc = f.receiptDocumentUrl;

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                        <div className="flex items-center gap-1.5">
                          <span>{f.logNumber}</span>
                          {isAi && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-[#F26522] uppercase tracking-wider">
                              AI
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {new Date(f.fuelDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        {f.vehicle?.vehicleNumber}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {f.vehicle?.make} {f.vehicle?.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        {Number(f.odometerReading).toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                        {Number(f.quantityLitres).toFixed(2)} L
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        ₹{Number(f.pricePerUnit).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#0B1E36] whitespace-nowrap">
                        ₹{Number(f.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {f.mileageKmPerLitre != null && Number(f.mileageKmPerLitre) > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            {Number(f.mileageKmPerLitre).toFixed(2)}
                            <span className="text-[10px] text-emerald-700 font-normal">km/L</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {f.costPerKm != null ? `₹${Number(f.costPerKm).toFixed(2)}/km` : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            f.isFullTank
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {f.isFullTank ? "Full Tank" : "Partial"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {receiptDoc ? (
                          <button
                            type="button"
                            onClick={() => setPreviewDocumentUrl(receiptDoc)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F26522] hover:text-[#EA580C] hover:underline"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Receipt
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
      </div>

      {/* Modals */}
      <FuelEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSaved={() => {
          loadData();
          loadTrendData();
        }}
        vehicles={vehicles}
      />

      <AiScanModal
        isOpen={showDirectScanModal}
        onClose={() => setShowDirectScanModal(false)}
        onExtracted={handleDirectScanExtracted}
        vehicleId={selectedVehicleId}
        mode="fuel"
      />

      {/* Document Preview Modal */}
      {previewDocumentUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#0B1E36]">Receipt Attachment Preview</h3>
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
                  alt="Receipt"
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
      )}
    </div>
  );
}
