"use client";

import * as React from "react";
import Link from "next/link";
import {
  Truck,
  ArrowLeft,
  RefreshCw,
  Printer,
  Compass,
  AlertTriangle,
  Repeat,
  Gauge,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FleetReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"VEHICLES" | "FUEL" | "MAINTENANCE" | "DRIVERS" | "EXPIRIES">("VEHICLES");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/fleet");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load fleet analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.fleetSummary;
  const vehicles = data?.vehicleStats || [];
  const fuel = data?.fuelAnalytics;
  const maintenance = data?.maintenanceSummary;
  const drivers = data?.driverTripSummary || [];
  const expiries = data?.upcomingExpiries || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Reports Hub
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Company Fleet & Logistics Analytics</h1>
          <p className="text-sm text-slate-500">
            Company-owned vehicle fleet performance, trip distance, fuel consumption & mileage, and statutory compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="border-slate-300">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-slate-300">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-[#0B1E36]">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Company Vehicles</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary?.totalVehicles || 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active: {summary?.activeVehicles || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-cyan-600">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Total Fuel Consumed</div>
            <div className="text-2xl font-bold text-cyan-900 mt-1">
              {Number(fuel?.totalFuelLiters || 0).toLocaleString("en-IN")} L
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cost: ₹{Number(fuel?.totalFuelExpense || 0).toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-600">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Maintenance Expense</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              ₹{Number(maintenance?.totalMaintenanceExpense || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{maintenance?.maintenanceRecordsCount || 0} service jobs</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Statutory Expiries</div>
            <div className="text-2xl font-bold text-orange-700 mt-1">{expiries.length}</div>
            <div className="text-[11px] text-orange-600 mt-0.5">Due within 30 days</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "VEHICLES", label: "Vehicle Performance & Mileage" },
          { id: "FUEL", label: "Fuel Consumption Analytics" },
          { id: "MAINTENANCE", label: "Vehicle Maintenance & Repairs" },
          { id: "DRIVERS", label: "Driver Trip History" },
          { id: "EXPIRIES", label: `Document Expiries (${expiries.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-[#0B1E36] text-[#0B1E36]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Loading fleet analytics...</div>
      ) : (
        <>
          {/* TAB 1: VEHICLES */}
          {activeTab === "VEHICLES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Company-Owned Vehicles Performance Master</CardTitle>
                <CardDescription className="text-xs">Distance travelled, fuel efficiency (km/L), and operating costs per vehicle</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Registration #</th>
                        <th className="px-4 py-3">Make / Model</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Trips</th>
                        <th className="px-4 py-3 text-right">Distance (KM)</th>
                        <th className="px-4 py-3 text-right">Fuel (L)</th>
                        <th className="px-4 py-3 text-right">Mileage (km/L)</th>
                        <th className="px-4 py-3 text-right">Cost / KM (₹)</th>
                        <th className="px-4 py-3 text-right">Operating Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {vehicles.map((v: any) => (
                        <tr key={v.vehicleId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{v.registrationNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{v.makeModel || "Centering Hauler"}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{v.status}</Badge></td>
                          <td className="px-4 py-2.5 text-right">{v.tripsCount}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{v.totalKmTravelled.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right">{Number(v.totalFuelLiters).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{v.mileageKmPerLiter > 0 ? `${v.mileageKmPerLiter} km/L` : "-"}</td>
                          <td className="px-4 py-2.5 text-right font-medium">₹{v.costPerKm.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(v.totalOperatingCost).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: FUEL */}
          {activeTab === "FUEL" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Fuel Expenditure & Consumption</CardTitle>
                <CardDescription className="text-xs">Fleet fueling logs, diesel expenditures, and unit cost analysis</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Total Fuel Purchased</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{Number(fuel?.totalFuelLiters || 0).toLocaleString("en-IN")} Liters</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Total Fuel Cost</div>
                    <div className="text-xl font-bold text-cyan-900 mt-1">₹{Number(fuel?.totalFuelExpense || 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Average Price Per Liter</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">₹{Number(fuel?.averageCostPerLiter || 0).toFixed(2)} / L</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: MAINTENANCE */}
          {activeTab === "MAINTENANCE" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Vehicle Maintenance & Periodic Servicing</CardTitle>
                <CardDescription className="text-xs">Oil changes, tyre replacements, fitness repairs for AJAY ENTERPRISES fleet</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Record #</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Service Type</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Workshop / Garage</th>
                        <th className="px-4 py-3 text-right">Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(maintenance?.recentServices || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.recordNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{s.vehicleRegistration}</td>
                          <td className="px-4 py-2.5">{s.serviceType}</td>
                          <td className="px-4 py-2.5 text-slate-500">{new Date(s.serviceDate).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.vendorName}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(s.totalCost).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: DRIVERS */}
          {activeTab === "DRIVERS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Driver Operating Records & Trip Counts</CardTitle>
                <CardDescription className="text-xs">Trips completed and accumulated road kilometers by company drivers</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Driver Name</th>
                        <th className="px-4 py-3">License #</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Completed Trips</th>
                        <th className="px-4 py-3 text-right">Total Distance (KM)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {drivers.map((d: any) => (
                        <tr key={d.driverId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{d.fullName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{d.licenseNumber}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{d.status}</Badge></td>
                          <td className="px-4 py-2.5 text-right font-semibold">{d.tripsCompleted}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{d.totalKmDriven.toLocaleString("en-IN")} KM</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: EXPIRIES */}
          {activeTab === "EXPIRIES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Upcoming Statutory Expiries (Next 30 Days)</CardTitle>
                <CardDescription className="text-xs">Vehicle insurance, road tax, fitness certificates, PUC, and driving licenses</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Entity Name / Reg</th>
                        <th className="px-4 py-3">Statutory Document</th>
                        <th className="px-4 py-3">Expiry Date</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {expiries.map((ex: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-semibold text-slate-700">{ex.entityType}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{ex.name}</td>
                          <td className="px-4 py-2.5">{ex.documentType}</td>
                          <td className="px-4 py-2.5 text-slate-600">{new Date(ex.expiryDate).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={ex.isExpired ? "destructive" : "warning"} className="text-[10px]">
                              {ex.isExpired ? "EXPIRED" : "RENEWAL DUE"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
