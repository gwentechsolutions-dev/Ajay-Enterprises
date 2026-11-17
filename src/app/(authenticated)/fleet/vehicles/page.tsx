"use client";

import * as React from "react";
import Link from "next/link";
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldError } from "@/components/ui/form-field-error";
import { parseApiValidationErrors, formatValidationToast } from "@/lib/forms/validation-mapper";

export default function FleetVehiclesPage() {
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    vehicleNumber: "",
    category: "TRUCK",
    make: "",
    model: "",
    variant: "",
    fuelType: "DIESEL",
    currentOdometer: 0,
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiryDate: "",
    fitnessExpiryDate: "",
    pollutionExpiryDate: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/fleet/vehicles");
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data);
      }
    } catch (err) {
      console.error("Failed to load vehicles", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadVehicles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const errors: Record<string, string> = {};

    if (!formData.vehicleNumber.trim() || formData.vehicleNumber.trim().length < 5) {
      errors.vehicleNumber = "Vehicle registration number must be at least 5 characters";
    }
    if (!formData.make.trim()) {
      errors.make = "Vehicle make is required";
    }
    if (!formData.model.trim()) {
      errors.model = "Vehicle model is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      setFormError(errors[first]);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const res = await fetch("/api/v1/fleet/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          vehicleNumber: formData.vehicleNumber.toUpperCase().trim(),
        }),
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
        vehicleNumber: "",
        category: "TRUCK",
        make: "",
        model: "",
        variant: "",
        fuelType: "DIESEL",
        currentOdometer: 0,
        insuranceProvider: "",
        insurancePolicyNumber: "",
        insuranceExpiryDate: "",
        fitnessExpiryDate: "",
        pollutionExpiryDate: "",
        notes: "",
      });
      setFieldErrors({});
      loadVehicles();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "ALL" || v.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

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
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Company Vehicles Register</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
              {vehicles.length} Registered
            </span>
          </div>
          <p className="text-sm text-slate-500">
            AJAY ENTERPRISES owned transport fleet, statutory document validity, and current odometers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadVehicles}
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
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search vehicle number, make or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="TRUCK">Truck</option>
            <option value="PICKUP">Pickup</option>
            <option value="VAN">Van</option>
            <option value="TRACTOR">Tractor</option>
            <option value="TWO_WHEELER">Two-Wheeler</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Registration #</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Make & Model</th>
                <th className="px-4 py-3">Fuel Type</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Insurance Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{v.vehicleNumber}</td>
                  <td className="px-4 py-3 font-semibold text-xs text-slate-700">{v.category}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{v.make} {v.model}</div>
                    {v.variant && <div className="text-xs text-slate-400">{v.variant}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">{v.fuelType}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{Number(v.currentOdometer).toLocaleString()} km</td>
                  <td className="px-4 py-3 text-xs">
                    {v.insuranceExpiryDate ? new Date(v.insuranceExpiryDate).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        v.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : v.status === "UNDER_MAINTENANCE"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/fleet/vehicles/${v.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-[#0B1E36] hover:bg-slate-100">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No vehicles found matching the filters.
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
            <h2 className="text-lg font-bold text-[#0B1E36]">Register New Company Vehicle</h2>
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Vehicle Number *</label>
                  <Input
                    required
                    maxLength={20}
                    placeholder="TN-01-AB-1234"
                    value={formData.vehicleNumber}
                    error={!!fieldErrors.vehicleNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase().slice(0, 20) });
                      if (fieldErrors.vehicleNumber) setFieldErrors((prev) => ({ ...prev, vehicleNumber: "" }));
                    }}
                    className="mt-1 uppercase font-mono"
                  />
                  <FormFieldError error={fieldErrors.vehicleNumber} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <option value="TRUCK">Truck</option>
                    <option value="PICKUP">Pickup</option>
                    <option value="VAN">Van</option>
                    <option value="TRACTOR">Tractor</option>
                    <option value="TWO_WHEELER">Two-Wheeler</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Make *</label>
                  <Input
                    required
                    maxLength={50}
                    placeholder="Tata, Mahindra..."
                    value={formData.make}
                    error={!!fieldErrors.make}
                    onChange={(e) => {
                      setFormData({ ...formData, make: e.target.value.slice(0, 50) });
                      if (fieldErrors.make) setFieldErrors((prev) => ({ ...prev, make: "" }));
                    }}
                    className="mt-1"
                  />
                  <FormFieldError error={fieldErrors.make} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Model *</label>
                  <Input
                    required
                    maxLength={50}
                    placeholder="407, Bolero..."
                    value={formData.model}
                    error={!!fieldErrors.model}
                    onChange={(e) => {
                      setFormData({ ...formData, model: e.target.value.slice(0, 50) });
                      if (fieldErrors.model) setFieldErrors((prev) => ({ ...prev, model: "" }));
                    }}
                    className="mt-1"
                  />
                  <FormFieldError error={fieldErrors.model} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fuel Type</label>
                  <select
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="PETROL">Petrol</option>
                    <option value="CNG">CNG</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Current Odometer (km)</label>
                  <Input
                    type="number"
                    value={formData.currentOdometer}
                    onChange={(e) => setFormData({ ...formData, currentOdometer: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Insurance Expiry</label>
                  <Input
                    type="date"
                    value={formData.insuranceExpiryDate}
                    onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fitness Expiry</label>
                  <Input
                    type="date"
                    value={formData.fitnessExpiryDate}
                    onChange={(e) => setFormData({ ...formData, fitnessExpiryDate: e.target.value })}
                    className="mt-1"
                  />
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
                  {isSubmitting ? "Saving..." : "Save Vehicle"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

