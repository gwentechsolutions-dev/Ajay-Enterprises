"use client";

import * as React from "react";
import Link from "next/link";
import {
  Boxes,
  Layers,
  Truck,
  ClipboardCheck,
  AlertTriangle,
  IndianRupee,
  Building2,
  Users2,
  Warehouse as WarehouseIcon,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { TableSkeleton } from "@/components/ui/loading-states";
import { toast } from "sonner";

export default function InventoryDashboardPage() {
  const [summary, setSummary] = React.useState<any | null>(null);
  const [reportType, setReportType] = React.useState("variant_summary");
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = React.useState(true);
  const [loadingReport, setLoadingReport] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const fetchSummary = React.useCallback(async () => {
    try {
      setLoadingSummary(true);
      const res = await fetch("/api/v1/inventory/dashboard-summary");
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch {
      toast.error("Failed to load inventory metrics.");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchReport = React.useCallback(async (type: string) => {
    try {
      setLoadingReport(true);
      const res = await fetch(`/api/v1/inventory/reports?type=${type}`);
      const data = await res.json();
      if (data.success) setReportData(data.data.reportData || []);
    } catch {
      toast.error("Failed to generate stock report.");
    } finally {
      setLoadingReport(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  React.useEffect(() => {
    fetchReport(reportType);
  }, [fetchReport, reportType]);

  const REPORT_OPTIONS = [
    { value: "variant_summary", label: "1. Variant-Wise Stock Summary" },
    { value: "material_summary", label: "2. Category & Type Aggregation" },
    { value: "warehouse_stock", label: "3. Warehouse Yard Balances" },
    { value: "customer_stock", label: "4. Customer Custody Balances" },
    { value: "site_stock", label: "5. Site-Wise Live Materials" },
    { value: "ownership_stock", label: "6. Owned vs Hired-In Breakdown" },
    { value: "damaged_report", label: "7. Damaged & Repair Material" },
    { value: "missing_report", label: "8. Missing / Shortage Inventory" },
    { value: "in_transit_report", label: "9. In-Transit Lorry Cargo" },
    { value: "low_stock_report", label: "10. Low-Stock Alert Monitor" },
    { value: "movement_history", label: "11. Audit Movement Trail" },
    { value: "valuation_report", label: "12. Equipment Valuation Statement" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words">
              Inventory Intelligence & Reports
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 whitespace-nowrap">
              Live Movement Projections
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time material custody, warehouse balances, customer site tracking & statutory valuation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/materials">
            <Button variant="outline" size="sm" className="text-xs border-slate-300">
              <Layers className="h-3.5 w-3.5 mr-1" /> Material Catalogue
            </Button>
          </Link>
          <Link href="/movements">
            <Button variant="outline" size="sm" className="text-xs border-slate-300">
              <Truck className="h-3.5 w-3.5 mr-1" /> Movements Ledger
            </Button>
          </Link>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY METRIC CARDS (Section 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Owned */}
        <Card className="border-slate-200 shadow-sm p-4 bg-white">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Total Owned
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
            {loadingSummary ? "—" : summary?.totalOwnedQty?.toLocaleString() || "0"}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            AJAY ENTERPRISES Assets
          </div>
        </Card>

        {/* Hired-In */}
        <Card className="border-slate-200 shadow-sm p-4 bg-white">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Hired-In (3rd Party)
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
            {loadingSummary ? "—" : summary?.totalHiredInQty?.toLocaleString() || "0"}
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            Vendor Stock Custody
          </div>
        </Card>

        {/* In Warehouses */}
        <Card className="border-slate-200 shadow-sm p-4 bg-white">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Available in Yards
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {loadingSummary ? "—" : summary?.availableInWarehouseQty?.toLocaleString() || "0"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ready for Dispatch
          </div>
        </Card>

        {/* With Customers */}
        <Card className="border-slate-200 shadow-sm p-4 bg-white">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            With Customers
          </div>
          <div className="text-2xl font-extrabold text-blue-700 mt-1 font-mono">
            {loadingSummary ? "—" : summary?.withCustomersQty?.toLocaleString() || "0"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            On Construction Sites
          </div>
        </Card>

        {/* Damaged / Missing */}
        <Card className="border-slate-200 shadow-sm p-4 bg-white">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
            Damaged / Missing
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-1 font-mono">
            {loadingSummary ? "—" : (summary?.damagedQty + summary?.missingQty)?.toLocaleString() || "0"}
          </div>
          <div className="text-[11px] text-red-500 mt-1">
            {summary?.damagedQty || 0} Damaged • {summary?.missingQty || 0} Missing
          </div>
        </Card>
      </div>

      {/* Valuation & Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm p-5 bg-gradient-to-r from-slate-900 to-[#0B1E36] text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Equipment Purchase Cost Valuation
              </div>
              <div className="text-2xl font-bold font-mono mt-1 text-white">
                ₹{loadingSummary ? "—" : Number(summary?.totalPurchaseValuation || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div className="text-xs text-slate-300 mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
            <span>Aggregated across {summary?.totalVariantsCount || 0} material variants</span>
            {summary?.itemsWithMissingValuation > 0 ? (
              <span className="text-amber-300 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {summary.itemsWithMissingValuation} variants need cost input
              </span>
            ) : null}
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Total Asset Replacement Value
              </div>
              <div className="text-2xl font-bold font-mono mt-1 text-white">
                ₹{loadingSummary ? "—" : Number(summary?.totalReplacementValuation || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-[#F26522]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="text-xs text-slate-300 mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
            <span>Insurance & customer loss claim baseline</span>
            <span className="text-emerald-400 font-medium">Standard INR Precision</span>
          </div>
        </Card>
      </div>

      {/* 12 INVENTORY REPORTS SECTION (Section 9) */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="py-4 px-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#0B1E36]" />
              <span>Operational & Audit Reports</span>
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any of the 12 verified reporting structures for real-time ledger inspection
            </p>
          </div>

          <div className="w-full sm:w-80">
            <SearchableCombobox
              options={REPORT_OPTIONS}
              value={reportType}
              onChange={(val) => setReportType(val || "variant_summary")}
              placeholder="Select Report..."
              className="h-9 text-xs"
              allowClear={false}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1000px]">
              {/* Dynamic Headers based on selected report */}
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                {reportType === "variant_summary" ? (
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Material Variant & Size</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Rental Rate</th>
                    <th className="py-3 px-4 text-right">In Yard</th>
                    <th className="py-3 px-4 text-right">On Site</th>
                    <th className="py-3 px-4 text-right">Damaged</th>
                    <th className="py-3 px-4 text-right">Total Stock</th>
                  </tr>
                ) : reportType === "material_summary" ? (
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Material Type</th>
                    <th className="py-3 px-4 text-center">Variants Count</th>
                    <th className="py-3 px-4 text-right">Available in Yard</th>
                    <th className="py-3 px-4 text-right">Total Quantity</th>
                  </tr>
                ) : reportType === "valuation_report" ? (
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Material Variant & Size</th>
                    <th className="py-3 px-4 text-right">Total Quantity</th>
                    <th className="py-3 px-4 text-right">Purchase Cost</th>
                    <th className="py-3 px-4 text-right">Total Purchase Value</th>
                    <th className="py-3 px-4 text-right">Replacement Value</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="py-3 px-4">Location / Reference</th>
                    <th className="py-3 px-4">Material Variant</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-center">Ownership</th>
                    <th className="py-3 px-4">Last Movement</th>
                  </tr>
                )}
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loadingReport ? (
                  <TableSkeleton
                    columns={
                      reportType === "variant_summary"
                        ? 8
                        : reportType === "material_summary"
                        ? 5
                        : reportType === "valuation_report"
                        ? 6
                        : 5
                    }
                    rows={6}
                  />
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No records found for this report.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row: any, i: number) => {
                    if (reportType === "variant_summary") {
                      return (
                        <tr key={row.id || i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{row.materialCode}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name} ({row.size})</td>
                          <td className="py-2.5 px-4 text-slate-500">{row.category}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">₹{row.rentalRate?.toFixed(2)}/d</td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-bold">{row.warehouseAvailable}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-blue-700 font-bold">{row.onSiteQty}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-red-600">{row.damagedQty}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{row.totalStock} {row.uom}</td>
                        </tr>
                      );
                    }

                    if (reportType === "material_summary") {
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{row.category}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{row.materialType}</td>
                          <td className="py-2.5 px-4 text-center font-mono">{row.variantCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-bold">{row.availableQty}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-900 font-bold">{row.totalQty}</td>
                        </tr>
                      );
                    }

                    if (reportType === "valuation_report") {
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{row.materialCode}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name} ({row.size})</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">{row.totalQty} {row.uom}</td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {row.purchaseCost ? `₹${row.purchaseCost.toFixed(2)}` : <span className="text-amber-600 italic">Not Entered</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {row.totalPurchaseValuation !== null ? `₹${row.totalPurchaseValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {row.replacementValue ? `₹${row.replacementValue.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    }

                    // Generic row for other reports
                    return (
                      <tr key={row.id || i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {row.warehouse?.name || row.site?.siteName || row.movementNumber || "Facility"}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {row.materialVariant?.name || row.name} ({row.materialVariant?.size || row.size || ""})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {Number(row.availableQty || row.quantity || row.totalQty || 0)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {row.ownershipType || "OWNED"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                          {row.lastMovementAt || row.movementDate
                            ? new Date(row.lastMovementAt || row.movementDate).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

