"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  ReceiptIndianRupee,
  Users2,
  Boxes,
  Scale,
  Truck,
  HardHat,
  Layers,
  ArrowRight,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const REPORT_MODULES = [
  {
    title: "Rental Business Analytics",
    href: "/reports/rentals",
    icon: ReceiptIndianRupee,
    color: "bg-blue-50 text-[#0B1E36] border-blue-200",
    description: "Monthly rental revenue, active batches, customer & site rental performance, material utilization (OWNED vs HIRED_IN), and direct site transfers.",
    kpis: ["12 Reports", "Utilization %", "Site Transfers"],
  },
  {
    title: "Customer & Receivable Analytics",
    href: "/reports/customers",
    icon: Users2,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    description: "Customer master summary, customer-wise invoicing & collections, 4-bucket ageing (0-30, 31-60, 61-90, 90+ days), and site-wise profitability.",
    kpis: ["Ageing Buckets", "Overdue Invoices", "Site Profitability"],
  },
  {
    title: "Inventory & Material Analytics",
    href: "/reports/inventory",
    icon: Boxes,
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Current stock summary, warehouse vs site custody, material movement register, scrap register, audit differences, and damage intelligence.",
    kpis: ["Movement Ledger", "Custody Summary", "Scrap & Losses"],
  },
  {
    title: "Financial Statements & GST",
    href: "/reports/financial",
    icon: Scale,
    color: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Trial Balance, Profit & Loss, Balance Sheet, Cash & Bank reconciliations, GST Summary, GSTR-1 & GSTR-3B tax preparation summaries.",
    kpis: ["Trial Balance", "Balance Sheet", "GSTR-1 & 3B"],
  },
  {
    title: "Company Fleet & Logistics",
    href: "/reports/fleet",
    icon: Truck,
    color: "bg-cyan-50 text-cyan-800 border-cyan-200",
    description: "Company-owned vehicles, vehicle trip history, distance travelled, fuel consumption & mileage (km/L), maintenance costs, and statutory expiries.",
    kpis: ["Company Fleet Only", "Fuel Mileage", "Document Expiries"],
  },
  {
    title: "Labour & Workforce Analytics",
    href: "/reports/labour",
    icon: HardHat,
    color: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Active workers by category, daily/monthly attendance, overtime pay, monthly wage accruals, advance recoveries, and wages payable (2070).",
    kpis: ["Daily Attendance", "Wage Settlements", "Advance Recovery"],
  },
  {
    title: "Centering Material Repairs",
    href: "/reports/maintenance",
    icon: Layers,
    color: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Centering equipment repair jobs, warehouse reconditioning costs, parts & labour expenses, scrap quantities, and repeated damage patterns.",
    kpis: ["Material Reconditioning", "Parts & Labour", "Segregated from Fleet"],
  },
];

export default function ReportsHubPage() {
  const [selectedCategory, setSelectedCategory] = React.useState("RENTALS");
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [columns, setColumns] = React.useState<any[]>([]);
  const [reportTitle, setReportTitle] = React.useState("Active Rental Batches Summary");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState<"CSV" | "PRINT" | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const loadReportPreview = React.useCallback(async (cat: string) => {
    setIsLoading(true);
    try {
      if (cat === "RENTALS") {
        const res = await fetch("/api/v1/reports/rentals");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Active Rental Batches Summary");
          setColumns([
            { header: "Batch #", key: "batchNumber" },
            { header: "Customer", key: "customerName" },
            { header: "Site", key: "siteName" },
            { header: "Material Variant", key: "variantName" },
            { header: "Ownership", key: "ownershipType" },
            { header: "Delivered Qty", key: "deliveredQty", align: "right" },
            { header: "Current Held Qty", key: "currentHeldQty", align: "right" },
            { header: "Daily Rate (₹)", key: "applicableDailyRate", align: "right" },
            { header: "Running Days", key: "runningDays", align: "right" },
          ]);
          setReportData(json.data.activeBatches || []);
        }
      } else if (cat === "CUSTOMERS") {
        const res = await fetch("/api/v1/reports/customers");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Customer Receivables & Performance Summary");
          setColumns([
            { header: "Code", key: "customerCode" },
            { header: "Customer Name", key: "customerName" },
            { header: "Mobile", key: "mobile" },
            { header: "GSTIN", key: "gstin" },
            { header: "Sites", key: "sitesCount", align: "right" },
            { header: "Total Billed (₹)", key: "totalBilled", align: "right" },
            { header: "Outstanding (₹)", key: "totalOutstanding", align: "right" },
            { header: "Overdue (₹)", key: "overdueAmount", align: "right" },
          ]);
          setReportData(json.data.customerPerformance || []);
        }
      } else if (cat === "INVENTORY") {
        const res = await fetch("/api/v1/reports/inventory");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Current Stock & Custody Summary");
          setColumns([
            { header: "Variant Code", key: "variantCode" },
            { header: "Variant Name", key: "variantName" },
            { header: "Category", key: "categoryName" },
            { header: "Type", key: "typeName" },
            { header: "UOM", key: "uom" },
            { header: "Owned Available", key: "ownedAvailable", align: "right" },
            { header: "Owned Damaged", key: "ownedDamaged", align: "right" },
            { header: "Hired Available", key: "hiredAvailable", align: "right" },
          ]);
          setReportData(json.data.stockSummary || []);
        }
      } else if (cat === "FLEET") {
        const res = await fetch("/api/v1/reports/fleet");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Company-Owned Fleet Performance & Fuel Mileage");
          setColumns([
            { header: "Registration #", key: "registrationNumber" },
            { header: "Make & Model", key: "makeModel" },
            { header: "Status", key: "status" },
            { header: "Total KM", key: "totalKmTravelled", align: "right" },
            { header: "Trips", key: "tripsCount", align: "right" },
            { header: "Fuel (Ltrs)", key: "totalFuelLiters", align: "right" },
            { header: "Fuel Cost (₹)", key: "totalFuelCost", align: "right" },
            { header: "Mileage (km/L)", key: "mileageKmPerLiter", align: "right" },
          ]);
          setReportData(json.data.vehicleStats || []);
        }
      } else if (cat === "LABOUR") {
        const res = await fetch("/api/v1/reports/labour");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Labour Wage Settlements & Advance Recovery Summary");
          setColumns([
            { header: "Settlement #", key: "settlementNumber" },
            { header: "Worker Name", key: "workerName" },
            { header: "Gross Wage (₹)", key: "grossWageAmount", align: "right" },
            { header: "Advance Recovered (₹)", key: "advanceDeductionAmount", align: "right" },
            { header: "Net Payable (₹)", key: "netPayableAmount", align: "right" },
            { header: "Status", key: "paymentStatus" },
          ]);
          setReportData(json.data.wageExpenseSummary?.recentSettlements || []);
        }
      } else if (cat === "MAINTENANCE") {
        const res = await fetch("/api/v1/reports/maintenance");
        const json = await res.json();
        if (json.success) {
          setReportTitle("Centering Material Reconditioning & Repair Costs");
          setColumns([
            { header: "Job #", key: "jobCode" },
            { header: "Material Variant", key: "variantName" },
            { header: "Warehouse Yard", key: "warehouseName" },
            { header: "Total Qty", key: "totalQuantity", align: "right" },
            { header: "Repaired", key: "repairedQuantity", align: "right" },
            { header: "Scrapped", key: "scrappedQuantity", align: "right" },
            { header: "Total Cost (₹)", key: "totalCost", align: "right" },
            { header: "Status", key: "status" },
          ]);
          setReportData(json.data.repairJobsList || []);
        }
      }
    } catch (err) {
      console.error("Failed to load report preview", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReportPreview(selectedCategory);
  }, [selectedCategory, loadReportPreview]);

  const handleExport = async (format: "CSV" | "PRINT") => {
    try {
      setIsExporting(format);
      const res = await fetch("/api/v1/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          title: reportTitle,
          columns,
          data: reportData,
          periodLabel: "Current Active Records",
          filtersApplied: { Category: selectedCategory },
        }),
      });

      if (format === "CSV") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const html = await res.text();
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 250);
        }
      }
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(null);
    }
  };

  const filteredRows = reportData.filter((row) => {
    if (!searchQuery) return true;
    return Object.values(row).some((val) =>
      String(val || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">
              Management Reports & Analytics Hub
            </h1>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-semibold text-xs">
              AJAY ENTERPRISES
            </Badge>
          </div>
          <p className="text-sm text-slate-500">
            Reconciled reporting modules, equipment utilization, double-entry audit trails, and data export builder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="border-slate-300 text-xs">
              Back to Dashboard
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => handleExport("CSV")}
            disabled={reportData.length === 0}
            isLoading={isExporting === "CSV"}
            loadingText="Exporting..."
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel/CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("PRINT")}
            disabled={reportData.length === 0}
            isLoading={isExporting === "PRINT"}
            loadingText="Preparing..."
            className="border-slate-300 text-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Printable View
          </Button>
        </div>
      </div>

      {/* 2. Seven Specialized Module Cards */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-orange-600" />
          Specialized Analytics & Statutory Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {REPORT_MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.title} href={m.href} className="group">
                <Card className="h-full hover:border-[#0B1E36] hover:shadow-md transition-all flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg border ${m.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-900 group-hover:text-[#0B1E36]">
                      {m.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {m.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                      {m.kpis.map((k) => (
                        <span key={k} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {k}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. Universal Report Builder & Interactive Preview */}
      <Card className="border-slate-300">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base text-[#0B1E36] flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                Universal Report Data Builder
              </CardTitle>
              <CardDescription className="text-xs">
                Select a dataset to inspect, search, filter, and export live records with official company headers.
              </CardDescription>
            </div>

            {/* Category Select Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 text-xs font-medium">
              {[
                { id: "RENTALS", label: "Rentals" },
                { id: "CUSTOMERS", label: "Customers" },
                { id: "INVENTORY", label: "Inventory" },
                { id: "FLEET", label: "Fleet" },
                { id: "LABOUR", label: "Labour" },
                { id: "MAINTENANCE", label: "Maintenance" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    selectedCategory === c.id
                      ? "bg-[#0B1E36] text-white font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar inside preview */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search preview records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredRows.length}</strong> of {reportData.length} entries
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
              Loading report dataset...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No records match your selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0B1E36] text-white uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className={`px-4 py-3 text-${c.align || "left"}`}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.slice(0, 25).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      {columns.map((c) => {
                        const val = row[c.key];
                        let display = val;
                        if (val !== null && val !== undefined) {
                          if (typeof val === "object" && "toFixed" in val) {
                            display = val.toFixed(2);
                          } else if (val instanceof Date) {
                            display = new Date(val).toLocaleDateString("en-IN");
                          }
                        } else {
                          display = "-";
                        }
                        return (
                          <td key={c.key} className={`px-4 py-2.5 text-${c.align || "left"} text-slate-700`}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
