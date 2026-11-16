"use client";

import * as React from "react";
import Link from "next/link";
import {
  HardHat,
  ArrowLeft,
  RefreshCw,
  Printer,
  Calendar,
  IndianRupee,
  ClipboardCheck,
  Users2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LabourReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"SETTLEMENTS" | "ADVANCES" | "ATTENDANCE" | "WORKERS">("SETTLEMENTS");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/labour");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load labour analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const workers = data?.workerSummary;
  const attendance = data?.attendanceSummary;
  const wages = data?.wageExpenseSummary;
  const advances = data?.advancesSummary;
  const wagesPayableBalance = data?.wagesPayableBalance;

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Labour & Workforce Analytics</h1>
          <p className="text-sm text-slate-500">
            Yard labour attendance, overtime costs, gross wage accruals, advance recovery, and Wages Payable (2070).
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

      {/* Reconciled Accounting Ledgers Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Gross Wage Accrual (5040)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{Number(wages?.totalGrossWages || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{wages?.settlementsCount || 0} settlements</div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Advances Recovered</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{Number(wages?.totalAdvancesRecovered || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Deducted from gross wages</div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Outstanding Wages Payable (2070)</div>
            <div className="text-2xl font-bold text-emerald-800 mt-1">
              ₹{Number(wagesPayableBalance || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Liability due for payout</div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Outstanding Advances Asset (1070)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{Number(advances?.outstandingAdvanceReceivable || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{advances?.advancesCount || 0} active advances</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "SETTLEMENTS", label: "Wage Settlement History" },
          { id: "ADVANCES", label: "Worker Advances & Recoveries" },
          { id: "ATTENDANCE", label: "Attendance & Overtime Summary" },
          { id: "WORKERS", label: "Workforce Category Distribution" },
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
        <div className="py-20 text-center text-slate-500 text-xs">Loading workforce analytics...</div>
      ) : (
        <>
          {/* TAB 1: SETTLEMENTS */}
          {activeTab === "SETTLEMENTS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Labour Wage Settlement Register</CardTitle>
                <CardDescription className="text-xs">
                  Periodic gross wage calculations, advance recoveries, and net payable disbursement status
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Settlement #</th>
                        <th className="px-4 py-3">Worker Name</th>
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3 text-right">Gross Wage (₹)</th>
                        <th className="px-4 py-3 text-right">Advance Recovery (₹)</th>
                        <th className="px-4 py-3 text-right">Net Payable (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(wages?.recentSettlements || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.settlementNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{s.workerName}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {new Date(s.periodStartDate).toLocaleDateString("en-IN")} – {new Date(s.periodEndDate).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">₹{Number(s.grossWageAmount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-blue-700">₹{Number(s.advanceDeductionAmount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">₹{Number(s.netPayableAmount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant={s.paymentStatus === "PAID" ? "success" : "warning"} className="text-[10px]">
                              {s.paymentStatus}
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

          {/* TAB 2: ADVANCES */}
          {activeTab === "ADVANCES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Worker Advances & Recovery Schedule (Account 1070)</CardTitle>
                <CardDescription className="text-xs">Advances issued, recovered portions, and active remaining balances</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Advance #</th>
                        <th className="px-4 py-3">Worker Name</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Advance Amount (₹)</th>
                        <th className="px-4 py-3 text-right">Recovered (₹)</th>
                        <th className="px-4 py-3 text-right">Remaining Balance (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(advances?.activeAdvances || []).map((a: any) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{a.advanceNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{a.workerName}</td>
                          <td className="px-4 py-2.5 text-slate-500">{new Date(a.advanceDate).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-medium">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-700">₹{Number(a.recoveredAmount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-amber-800">₹{Number(a.remainingAmount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant={a.status === "ACTIVE" ? "warning" : "secondary"} className="text-[10px]">
                              {a.status}
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

          {/* TAB 3: ATTENDANCE */}
          {activeTab === "ATTENDANCE" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Attendance & Overtime Summary</CardTitle>
                <CardDescription className="text-xs">Summary of present days, half days, and overtime costs</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Full Days Present</div>
                    <div className="text-xl font-bold text-emerald-700 mt-1">{attendance?.presentCount || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Half Days</div>
                    <div className="text-xl font-bold text-amber-700 mt-1">{attendance?.halfDayCount || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Overtime Hours</div>
                    <div className="text-xl font-bold text-[#0B1E36] mt-1">{Number(attendance?.totalOvertimeHours || 0)} Hrs</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Total Overtime Pay</div>
                    <div className="text-xl font-bold text-orange-700 mt-1">₹{Number(attendance?.totalOvertimePay || 0).toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: WORKERS */}
          {activeTab === "WORKERS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Active Workforce Category Breakdown</CardTitle>
                <CardDescription className="text-xs">Yard workers, loaders, centering technicians, and maintenance staff</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Worker Category</th>
                      <th className="px-4 py-3 text-right">Active Worker Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(workers?.categoryBreakdown || []).map((cat: any) => (
                      <tr key={cat.category} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{cat.category}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">{cat.count}</td>
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
