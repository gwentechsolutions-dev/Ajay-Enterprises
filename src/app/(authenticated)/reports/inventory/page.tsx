"use client";

import * as React from "react";
import Link from "next/link";
import {
  Boxes,
  ArrowLeft,
  RefreshCw,
  Printer,
  AlertTriangle,
  History,
  ClipboardCheck,
  Layers,
  Warehouse,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function InventoryReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"SUMMARY" | "WAREHOUSES" | "SITES" | "MOVEMENTS" | "DAMAGES" | "MISSING" | "SCRAP" | "INTELLIGENCE">("SUMMARY");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/inventory");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load inventory analytics", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const stockSummary = data?.stockSummary || [];
  const warehouseWise = data?.warehouseWiseStock || [];
  const siteCustody = data?.siteWiseStock || [];
  const movements = data?.recentMovements || [];
  const damages = data?.damageRegister || [];
  const missing = data?.missingRegister;
  const scrap = data?.scrapRegister;
  const intelligence = data?.damageIntelligence;

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Inventory & Material Custody Analytics</h1>
          <p className="text-sm text-slate-500">
            Physical stock balances, warehouse vs site custody, immutable movement registers, scrap, and damage intelligence.
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
          { id: "SUMMARY", label: "Stock Balances Master" },
          { id: "WAREHOUSES", label: "Warehouse-wise Yards" },
          { id: "SITES", label: "Site-wise Field Custody" },
          { id: "MOVEMENTS", label: "Movements Register" },
          { id: "DAMAGES", label: "Damaged Materials" },
          { id: "MISSING", label: `Missing Under Investigation (${missing?.records?.length || 0})` },
          { id: "SCRAP", label: "Scrap & Write-Offs" },
          { id: "INTELLIGENCE", label: "Damage Intelligence" },
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
        <div className="py-20 text-center text-slate-500 text-xs">Loading inventory analytics...</div>
      ) : (
        <>
          {/* TAB 1: SUMMARY */}
          {activeTab === "SUMMARY" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Current Physical Stock Balances</CardTitle>
                <CardDescription className="text-xs">Segregated OWNED and HIRED_IN balances by variant and category</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Category / Type</th>
                        <th className="px-4 py-3">UOM</th>
                        <th className="px-4 py-3 text-right">Owned Avail</th>
                        <th className="px-4 py-3 text-right">Owned Damaged</th>
                        <th className="px-4 py-3 text-right">Hired Avail</th>
                        <th className="px-4 py-3 text-right">Total Avail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {stockSummary.map((s: any) => (
                        <tr key={s.variantId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.variantCode}</td>
                          <td className="px-4 py-2.5 font-medium">{s.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-500">{s.categoryName} · {s.typeName}</td>
                          <td className="px-4 py-2.5">{s.uom}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-800">{Number(s.ownedAvailable).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-amber-700">{Number(s.ownedDamaged).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-blue-800">{Number(s.hiredAvailable).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            {Number(Number(s.ownedAvailable) + Number(s.hiredAvailable)).toLocaleString("en-IN")}
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
                <CardTitle className="text-base text-[#0B1E36]">Warehouse Yard Stock Allocation</CardTitle>
                <CardDescription className="text-xs">Physical quantities held at AJAY ENTERPRISES central warehouses and storage yards</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Warehouse / Yard Name</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3 text-right">Owned Available</th>
                        <th className="px-4 py-3 text-right">Owned Damaged</th>
                        <th className="px-4 py-3 text-right">Hired Available</th>
                        <th className="px-4 py-3 text-right">Total Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {warehouseWise.map((w: any) => (
                        <tr key={w.warehouseId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{w.code}</td>
                          <td className="px-4 py-2.5 font-medium">{w.name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{w.city || "Tamil Nadu"}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-800">{Number(w.ownedAvailable).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-amber-700">{Number(w.ownedDamaged).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-blue-800">{Number(w.hiredAvailable).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{Number(w.totalAvailable).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: SITES */}
          {activeTab === "SITES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Construction Site Material Custody</CardTitle>
                <CardDescription className="text-xs">Centering materials deployed at client sites under active rental batches</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Site Code</th>
                        <th className="px-4 py-3">Construction Site</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Variants Deployed</th>
                        <th className="px-4 py-3 text-right">Owned Held</th>
                        <th className="px-4 py-3 text-right">Hired Held</th>
                        <th className="px-4 py-3 text-right">Total Quantity Held</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {siteCustody.map((s: any) => (
                        <tr key={s.siteId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.siteCode}</td>
                          <td className="px-4 py-2.5 font-medium">{s.siteName}</td>
                          <td className="px-4 py-2.5 text-slate-700">{s.customerName}</td>
                          <td className="px-4 py-2.5 text-right">{s.variantsCount}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{Number(s.ownedHeld).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-blue-700">{Number(s.hiredHeld).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">{Number(s.totalHeld).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: MOVEMENTS */}
          {activeTab === "MOVEMENTS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Immutable Inventory Movement Register</CardTitle>
                <CardDescription className="text-xs">Append-only operational movements (DN, MRN, STN, DSTN, PO, Scrap)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Movement Type</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">To</th>
                        <th className="px-4 py-3">Pool</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {movements.map((m: any) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              {m.movementType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{new Date(m.movementDate).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-2.5 font-medium">{m.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-500">{m.source}</td>
                          <td className="px-4 py-2.5 text-slate-500">{m.destination}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{m.ownershipType}</Badge></td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{Number(m.quantity).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: DAMAGES */}
          {activeTab === "DAMAGES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Damaged Materials Register</CardTitle>
                <CardDescription className="text-xs">Equipment damage assessments linked to MRNs or Direct Transfers</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Assessment #</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Customer / Site</th>
                        <th className="px-4 py-3">Damage Classification</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Assessed Cost (₹)</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {damages.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{d.assessmentNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{d.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{d.customerName}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{d.damageType}</Badge></td>
                          <td className="px-4 py-2.5 text-right font-bold text-amber-700">{Number(d.quantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-medium">₹{Number(d.assessedCost || 0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{d.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: MISSING */}
          {activeTab === "MISSING" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Missing Materials Under Investigation</CardTitle>
                <CardDescription className="text-xs">
                  Materials missing on return or direct transfer awaiting customer recovery or write-off confirmation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Assessment #</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Customer & Site</th>
                        <th className="px-4 py-3 text-right">Missing Qty</th>
                        <th className="px-4 py-3 text-right">Assessed Value (₹)</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(missing?.records || []).map((m: any) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-red-700">{m.assessmentNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{m.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{m.customerName}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(m.quantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-medium">₹{Number(m.assessedCost || 0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5"><Badge variant="destructive" className="text-[10px]">{m.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 7: SCRAP */}
          {activeTab === "SCRAP" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Scrap and Write-Off Register</CardTitle>
                <CardDescription className="text-xs">Units condemned beyond repair and permanently written off from asset registers</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Repair Job #</th>
                        <th className="px-4 py-3">Material Variant</th>
                        <th className="px-4 py-3">Warehouse Yard</th>
                        <th className="px-4 py-3 text-right">Scrapped Quantity</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(scrap?.records || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{s.jobCode}</td>
                          <td className="px-4 py-2.5 font-medium">{s.variantName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.warehouseName}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(s.scrappedQuantity).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-slate-500">{new Date(s.updatedAt).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 8: DAMAGE INTELLIGENCE */}
          {activeTab === "INTELLIGENCE" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Top Most Frequently Damaged Materials</CardTitle>
                  <CardDescription className="text-xs">Materials experiencing highest damage incidents during return inspection</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="px-4 py-3">Variant</th>
                          <th className="px-4 py-3 text-right">Incidents</th>
                          <th className="px-4 py-3 text-right">Damaged Qty</th>
                          <th className="px-4 py-3 text-right">Cost (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(intelligence?.topDamagedMaterials || []).map((m: any) => (
                          <tr key={m.variantId} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium">{m.variantName}</td>
                            <td className="px-4 py-2.5 text-right">{m.incidentsCount}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-amber-700">{Number(m.totalQuantity).toLocaleString("en-IN")}</td>
                            <td className="px-4 py-2.5 text-right font-medium">₹{Number(m.totalAssessedCost).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Customer-wise Damage Exposure</CardTitle>
                  <CardDescription className="text-xs">Clients with highest accumulated damage and missing material claims</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3 text-right">Incidents</th>
                          <th className="px-4 py-3 text-right">Units Damaged</th>
                          <th className="px-4 py-3 text-right">Billed Claims (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(intelligence?.customerDamageHistory || []).map((c: any) => (
                          <tr key={c.customerId} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium">{c.customerName}</td>
                            <td className="px-4 py-2.5 text-right">{c.incidentsCount}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-600">{Number(c.damagedQuantity).toLocaleString("en-IN")}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[#0B1E36]">₹{Number(c.billedAmount).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
