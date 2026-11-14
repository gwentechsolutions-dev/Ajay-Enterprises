"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users2,
  ArrowLeft,
  RefreshCw,
  Printer,
  TrendingUp,
  AlertTriangle,
  Building,
  DollarSign,
  Boxes,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CustomerReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"PERFORMANCE" | "AGEING" | "HELD_STOCK" | "PROFITABILITY">("PERFORMANCE");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/customers");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load customer analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const master = data?.masterSummary;
  const performance = data?.customerPerformance || [];
  const ageing = data?.ageingBuckets || [];
  const heldStock = data?.heldStockByCustomer || [];
  const profitability = data?.profitability || [];

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Customer & Receivable Analytics</h1>
          <p className="text-sm text-slate-500">
            Debtor ageing buckets, customer collections, physical equipment custody, and site-level profitability.
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

      {/* Master KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Total Customers</div>
          <div className="text-xl font-bold text-[#0B1E36] mt-1">{master?.totalCustomers || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active: {master?.activeCustomers || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">GST Registered</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{master?.gstRegistered || 0}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">B2B Taxable</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Non-GST Customers</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{master?.nonGst || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Unregistered</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Debtors (Ageing)</div>
          <div className="text-xl font-bold text-orange-600 mt-1">{ageing.length}</div>
          <div className="text-[11px] text-orange-500 mt-0.5">With overdue balances</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Custody Accounts</div>
          <div className="text-xl font-bold text-blue-900 mt-1">{heldStock.length}</div>
          <div className="text-[11px] text-blue-500 mt-0.5">Holding material</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "PERFORMANCE", label: "Customer Invoicing & Collections" },
          { id: "AGEING", label: `Debtor Ageing Buckets (${ageing.length})` },
          { id: "HELD_STOCK", label: "Material Held by Customer" },
          { id: "PROFITABILITY", label: "Site-wise Margin & Profitability" },
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
        <div className="py-20 text-center text-slate-500 text-xs">Loading customer analytics...</div>
      ) : (
        <>
          {/* TAB 1: PERFORMANCE */}
          {activeTab === "PERFORMANCE" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Customer Ledger Performance Summary</CardTitle>
                <CardDescription className="text-xs">Billed sales & rental invoices vs actual payment collections</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">GSTIN</th>
                        <th className="px-4 py-3 text-right">Sites</th>
                        <th className="px-4 py-3 text-right">Total Invoiced (₹)</th>
                        <th className="px-4 py-3 text-right">Total Collected (₹)</th>
                        <th className="px-4 py-3 text-right">Outstanding (₹)</th>
                        <th className="px-4 py-3 text-right">Overdue (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {performance.map((c: any) => (
                        <tr key={c.customerId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{c.customerCode}</td>
                          <td className="px-4 py-2.5 font-medium">{c.customerName}</td>
                          <td className="px-4 py-2.5 text-slate-500">{c.gstin}</td>
                          <td className="px-4 py-2.5 text-right">{c.sitesCount}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{Number(c.totalBilled).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-700">{Number(c.totalCollected).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{Number(c.totalOutstanding).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(c.overdueAmount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: AGEING */}
          {activeTab === "AGEING" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Accounts Receivable Ageing Analysis</CardTitle>
                <CardDescription className="text-xs">Statutory 4-bucket ageing schedule for overdue customer invoices</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">0–30 Days (₹)</th>
                        <th className="px-4 py-3 text-right">31–60 Days (₹)</th>
                        <th className="px-4 py-3 text-right">61–90 Days (₹)</th>
                        <th className="px-4 py-3 text-right">90+ Days (₹)</th>
                        <th className="px-4 py-3 text-right">Total Due (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {ageing.map((a: any) => (
                        <tr key={a.customerId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{a.customerName}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{Number(a.bucket0_30).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right text-amber-700">{Number(a.bucket31_60).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right text-orange-700">{Number(a.bucket61_90).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(a.bucket90Plus).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">{Number(a.totalOutstanding).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: HELD STOCK */}
          {activeTab === "HELD_STOCK" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Material Custody by Customer</CardTitle>
                <CardDescription className="text-xs">Total centering material quantities currently deployed in customer field custody</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3 text-right">Active Batches</th>
                        <th className="px-4 py-3 text-right">Total Held Quantity</th>
                        <th className="px-4 py-3 text-right">Est. Daily Accrual (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {heldStock.map((h: any) => (
                        <tr key={h.customerId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{h.customerCode}</td>
                          <td className="px-4 py-2.5 font-medium">{h.customerName}</td>
                          <td className="px-4 py-2.5 text-right">{h.batchesCount}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{Number(h.totalHeldQty).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{Number(h.totalDailyAccrual).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: PROFITABILITY */}
          {activeTab === "PROFITABILITY" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Customer Site-wise Margin & Profitability</CardTitle>
                <CardDescription className="text-xs">
                  Reconciles attributed revenue against directly attributable damages and direct site logistics. (Calculated actual records, not estimates).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">Construction Site</th>
                        <th className="px-4 py-3 text-right">Attributed Revenue (₹)</th>
                        <th className="px-4 py-3 text-right">Direct Costs (₹)</th>
                        <th className="px-4 py-3 text-right">Net Margin (₹)</th>
                        <th className="px-4 py-3 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {profitability.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{p.customerName}</td>
                          <td className="px-4 py-2.5 text-slate-700">{p.siteName}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{Number(p.attributedRevenue).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{Number(p.attributedCosts).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{Number(p.netMargin).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">{p.marginPct}%</td>
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
