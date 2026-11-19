"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  Calendar,
  Phone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldError } from "@/components/ui/form-field-error";
import { parseApiValidationErrors, formatValidationToast } from "@/lib/forms/validation-mapper";

export default function FleetDriversPage() {
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    name: "",
    mobileNumber: "",
    address: "",
    emergencyContact: "",
    licenseNumber: "",
    licenseClass: "HMV",
    licenseExpiryDate: "",
    salaryType: "MONTHLY",
    salaryAmount: 0,
    status: "ACTIVE",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const loadDrivers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/fleet/drivers");
      const data = await res.json();
      if (data.success) {
        setDrivers(data.data);
      }
    } catch (err) {
      console.error("Failed to load drivers", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadDrivers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Driver name is required";
    }
    const cleanMobile = formData.mobileNumber.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      errors.mobileNumber = "Must be a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }
    if (!formData.licenseNumber.trim() || formData.licenseNumber.trim().length < 6) {
      errors.licenseNumber = "Valid driving licence number is required (min 6 characters)";
    }
    if (!formData.licenseExpiryDate) {
      errors.licenseExpiryDate = "Licence expiry date is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      setFormError(errors[firstKey]);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const res = await fetch("/api/v1/fleet/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, mobileNumber: cleanMobile }),
      });
      const data = await res.json();
      if (!data.success) {
        const parsed = parseApiValidationErrors(data);
        setFieldErrors(parsed.fieldErrors);
        setFormError(formatValidationToast(parsed));
        return;
      }
      setShowCreateModal(false);
      setFormData({
        name: "",
        mobileNumber: "",
        address: "",
        emergencyContact: "",
        licenseNumber: "",
        licenseClass: "HMV",
        licenseExpiryDate: "",
        salaryType: "MONTHLY",
        salaryAmount: 0,
        status: "ACTIVE",
        notes: "",
      });
      setFieldErrors({});
      loadDrivers();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.driverCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.mobileNumber.includes(searchTerm)
  );

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
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Company Drivers Register</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
              {drivers.length} Drivers
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Authorized company drivers, driving license validity, and vehicle assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDrivers}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Driver
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search driver name, code, licence or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[750px]">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Driver Code</th>
                <th className="px-4 py-3 whitespace-nowrap">Full Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Mobile #</th>
                <th className="px-4 py-3 whitespace-nowrap">Licence Number</th>
                <th className="px-4 py-3 whitespace-nowrap">Licence Expiry</th>
                <th className="px-4 py-3 whitespace-nowrap">Salary Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => {
                const isExp = new Date(d.licenseExpiryDate) < new Date();
                return (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{d.driverCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{d.name}</td>
                    <td className="px-4 py-3 font-mono">{d.mobileNumber}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{d.licenseNumber}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={isExp ? "text-red-600 font-bold" : "text-slate-600"}>
                        {new Date(d.licenseExpiryDate).toLocaleDateString("en-IN")}
                        {isExp && " (EXPIRED)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{d.salaryType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          d.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No drivers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#0B1E36]">Add New Company Driver</h2>
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Driver Name *</label>
                  <Input
                    required
                    maxLength={100}
                    placeholder="Full name"
                    value={formData.name}
                    error={!!fieldErrors.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    className="mt-1"
                  />
                  <FormFieldError error={fieldErrors.name} />
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-700">Mobile Number *</label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formData.mobileNumber.length}/10
                    </span>
                  </div>
                  <Input
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={formData.mobileNumber}
                    error={!!fieldErrors.mobileNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setFormData({ ...formData, mobileNumber: clean });
                      if (fieldErrors.mobileNumber) setFieldErrors((prev) => ({ ...prev, mobileNumber: "" }));
                    }}
                    className="mt-1 font-mono"
                  />
                  <FormFieldError error={fieldErrors.mobileNumber} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Licence Number *</label>
                  <Input
                    required
                    maxLength={25}
                    placeholder="DL-XXXXXXXXXXXXX"
                    value={formData.licenseNumber}
                    error={!!fieldErrors.licenseNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, licenseNumber: e.target.value.toUpperCase().slice(0, 25) });
                      if (fieldErrors.licenseNumber) setFieldErrors((prev) => ({ ...prev, licenseNumber: "" }));
                    }}
                    className="mt-1 uppercase font-mono"
                  />
                  <FormFieldError error={fieldErrors.licenseNumber} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Licence Expiry *</label>
                  <Input
                    required
                    type="date"
                    value={formData.licenseExpiryDate}
                    error={!!fieldErrors.licenseExpiryDate}
                    onChange={(e) => {
                      setFormData({ ...formData, licenseExpiryDate: e.target.value });
                      if (fieldErrors.licenseExpiryDate) setFieldErrors((prev) => ({ ...prev, licenseExpiryDate: "" }));
                    }}
                    className="mt-1"
                  />
                  <FormFieldError error={fieldErrors.licenseExpiryDate} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Salary Type</label>
                  <select
                    value={formData.salaryType}
                    onChange={(e) => setFormData({ ...formData, salaryType: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                    <option value="TRIP_BASED">Trip Based</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Salary Amount (₹)</label>
                  <Input
                    type="number"
                    value={formData.salaryAmount}
                    error={!!fieldErrors.salaryAmount}
                    onChange={(e) => {
                      setFormData({ ...formData, salaryAmount: Number(e.target.value) });
                      if (fieldErrors.salaryAmount) setFieldErrors((prev) => ({ ...prev, salaryAmount: "" }));
                    }}
                    className="mt-1 font-mono"
                  />
                  <FormFieldError error={fieldErrors.salaryAmount} />
                </div>
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
                  disabled={isSubmitting}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Saving..." : "Save Driver"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

