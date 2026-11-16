"use client";

import * as React from "react";
import Link from "next/link";
import {
  ReceiptIndianRupee,
  ArrowLeft,
  RefreshCw,
  Download,
  Printer,
  Boxes,
  ArrowLeftRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RentalReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"UTILIZATION" | "TRANSFERS" | "MONTHLY" | "CUSTOMERS" | "BATCHES" | "UNINVOICED">("UTILIZATION");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/rentals");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load rental analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const ut = data?.materialUtilization;
  const dst = data?.directTransferAnalytics;
  const monthly = data?.monthlyRevenue || [];
  const custRev = data?.customerRevenue || [];
  const batches = data?.activeBatches || [];
  const uninvoiced = data?.uninvoicedStatements;

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Rental Business & Utilization Analytics</h1>
          <p className="text-sm text-slate-500">
            Centering material deployment, batch daily holding, rate analysis, and direct site-to-site transfer tracking.
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "UTILIZATION", label: "Material Utilization (OWNED vs HIRED)" },
          { id: "TRANSFERS", label: "Direct Site Transfers (DSTN)" },
          { id: "MONTHLY", label: "Monthly Revenue" },
          { id: "CUSTOMERS", label: "Customer Performance" },
          { id: "BATCHES", label: "Active Rental Batches" },
          { id: "UNINVOICED", label: `Uninvoiced Statements (${uninvoiced?.count || 0})` },
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

      {/* Tab Contents */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Loading rental analytics...</div>
      ) : (
        <>
          {/* TAB 1: MATERIAL UTILIZATION */}
          {activeTab === "UTILIZATION" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Owned Utilization Rate</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{ut?.owned?.utilizationRatePct || 0}%</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">At customer sites / eligible owned</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Owned at Customer Sites</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {Number(ut?.owned?.atCustomerSites || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">Earning daily rental</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Owned in Warehouse</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {Number(ut?.owned?.availableInWarehouse || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Available for hire</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Under Repair / Damaged</div>
                    <div className="text-2xl font-bold text-amber-800 mt-1">
                      {Number(ut?.owned?.underRepair || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Scrapped: {Number(ut?.owned?.scrapped || 0)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Strict OWNED vs HIRED_IN Segregation Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Equipment Pool Segregation (Rule #17)</CardTitle>
                  <CardDescription className="text-xs">
                    OWNED equipment belonging to AJAY ENTERPRISES and HIRED-IN third-party custody materials remain strictly partitioned.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-sm text-[#0B1E36] flex items-center justify-between">
                        <span>AJAY ENTERPRISES Owned Fleet</span>
                        <Badge variant="default" className="bg-[#0B1E36]">OWNED</Badge>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                        <div className="flex justify-between"><span>Total Eligible Inventory:</span> <strong>{Number(ut?.owned?.totalEligibleOwned || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="flex justify-between"><span>At Customer Sites:</span> <strong>{Number(ut?.owned?.atCustomerSites || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="flex justify-between"><span>In Warehouse Yard:</span> <strong>{Number(ut?.owned?.availableInWarehouse || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="flex justify-between"><span>In Maintenance:</span> <strong>{Number(ut?.owned?.underRepair || 0).toLocaleString("en-IN")}</strong></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-sm text-slate-800 flex items-center justify-between">
                        <span>Third-Party Hired-In Equipment</span>
                        <Badge variant="outline" className="border-slate-400 text-slate-700">HIRED_IN</Badge>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                        <div className="flex justify-between"><span>At Customer Sites:</span> <strong>{Number(ut?.hiredIn?.atCustomerSites || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="flex justify-between"><span>In Warehouse:</span> <strong>{Number(ut?.hiredIn?.availableInWarehouse || 0).toLocaleString("en-IN")}</strong></div>
                        <div className="flex justify-between"><span>Damaged / Quarantined:</span> <strong>{Number(ut?.hiredIn?.damaged || 0).toLocaleString("en-IN")}</strong></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: DIRECT SITE TRANSFERS */}
          {activeTab === "TRANSFERS" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Direct Site Transfers</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{dst?.totalTransfers || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Site-to-site notes</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Dispatched Quantity</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{Number(dst?.totalDispatched || 0).toLocaleString("en-IN")}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">From source sites</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Accepted at Destination</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{Number(dst?.totalAccepted || 0).toLocaleString("en-IN")}</div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">{dst?.reconciliationRatePct || 100}% reconciled</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Discrepancies (Dmg/Miss/Rej)</div>
                    <div className="text-2xl font-bold text-orange-700 mt-1">
                      {Number(Number(dst?.totalDamaged || 0) + Number(dst?.totalMissing || 0) + Number(dst?.totalRejected || 0)).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Tracked in repair / custody</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Direct Transfer Custody Ledger</CardTitle>
                  <CardDescription className="text-xs">Direct Site-to-Site Transfer Notes (DSTN) linking source and destination agreements</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="px-4 py-3">Transfer #</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Source Customer</th>
                          <th className="px-4 py-3">Destination Customer</th>
                          <th className="px-4 py-3">Responsible Party</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(dst?.transfersSample || []).map((t: any) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{t.transferNumber}</td>
                            <td className="px-4 py-2.5 text-slate-600">{new Date(t.transferDate).toLocaleDateString("en-IN")}</td>
                            <td className="px-4 py-2.5 font-medium">{t.sourceCustomer}</td>
                            <td className="px-4 py-2.5 font-medium">{t.destinationCustomer}</td>
                            <td className="px-4 py-2.5 text-slate-500">{t.responsibleParty || "UNDER_INVESTIGATION"}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: MONTHLY REVENUE */}
          {activeTab === "MONTHLY" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Monthly Rental Statement Billings</CardTitle>
                <CardDescription className="text-xs">Aggregated rental charges, damage recoveries, and net payable amounts</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3 text-right">Rental Amount (₹)</th>
                        <th className="px-4 py-3 text-right">Damage / Loss Charges (₹)</th>
                        <th className="px-4 py-3 text-right">Net Billed (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {monthly.map((m: any) => (
                        <tr key={m.month} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{m.month}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{Number(m.rental).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{Number(m.damages).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">{Number(m.net).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: CUSTOMERS */}
          {activeTab === "CUSTOMERS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Customer Rental Revenue Ranking</CardTitle>
                <CardDescription className="text-xs">Top customers by rental volume and statement history</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3 text-right">Statements</th>
                        <th className="px-4 py-3 text-right">Rental Total (₹)</th>
                        <th className="px-4 py-3 text-right">Net Payable (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {custRev.map((c: any) => (
                        <tr key={c.customerId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{c.customerCode}</td>
                          <td className="px-4 py-2.5 font-medium">{c.customerName}</td>
                          <td className="px-4 py-2.5 text-right">{c.statementsCount}</td>
                          <td className="px-4 py-2.5 text-right">{Number(c.totalRental).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{Number(c.netPayable).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: ACTIVE BATCHES */}
          {activeTab === "BATCHES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Live Rental Batches on Site</CardTitle>
                <CardDescription className="text-xs">Physical materials currently deployed at customer construction sites earning daily rental</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Batch #</th>
                        <th className="px-4 py-3">Customer & Site</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Ownership</th>
                        <th className="px-4 py-3 text-right">Held Qty</th>
                        <th className="px-4 py-3 text-right">Daily Rate</th>
                        <th className="px-4 py-3 text-right">Daily Accrual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {batches.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{b.batchNumber}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{b.customerName}</div>
                            <div className="text-[11px] text-slate-400">{b.siteName}</div>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{b.variantName}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{b.ownershipType}</Badge></td>
                          <td className="px-4 py-2.5 text-right font-bold">{Number(b.currentHeldQty).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right">₹{Number(b.applicableDailyRate).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">₹{Number(b.estimatedDailyRental).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: UNINVOICED STATEMENTS */}
          {activeTab === "UNINVOICED" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Finalized Statements Awaiting Invoicing</CardTitle>
                <CardDescription className="text-xs">Statements that are finalized by operations but pending conversion to formal Tax Invoices</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Statement #</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Site</th>
                        <th className="px-4 py-3 text-right">Finalized Date</th>
                        <th className="px-4 py-3 text-right">Days Pending</th>
                        <th className="px-4 py-3 text-right">Net Payable (₹)</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(uninvoiced?.items || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.statementNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{s.customerName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.siteName}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {s.finalizedAt ? new Date(s.finalizedAt).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-semibold text-orange-600">{s.daysSinceFinalized} days</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            {Number(s.netPayableAmount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/invoices`}>
                              <Button size="sm" variant="outline" className="text-[11px] h-7 border-slate-300">
                                Create Invoice
                              </Button>
                            </Link>
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
