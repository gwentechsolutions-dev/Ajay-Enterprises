"use client";

import * as React from "react";
import {
  HardHat,
  Plus,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  UserX,
  Phone,
  DollarSign,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LabourWorkersPage() {
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    mobileNumber: "",
    category: "GENERAL_LABOUR",
    skillTrade: "",
    wageType: "DAILY",
    dailyWage: 600,
    monthlySalary: 18000,
    paymentFrequency: "MONTHLY",
    emergencyContact: "",
    address: "",
    notes: "",
  });

  const loadWorkers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/labour/workers");
      const json = await res.json();
      if (json.success) {
        setWorkers(json.data);
      }
    } catch (err) {
      console.error("Failed to load workers", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadWorkers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/v1/labour/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          mobileNumber: formData.mobileNumber,
          category: formData.category,
          skillTrade: formData.skillTrade || undefined,
          wageType: formData.wageType,
          dailyWage: Number(formData.dailyWage) || 0,
          monthlySalary: Number(formData.monthlySalary) || 0,
          paymentFrequency: formData.paymentFrequency,
          emergencyContact: formData.emergencyContact || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create worker");
      }

      setIsModalOpen(false);
      setFormData({
        name: "",
        mobileNumber: "",
        category: "GENERAL_LABOUR",
        skillTrade: "",
        wageType: "DAILY",
        dailyWage: 600,
        monthlySalary: 18000,
        paymentFrequency: "MONTHLY",
        emergencyContact: "",
        address: "",
        notes: "",
      });
      loadWorkers();
    } catch (err: any) {
      setFormError(err.message || "Failed to save worker");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.workerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.mobileNumber?.includes(searchQuery);

    const matchesCategory = categoryFilter === "ALL" || w.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || w.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Workforce Register</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Registered yard workers, centering equipment handlers, drivers, daily wages & contact directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorkers}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by worker name, code or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Categories</option>
              <option value="GENERAL_LABOUR">General Labour</option>
              <option value="MATERIAL_HANDLING">Material Handling</option>
              <option value="LOADING_UNLOADING">Loading / Unloading</option>
              <option value="REPAIR_MAINTENANCE">Repair & Maintenance</option>
              <option value="SKILLED">Skilled Worker</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="DRIVERS">Drivers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Worker Code</th>
                <th className="p-3">Worker Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Trade / Skill</th>
                <th className="p-3">Mobile Number</th>
                <th className="p-3">Wage Rate</th>
                <th className="p-3 text-right">Advance Balance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkers.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-[#0B1E36]">{w.workerCode}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{w.name}</div>
                    {w.emergencyContact && (
                      <div className="text-xs text-slate-400">Emerg: {w.emergencyContact}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {w.category}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">{w.skillTrade || "—"}</td>
                  <td className="p-3 font-mono text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {w.mobileNumber}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-800">
                    {w.wageType === "DAILY"
                      ? `₹${Number(w.dailyWage || 0)} / day`
                      : `₹${Number(w.monthlySalary || 0)} / mo`}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-[#F26522]">
                    ₹{Number(w.totalOutstandingAdvance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        w.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {w.status === "ACTIVE" ? (
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <UserX className="w-3 h-3 text-slate-500" />
                      )}
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredWorkers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No workers found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0B1E36]">Add New Worker</h2>
                <p className="text-xs text-slate-500">Register employee/contract labour for AJAY ENTERPRISES</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile (e.g. 9876543210)"
                    pattern="[6-9][0-9]{9}"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="GENERAL_LABOUR">General Labour</option>
                    <option value="MATERIAL_HANDLING">Material Handling</option>
                    <option value="LOADING_UNLOADING">Loading / Unloading</option>
                    <option value="REPAIR_MAINTENANCE">Repair & Maintenance</option>
                    <option value="SKILLED">Skilled Worker</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="DRIVERS">Drivers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Skill / Trade Specialisation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scaffolding, Welder, Props Repair"
                    value={formData.skillTrade}
                    onChange={(e) => setFormData({ ...formData, skillTrade: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Wage Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.wageType}
                    onChange={(e) => setFormData({ ...formData, wageType: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="DAILY">Daily Wage</option>
                    <option value="MONTHLY">Monthly Salary</option>
                  </select>
                </div>

                {formData.wageType === "DAILY" ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Daily Wage Rate (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      required
                      value={formData.dailyWage}
                      onChange={(e) => setFormData({ ...formData, dailyWage: Number(e.target.value) })}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Monthly Salary (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={formData.monthlySalary}
                      onChange={(e) => setFormData({ ...formData, monthlySalary: Number(e.target.value) })}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment Cycle
                  </label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={(e) => setFormData({ ...formData, paymentFrequency: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="DAILY">Daily</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact Number
                  </label>
                  <input
                    type="tel"
                    placeholder="Emergency phone number"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="Local or native address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes / Identification
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or identification details"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Saving Worker..." : "Register Worker"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

