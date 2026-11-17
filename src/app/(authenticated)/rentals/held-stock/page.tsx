"use client";

import * as React from "react";
import Link from "next/link";
import {
  Boxes,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building,
  ArrowRight,
  TrendingUp,
  Layers,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function HeldStockPage() {
  const [batches, setBatches] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [poolFilter, setPoolFilter] = React.useState("ALL");

  // Reconcile Modal State
  const [isReconcileOpen, setIsReconcileOpen] = React.useState(false);
  const [reconcileSiteId, setReconcileSiteId] = React.useState("");
  const [reconcileReport, setReconcileReport] = React.useState<any>(null);
  const [isReconciling, setIsReconciling] = React.useState(false);

  const fetchHeldStock = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/held-stock?status=ACTIVE");
      const json = await res.json();
      if (json.success) {
        setBatches(json.data.batches || []);
        setSummary(json.data.summary || []);
      }
    } catch (err) {
      console.error("Failed to fetch held stock:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHeldStock();

    // Fetch Sites
    fetch("/api/v1/customers/sites")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setSites(j.data || []);
      })
      .catch(() => {});
  }, [fetchHeldStock]);

  const handleRunReconcile = async () => {
    if (!reconcileSiteId) return;
    setIsReconciling(true);
    setReconcileReport(null);
    try {
      const res = await fetch("/api/v1/rentals/held-stock/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerSiteId: reconcileSiteId }),
      });
      const json = await res.json();
      if (json.success) {
        setReconcileReport(json.data);
      } else {
        toast.error(json.error?.message || "Reconciliation failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Reconciliation error");
    } finally {
      setIsReconciling(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchPool = poolFilter === "ALL" || b.ownershipType === poolFilter;
    const matchSearch =
      b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      b.customerSite?.siteName.toLowerCase().includes(search.toLowerCase()) ||
      b.materialVariant?.name.toLowerCase().includes(search.toLowerCase()) ||
      b.deliveryNote?.dnNumber.toLowerCase().includes(search.toLowerCase());
    return matchPool && matchSearch;
  });

  const totalHeldCount = summary.reduce(
    (acc, it) => acc + Number(it.totalHeld),
    0
  );
  const totalDailyAccrual = summary.reduce(
    (acc, it) => acc + Number(it.dailyAccrualTotal),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/rentals"
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              ← Rental Operations
            </Link>
          </div>
          <h1 className="text-2xl font-black text-[#0B1E36] tracking-tight mt-1">
            Field Held Equipment Tracker
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Traceable delivery batches, held balances, daily rate accruals, and physical inventory reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHeldStock}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setIsReconcileOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Scale className="h-3.5 w-3.5 mr-1.5" />
            Audit Site Reconciliation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Total Equipment In Field</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {Number(totalHeldCount).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">Nos.</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Total Daily Accrual</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">
              ₹{Number(totalDailyAccrual).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">/ day</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Active Deployment Batches</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#0B1E36]">
              {batches.length}
            </span>
            <span className="text-xs text-slate-500">batches</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search batch, customer, site, material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "OWNED", "HIRED_IN"].map((p) => (
            <button
              key={p}
              onClick={() => setPoolFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                poolFilter === p
                  ? "bg-[#0B1E36] text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p === "ALL" ? "All Pools" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Batch / Date</th>
                <th className="p-3.5">Customer & Site</th>
                <th className="p-3.5">Material Variant</th>
                <th className="p-3.5 text-right">Delivered</th>
                <th className="p-3.5 text-right">Returned</th>
                <th className="p-3.5 text-right font-bold text-slate-900">Current Held</th>
                <th className="p-3.5 text-right">Daily Rate</th>
                <th className="p-3.5 text-right font-bold text-emerald-800">Daily Accrual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading field stock...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No active held stock batches found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const dayAmount = Number(b.currentHeldQty) * Number(b.applicableDailyRate);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-[#0B1E36]">{b.batchNumber}</span>
                        <div className="text-[10px] text-slate-500">
                          {new Date(b.deliveryDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">DN: {b.deliveryNote?.dnNumber}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{b.customer?.name}</div>
                        <div className="text-[11px] text-slate-500">{b.customerSite?.siteName}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{b.materialVariant?.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Code: {b.materialVariant?.materialCode} |{" "}
                          <span
                            className={`font-semibold ${
                              b.ownershipType === "OWNED" ? "text-blue-700" : "text-amber-700"
                            }`}
                          >
                            {b.ownershipType}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono">{Number(b.deliveredQty).toFixed(2)}</td>
                      <td className="p-3.5 text-right font-mono text-slate-500">
                        {Number(b.returnedQty).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {Number(b.currentHeldQty).toFixed(2)} {b.materialVariant?.uom}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-700">
                        ₹{Number(b.applicableDailyRate).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                        ₹{dayAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECONCILIATION DIALOG */}
      <Dialog open={isReconcileOpen} onOpenChange={setIsReconcileOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1E36] flex items-center gap-2">
              <Scale className="h-5 w-5 text-[#F26522]" />
              Audit Site Stock Reconciliation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600">
              Verifies mathematical balance between active <strong>Rental Batches</strong> and physical{" "}
              <strong>StockBalance</strong> ledger at the construction site.
            </p>

            <div className="flex gap-2 items-center">
              <select
                value={reconcileSiteId}
                onChange={(e) => setReconcileSiteId(e.target.value)}
                className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
              >
                <option value="">-- Select Customer Site to Audit --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName} ({s.siteCode})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleRunReconcile}
                disabled={!reconcileSiteId || isReconciling}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                {isReconciling ? "Auditing..." : "Run Audit"}
              </Button>
            </div>

            {reconcileReport && (
              <div className="mt-4 space-y-3">
                <div
                  className={`p-3 rounded-lg border flex items-center gap-2 text-xs font-bold ${
                    reconcileReport.isFullyBalanced
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {reconcileReport.isFullyBalanced ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Perfect Mathematical Alignment. Zero Variance.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>Variance Detected Between Rental Tracking and Movement Ledger.</span>
                    </>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <tr>
                        <th className="p-2">Material</th>
                        <th className="p-2">Pool</th>
                        <th className="p-2 text-right">Rental Held</th>
                        <th className="p-2 text-right">Stock Ledger</th>
                        <th className="p-2 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reconcileReport.comparison.map((c: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2">
                            <strong>{c.name}</strong> ({c.code})
                          </td>
                          <td className="p-2 text-slate-500">{c.ownershipType}</td>
                          <td className="p-2 text-right font-mono">{Number(c.rentalHeldQty).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{Number(c.physicalStockQty).toFixed(2)}</td>
                          <td
                            className={`p-2 text-right font-mono font-bold ${
                              c.isBalanced ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {Number(c.variance).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReconcileOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

