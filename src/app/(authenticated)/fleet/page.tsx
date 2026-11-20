"use client";

import * as React from "react";
import Link from "next/link";
import {
  Truck,
  Users,
  Compass,
  Repeat,
  AlertTriangle,
  Plus,
  RefreshCw,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Fuel,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FleetOverviewPage() {
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [trips, setTrips] = React.useState<any[]>([]);
  const [alerts, setAlerts] = React.useState<any>({ vehicleAlerts: [], driverAlerts: [] });
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vRes, tRes, aRes] = await Promise.all([
        fetch("/api/v1/fleet/vehicles"),
        fetch("/api/v1/fleet/trips"),
        fetch("/api/v1/fleet/alerts"),
      ]);

      const [vData, tData, aData] = await Promise.all([
        vRes.json(),
        tRes.json(),
        aRes.json(),
      ]);

      if (vData.success) setVehicles(vData.data);
      if (tData.success) setTrips(tData.data);
      if (aData.success) setAlerts(aData.data);
    } catch (err) {
      console.error("Failed to load fleet data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;
  const underMaintenance = vehicles.filter((v) => v.status === "UNDER_MAINTENANCE").length;
  const inTransitTrips = trips.filter((t) => t.status === "IN_TRANSIT").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1E36] break-words">Company Fleet Management</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522] whitespace-nowrap">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Company-owned vehicles, driver assignments, delivery trips, fuel monitoring & vehicle servicing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/fleet/vehicles">
            <Button size="sm" className="bg-[#0B1E36] hover:bg-[#1E293B] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Manage Vehicles
            </Button>
          </Link>
        </div>
      </div>

      {/* Compliance Expiry Alerts */}
      {(alerts.vehicleAlerts?.length > 0 || alerts.driverAlerts?.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-900 text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            Statutory Document Expiry Warnings ({alerts.vehicleAlerts.length + alerts.driverAlerts.length} Action Items)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {alerts.vehicleAlerts.slice(0, 6).map((a: any, idx: number) => (
              <div key={idx} className="bg-white p-2.5 rounded border border-amber-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-slate-800">{a.vehicleNumber}</span>: {a.alertType}
                </div>
                <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${a.isExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {a.isExpired ? "EXPIRED" : `${a.daysRemaining} days left`}
                </span>
              </div>
            ))}
            {alerts.driverAlerts.slice(0, 3).map((a: any, idx: number) => (
              <div key={idx} className="bg-white p-2.5 rounded border border-amber-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-slate-800">{a.name}</span>: Driving Licence
                </div>
                <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${a.isExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {a.isExpired ? "EXPIRED" : `${a.daysRemaining} days left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Fleet Vehicles</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0B1E36] flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">{vehicles.length}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-600 font-semibold">{activeVehicles} active</span> • {underMaintenance} in service
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Delivery Trips</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#F26522] flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#F26522] mt-2">{inTransitTrips}</div>
          <div className="text-xs text-slate-500 mt-1">Currently in transit to sites</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Completed Trips</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">
            {trips.filter((t) => t.status === "COMPLETED").length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Odometer distance reconciled</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Fleet Modules</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">6 Submodules</div>
          <div className="text-xs text-slate-500 mt-1">Vehicles, Drivers, Trips, Fuel, Servicing</div>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Link href="/fleet/vehicles" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B1E36] flex items-center justify-center group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Vehicles Master</div>
              <div className="text-xs text-slate-400">RC, Insurance, Odometers</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-colors" />
        </Link>

        <Link href="/fleet/drivers" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B1E36] flex items-center justify-center group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Drivers Register</div>
              <div className="text-xs text-slate-400">Licences & assignments</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-colors" />
        </Link>

        <Link href="/fleet/trips" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B1E36] flex items-center justify-center group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Vehicle Trips</div>
              <div className="text-xs text-slate-400">DN dispatch & returns</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-colors" />
        </Link>

        <Link href="/fleet/fuel" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B1E36] flex items-center justify-center group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Fuel & Mileage</div>
              <div className="text-xs text-slate-400">km/L efficiency logs</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-colors" />
        </Link>

        <Link href="/fleet/maintenance" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] transition-all flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#0B1E36] flex items-center justify-center group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Vehicle Servicing</div>
              <div className="text-xs text-slate-400">Repairs & scheduling</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-colors" />
        </Link>
      </div>

      {/* Recent Trips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B1E36]">Recent Vehicle Trips</h2>
          <Link href="/fleet/trips" className="text-xs text-[#F26522] hover:underline font-semibold">
            View All Trips →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Trip #</th>
                <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                <th className="px-4 py-3 whitespace-nowrap">Driver</th>
                <th className="px-4 py-3 whitespace-nowrap">Start Odo</th>
                <th className="px-4 py-3 whitespace-nowrap">End Odo</th>
                <th className="px-4 py-3 whitespace-nowrap">Distance</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.slice(0, 5).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-[#0B1E36]">{t.tripNumber}</td>
                  <td className="px-4 py-3 font-semibold">{t.vehicle?.vehicleNumber}</td>
                  <td className="px-4 py-3">{t.driver?.name || "Unassigned"}</td>
                  <td className="px-4 py-3 font-mono">{Number(t.startOdometer).toLocaleString()} km</td>
                  <td className="px-4 py-3 font-mono">{t.endOdometer ? `${Number(t.endOdometer).toLocaleString()} km` : "—"}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#F26522]">
                    {t.distanceKm ? `${Number(t.distanceKm).toLocaleString()} km` : "In Progress"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        t.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.status === "IN_TRANSIT"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No trips logged yet. Create your first vehicle trip from the Trips tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

