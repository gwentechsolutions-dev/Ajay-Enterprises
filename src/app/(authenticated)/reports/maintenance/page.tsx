"use client";

import * as React from "react";
import Link from "next/link";
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  Printer,
  Wrench,
  AlertTriangle,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MaintenanceReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"JOBS" | "WAREHOUSES" | "VARIANTS" | "SCRAP">("JOBS");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/maintenance");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load maintenance analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.repairSummary;
  const warehouses = data?.warehouseRepairCosts || [];
  const variants = data?.variantRepairSummary || [];
  const scrap = data?.scrapSummary;
  const jobs = data?.repairJobsList || [];

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Centering Material Repair & Reconditioning</h1>
          <p className="text-sm text-slate-500">
            Centering equipment maintenance, warehouse yard reconditioning jobs, parts & labor expenses, and scrap tracking.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Open Repair Jobs</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary?.openJobs || 0}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Awaiting Insp: {summary?.awaitingInspection || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Completed Repairs</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{summary?.completedJobs || 0}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Restored to active stock</div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Total Repair Expense</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{Number(summary?.totalRepairCost || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Parts: ₹{Number(summary?.totalPartsCost || 0).toLocaleString("en-IN")} | Labor: ₹{Number(summary?.totalLabourCost || 0).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Scrapped Beyond Repair</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {Number(summary?.totalScrappedQuantity || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-red-500 mt-0.5">Condemned units</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "JOBS", label: "Active & Completed Repair Jobs" },
          { id: "WAREHOUSES", label: "Yard-wise Reconditioning Costs" },
          { id: "VARIANTS", label: "Variant Maintenance Summary" },
          { id: "SCRAP", label: `Scrap Log (${scrap?.records?.length || 0})` },
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
        <div className="py-20 text-center text-slate-500 text-xs">Loading repair analytics...</div>
      ) : (
        <>
          {/* TAB 1: JOBS */}
          {activeTab === "JOBS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Centering Equipment Repair Jobs</CardTitle>
                <CardDescription className="text-xs">
                  Reconditioning jobs logged for props, span joists, sheets, and scaffolding in warehouse yards
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Job Code</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Warehouse Yard</th>
                        <th className="px-4 py-3 text-right">Total Qty</th>
                        <th className="px-4 py-3 text-right">Repaired</th>
                        <th className="px-4 py-3 text-right">Scrapped</th>
                        <th className="px-4 py-3 text-right">Repair Cost (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {jobs.map((j: any) => (
                        <tr key={j.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{j.jobCode}</td>
                          <td className="px-4 py-2.5 font-medium">{j.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{j.warehouseName}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{Number(j.totalQuantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{Number(j.repairedQuantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(j.scrappedQuantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(j.totalCost).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant={j.status === "COMPLETED" ? "success" : "warning"} className="text-[10px]">
                              {j.status}
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

          {/* TAB 2: WAREHOUSES */}
          {activeTab === "WAREHOUSES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Warehouse Yard Maintenance Expenditure</CardTitle>
                <CardDescription className="text-xs">Repair cost allocation across central yards and godowns</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Warehouse Yard</th>
                      <th className="px-4 py-3 text-right">Jobs Count</th>
                      <th className="px-4 py-3 text-right">Repaired Units</th>
                      <th className="px-4 py-3 text-right">Scrapped Units</th>
                      <th className="px-4 py-3 text-right">Parts Cost (₹)</th>
                      <th className="px-4 py-3 text-right">Labour Cost (₹)</th>
                      <th className="px-4 py-3 text-right">Total Expenditure (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {warehouses.map((w: any) => (
                      <tr key={w.warehouseId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{w.warehouseName}</td>
                        <td className="px-4 py-2.5 text-right">{w.jobsCount}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-800">{Number(w.repairedQuantity).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600">{Number(w.scrappedQuantity).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right font-medium">₹{Number(w.partsCost).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right font-medium">₹{Number(w.labourCost).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(w.totalCost).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: VARIANTS */}
          {activeTab === "VARIANTS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Material Variant Reconditioning Summary</CardTitle>
                <CardDescription className="text-xs">Highest maintenance cost centering items</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Material Variant</th>
                      <th className="px-4 py-3 text-right">Jobs Logged</th>
                      <th className="px-4 py-3 text-right">Repaired Quantity</th>
                      <th className="px-4 py-3 text-right">Accumulated Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {variants.map((v: any) => (
                      <tr key={v.variantId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{v.variantCode}</td>
                        <td className="px-4 py-2.5 font-medium">{v.variantName}</td>
                        <td className="px-4 py-2.5 text-right">{v.jobsCount}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-800">{Number(v.repairedQuantity).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(v.totalCost).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: SCRAP */}
          {activeTab === "SCRAP" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Centering Equipment Condemnation & Scrap Log</CardTitle>
                <CardDescription className="text-xs">Materials written off after structural inspection</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Job Code</th>
                      <th className="px-4 py-3">Material Variant</th>
                      <th className="px-4 py-3">Yard</th>
                      <th className="px-4 py-3 text-right">Scrapped Qty</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(scrap?.records || []).map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.jobCode}</td>
                        <td className="px-4 py-2.5 font-medium">{s.variantName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{s.warehouseName}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(s.scrappedQuantity).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-slate-500">{s.damageDescription}</td>
                        <td className="px-4 py-2.5 text-slate-500">{new Date(s.date).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
