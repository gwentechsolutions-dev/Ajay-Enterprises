"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Truck,
  ArrowLeft,
  Calendar,
  Fuel,
  Wrench,
  Compass,
  IndianRupee,
  ShieldCheck,
  RefreshCw,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VehicleDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<"TRIPS" | "FUEL" | "MAINTENANCE" | "EXPENSES">("TRIPS");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadVehicle = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/fleet/vehicles/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load vehicle", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (id) loadVehicle();
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading vehicle dossier...
      </div>
    );
  }

  const { vehicle, mileageStats } = data;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div>
        <Link
          href="/fleet/vehicles"
          className="text-slate-400 hover:text-slate-600 transition-colors text-xs flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Vehicles Register
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36] font-mono">
                {vehicle.vehicleNumber}
              </h1>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  vehicle.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-700"
                    : vehicle.status === "UNDER_MAINTENANCE"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {vehicle.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {vehicle.make} {vehicle.model} • {vehicle.category} • {vehicle.fuelType}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards & Mileage Intelligence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Current Odometer</span>
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0B1E36] mt-2">
            {Number(vehicle.currentOdometer).toLocaleString()} km
          </div>
          <div className="text-xs text-slate-400 mt-1">Last verified reading</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Calculated Mileage</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-2">
            {mileageStats?.averageKmPerLitre
              ? `${Number(mileageStats.averageKmPerLitre).toFixed(2)} km/L`
              : "Calibrating"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {mileageStats?.isReliable ? "Verified full-tank average" : "Requires 2+ full fills"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Fuel Running Cost</span>
            <IndianRupee className="w-4 h-4 text-[#F26522]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F26522] mt-2">
            {mileageStats?.averageCostPerKm
              ? `₹${Number(mileageStats.averageCostPerKm).toFixed(2)} / km`
              : "—"}
          </div>
          <div className="text-xs text-slate-400 mt-1">Average fuel cost per km</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Trips Completed</span>
            <Compass className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">
            {vehicle.trips?.length || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Delivery runs executed</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("TRIPS")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "TRIPS"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Compass className="w-4 h-4" />
          Trips ({vehicle.trips?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("FUEL")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "FUEL"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Fuel className="w-4 h-4" />
          Fuel Logs ({vehicle.fuelLogs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("MAINTENANCE")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "MAINTENANCE"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Maintenance ({vehicle.maintenanceRecords?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("EXPENSES")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "EXPENSES"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Expenses ({vehicle.expenses?.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === "TRIPS" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Trip #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Start Odo</th>
                  <th className="px-4 py-3">End Odo</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.trips?.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B1E36]">{t.tripNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(t.tripDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-mono">{Number(t.startOdometer).toLocaleString()} km</td>
                    <td className="px-4 py-3 font-mono">{t.endOdometer ? `${Number(t.endOdometer).toLocaleString()} km` : "—"}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#F26522]">
                      {t.distanceKm ? `${Number(t.distanceKm).toLocaleString()} km` : "In Progress"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${t.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!vehicle.trips || vehicle.trips.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No trip records for this vehicle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "FUEL" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Log #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Odometer</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Total Cost</th>
                  <th className="px-4 py-3">Mileage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.fuelLogs?.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B1E36]">{f.logNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(f.fuelDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-mono">{Number(f.odometerReading).toLocaleString()} km</td>
                    <td className="px-4 py-3 font-mono">{Number(f.quantityLitres).toFixed(2)} L</td>
                    <td className="px-4 py-3 font-mono">₹{Number(f.pricePerUnit).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">₹{Number(f.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                      {f.mileageKmPerLitre ? `${Number(f.mileageKmPerLitre).toFixed(2)} km/L` : "—"}
                    </td>
                  </tr>
                ))}
                {(!vehicle.fuelLogs || vehicle.fuelLogs.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No fuel log records for this vehicle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "MAINTENANCE" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Record #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Work Description</th>
                  <th className="px-4 py-3">Odometer</th>
                  <th className="px-4 py-3">Total Cost</th>
                  <th className="px-4 py-3">Next Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.maintenanceRecords?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B1E36]">{m.recordNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(m.serviceDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{m.serviceCategory}</td>
                    <td className="px-4 py-3">{m.descriptionOfWork}</td>
                    <td className="px-4 py-3 font-mono">{Number(m.odometerReading).toLocaleString()} km</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">₹{Number(m.totalCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.nextServiceDate ? new Date(m.nextServiceDate).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
                {(!vehicle.maintenanceRecords || vehicle.maintenanceRecords.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No maintenance records for this vehicle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "EXPENSES" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Voucher #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicle.expenses?.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B1E36]">{e.expenseNumber}</td>
                    <td className="px-4 py-3 text-xs">{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{e.expenseCategory}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-xs">{e.paymentMode}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 text-right">₹{Number(e.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {(!vehicle.expenses || vehicle.expenses.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No expense vouchers for this vehicle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

