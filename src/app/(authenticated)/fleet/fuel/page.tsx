"use client";

import * as React from "react";
import Link from "next/link";
import {
  Fuel,
  Plus,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/loading-states";

export default function FleetFuelPage() {
  const [fuelLogs, setFuelLogs] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    vehicleId: "",
    quantityLitres: 0,
    pricePerUnit: 98.5,
    odometerReading: 0,
    fuelType: "DIESEL",
    fuelStation: "",
    isFullTank: true,
    postToAccounts: true,
    remarks: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fRes, vRes] = await Promise.all([
        fetch("/api/v1/fleet/fuel"),
        fetch("/api/v1/fleet/vehicles?status=ACTIVE"),
      ]);
      const [fData, vData] = await Promise.all([fRes.json(), vRes.json()]);
      if (fData.success) setFuelLogs(fData.data);
      if (vData.success) setVehicles(vData.data);
    } catch (err) {
      console.error("Failed to load fuel data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleVehicleSelect = (vId: string) => {
    const v = vehicles.find((item) => item.id === vId);
    setFormData({
      ...formData,
      vehicleId: vId,
      odometerReading: v ? Number(v.currentOdometer) : 0,
      fuelType: v?.fuelType || "DIESEL",
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/fleet/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error?.message || "Failed to record fuel log");
        return;
      }
      setShowCreateModal(false);
      setFormData({
        vehicleId: "",
        quantityLitres: 0,
        pricePerUnit: 98.5,
        odometerReading: 0,
        fuelType: "DIESEL",
        fuelStation: "",
        isFullTank: true,
        postToAccounts: true,
        remarks: "",
      });
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalFuelCost = fuelLogs.reduce((sum, f) => sum + Number(f.totalCost), 0);
  const totalLitres = fuelLogs.reduce((sum, f) => sum + Number(f.quantityLitres), 0);

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Fuel Management & Mileage ERP</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
              {fuelLogs.length} Entries
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Fuel dispense logs, distance tracking between fills, km/L mileage analytics, and double-entry fuel accounting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Fuel Entry
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Fuel Expenditure</span>
          <div className="text-2xl font-bold font-mono text-[#0B1E36] mt-2">
            ₹{totalFuelCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Posted to Account 5040</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Fuel Consumed</span>
          <div className="text-2xl font-bold font-mono text-slate-800 mt-2">
            {totalLitres.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Litres
          </div>
          <div className="text-xs text-slate-400 mt-1">Across all company vehicles</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Average Fuel Price</span>
          <div className="text-2xl font-bold font-mono text-[#F26522] mt-2">
            ₹{totalLitres > 0 ? (totalFuelCost / totalLitres).toFixed(2) : "0.00"} / L
          </div>
          <div className="text-xs text-slate-400 mt-1">Weighted purchase rate</div>
        </div>
      </div>

      {/* Fuel Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Log #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Litres</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Calculated Mileage</th>
                <th className="px-4 py-3">Full Tank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={9} rows={5} />
              ) : fuelLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No fuel logs recorded yet.
                  </td>
                </tr>
              ) : (
                fuelLogs.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{f.logNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(f.fuelDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{f.vehicle?.vehicleNumber}</td>
                    <td className="px-4 py-3 font-mono">{Number(f.odometerReading).toLocaleString()} km</td>
                    <td className="px-4 py-3 font-mono">{Number(f.quantityLitres).toFixed(2)} L</td>
                    <td className="px-4 py-3 font-mono">₹{Number(f.pricePerUnit).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">₹{Number(f.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                      {f.mileageKmPerLitre ? `${Number(f.mileageKmPerLitre).toFixed(2)} km/L` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${f.isFullTank ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {f.isFullTank ? "FULL" : "PARTIAL"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#0B1E36]">Add Vehicle Fuel Entry</h2>
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Vehicle *</label>
                <select
                  required
                  value={formData.vehicleId}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm font-semibold"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.make} {v.model}) - Odo: {Number(v.currentOdometer).toLocaleString()} km
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Quantity (Litres) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.quantityLitres}
                    onChange={(e) => setFormData({ ...formData, quantityLitres: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Price / Litre (₹) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Odometer Reading (km) *</label>
                <Input
                  required
                  type="number"
                  value={formData.odometerReading}
                  onChange={(e) => setFormData({ ...formData, odometerReading: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fuel Station</label>
                  <Input
                    placeholder="HPCL, IOCL, BPCL..."
                    value={formData.fuelStation}
                    onChange={(e) => setFormData({ ...formData, fuelStation: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isFullTank"
                    checked={formData.isFullTank}
                    onChange={(e) => setFormData({ ...formData, isFullTank: e.target.checked })}
                    className="w-4 h-4 text-[#0B1E36] rounded"
                  />
                  <label htmlFor="isFullTank" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Full Tank Fill
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-center font-mono">
                <span className="text-slate-500">Calculated Total Cost:</span>
                <span className="font-bold text-[#0B1E36] text-sm">
                  ₹{(formData.quantityLitres * formData.pricePerUnit).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Recording Fuel..."
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  Record Fuel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

