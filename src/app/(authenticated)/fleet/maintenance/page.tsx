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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/loading-states";

export default function FleetMaintenancePage() {
  const [records, setRecords] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    vehicleId: "",
    serviceCategory: "REGULAR_SERVICE",
    odometerReading: 0,
    serviceProvider: "",
    descriptionOfWork: "",
    partsCost: 0,
    labourCost: 0,
    taxAmount: 0,
    nextServiceDate: "",
    nextServiceOdometer: 0,
    remarks: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, vRes] = await Promise.all([
        fetch("/api/v1/fleet/maintenance"),
        fetch("/api/v1/fleet/vehicles?status=ACTIVE"),
      ]);
      const [mData, vData] = await Promise.all([mRes.json(), vRes.json()]);
      if (mData.success) setRecords(mData.data);
      if (vData.success) setVehicles(vData.data);
    } catch (err) {
      console.error("Failed to load maintenance records", err);
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
      nextServiceOdometer: v ? Number(v.currentOdometer) + 10000 : 10000,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/fleet/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error?.message || "Failed to record service record");
        return;
      }
      setShowCreateModal(false);
      setFormData({
        vehicleId: "",
        serviceCategory: "REGULAR_SERVICE",
        odometerReading: 0,
        serviceProvider: "",
        descriptionOfWork: "",
        partsCost: 0,
        labourCost: 0,
        taxAmount: 0,
        nextServiceDate: "",
        nextServiceOdometer: 0,
        remarks: "",
      });
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCost = records.reduce((sum, r) => sum + Number(r.totalCost), 0);

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
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Vehicle Maintenance & Repairs</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
              {records.length} Records
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Preventive servicing, tyre/battery replacements, workshop invoices, and scheduled service thresholds
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
            Record Service
          </Button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Maintenance Expenditure</span>
          <div className="text-2xl font-bold font-mono text-[#0B1E36] mt-1">
            ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Directly integrated with Account 5040</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F26522] flex items-center justify-center">
          <Wrench className="w-5 h-5" />
        </div>
      </div>

      {/* Maintenance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Record #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Work Done</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Next Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={8} rows={5} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{r.recordNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(r.serviceDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.vehicle?.vehicleNumber}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{r.serviceCategory}</td>
                    <td className="px-4 py-3">{r.descriptionOfWork}</td>
                    <td className="px-4 py-3 font-mono">{Number(r.odometerReading).toLocaleString()} km</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">₹{Number(r.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.nextServiceDate ? new Date(r.nextServiceDate).toLocaleDateString("en-IN") : "—"}
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#0B1E36]">Record Vehicle Servicing</h2>
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
                  <label className="text-xs font-semibold text-slate-700">Service Category *</label>
                  <select
                    value={formData.serviceCategory}
                    onChange={(e) => setFormData({ ...formData, serviceCategory: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <option value="REGULAR_SERVICE">Regular Servicing</option>
                    <option value="ENGINE_REPAIR">Engine Repair</option>
                    <option value="TYRES">Tyres Replacement</option>
                    <option value="BATTERY">Battery Replacement</option>
                    <option value="BRAKE_SYSTEM">Brake System</option>
                    <option value="ELECTRICAL">Electrical Works</option>
                    <option value="BODYWORK">Bodywork & Painting</option>
                    <option value="INSURANCE_REPAIR">Insurance Repair</option>
                    <option value="OTHER">Other</option>
                  </select>
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
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Description of Work *</label>
                <Input
                  required
                  placeholder="e.g. Engine oil change, oil filter, brake shoe replacement"
                  value={formData.descriptionOfWork}
                  onChange={(e) => setFormData({ ...formData, descriptionOfWork: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Parts Cost (₹)</label>
                  <Input
                    type="number"
                    value={formData.partsCost}
                    onChange={(e) => setFormData({ ...formData, partsCost: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Labour (₹)</label>
                  <Input
                    type="number"
                    value={formData.labourCost}
                    onChange={(e) => setFormData({ ...formData, labourCost: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Tax / GST (₹)</label>
                  <Input
                    type="number"
                    value={formData.taxAmount}
                    onChange={(e) => setFormData({ ...formData, taxAmount: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Next Service Date</label>
                  <Input
                    type="date"
                    value={formData.nextServiceDate}
                    onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Next Service Odometer (km)</label>
                  <Input
                    type="number"
                    value={formData.nextServiceOdometer}
                    onChange={(e) => setFormData({ ...formData, nextServiceOdometer: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-center font-mono">
                <span className="text-slate-500">Total Servicing Cost:</span>
                <span className="font-bold text-[#0B1E36] text-sm">
                  ₹{(Number(formData.partsCost) + Number(formData.labourCost) + Number(formData.taxAmount)).toFixed(2)}
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
                  loadingText="Saving Record..."
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  Save Service Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

