"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calculator,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  Printer,
  Calendar,
  Building,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function RentalStatementsPage() {
  const [statements, setStatements] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Generator Modal State
  const [isGeneratorOpen, setIsGeneratorOpen] = React.useState(false);
  const [billingMode, setBillingMode] = React.useState<"SITE_WISE" | "CONSOLIDATED">("SITE_WISE");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [selectedSiteId, setSelectedSiteId] = React.useState("");
  const [selectedSiteIds, setSelectedSiteIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
  });
  const [includeDamage, setIncludeDamage] = React.useState(true);
  const [includeMissing, setIncludeMissing] = React.useState(true);
  const [adjustments, setAdjustments] = React.useState("0");

  const [previewCalculation, setPreviewCalculation] = React.useState<any>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Expanded details row in statements list
  const [expandedStatementId, setExpandedStatementId] = React.useState<string | null>(null);
  const [detailedStatement, setDetailedStatement] = React.useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  const fetchStatements = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/statements");
      const json = await res.json();
      if (json.success) {
        setStatements(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load statements:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatements();

    fetch("/api/v1/customers")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCustomers(j.data || []);
      })
      .catch(() => {});
  }, [fetchStatements]);

  // When customer changes, update available sites
  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSites([]);
      setSelectedSiteId("");
      setSelectedSiteIds([]);
      return;
    }
    const c = customers.find((cust) => cust.id === selectedCustomerId);
    const sList = c?.sites || [];
    setSites(sList);
    if (sList.length > 0) {
      setSelectedSiteId(sList[0].id);
      setSelectedSiteIds(sList.map((s: any) => s.id));
    }
  }, [selectedCustomerId, customers]);

  const handleCalculatePreview = async () => {
    if (!selectedCustomerId) {
      alert("Please select a customer.");
      return;
    }
    if (billingMode === "SITE_WISE" && !selectedSiteId) {
      alert("Please select a customer construction site.");
      return;
    }

    setIsCalculating(true);
    setPreviewCalculation(null);

    try {
      const payload = {
        customerId: selectedCustomerId,
        billingMode,
        customerSiteId: billingMode === "SITE_WISE" ? selectedSiteId : null,
        customerSiteIds: billingMode === "CONSOLIDATED" ? selectedSiteIds : undefined,
        periodStartDate: startDate,
        periodEndDate: endDate,
        includeDamageCharges: includeDamage,
        includeMissingCharges: includeMissing,
        adjustments: Number(adjustments) || 0,
      };

      const res = await fetch("/api/v1/rentals/statements/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || "Failed to calculate statement preview");
        return;
      }

      setPreviewCalculation(json.data);
    } catch (err: any) {
      alert(err.message || "Calculation failed");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveStatement = async () => {
    if (!previewCalculation) return;

    setIsSaving(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        billingMode,
        customerSiteId: billingMode === "SITE_WISE" ? selectedSiteId : null,
        customerSiteIds: billingMode === "CONSOLIDATED" ? selectedSiteIds : undefined,
        periodStartDate: startDate,
        periodEndDate: endDate,
        includeDamageCharges: includeDamage,
        includeMissingCharges: includeMissing,
        adjustments: Number(adjustments) || 0,
      };

      const res = await fetch("/api/v1/rentals/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || "Failed to generate statement");
        return;
      }

      setIsGeneratorOpen(false);
      setPreviewCalculation(null);
      fetchStatements();
    } catch (err: any) {
      alert(err.message || "Failed to save statement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (id: string, num: string) => {
    if (!confirm(`Approve Statement ${num}?`)) return;
    try {
      const res = await fetch(`/api/v1/rentals/statements/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (json.success) fetchStatements();
      else alert(json.error?.message || "Approval failed");
    } catch (err: any) {
      alert(err.message || "Approval failed");
    }
  };

  const handleFinalize = async (id: string, num: string) => {
    if (
      !confirm(
        `Are you sure you want to FINALIZE Statement ${num}? Once finalized, the statement will be permanently frozen and locked against any edits.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/rentals/statements/${id}/finalize`, { method: "POST" });
      const json = await res.json();
      if (json.success) fetchStatements();
      else alert(json.error?.message || "Finalization failed");
    } catch (err: any) {
      alert(err.message || "Finalization failed");
    }
  };

  const handleViewDetail = async (id: string) => {
    if (expandedStatementId === id) {
      setExpandedStatementId(null);
      setDetailedStatement(null);
      return;
    }

    setExpandedStatementId(id);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/v1/rentals/statements/${id}`);
      const json = await res.json();
      if (json.success) {
        setDetailedStatement(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const filtered = statements.filter((s) => {
    const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
    const matchSearch =
      s.statementNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.customerSite?.siteName && s.customerSite.siteName.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

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
            Monthly Rental Statements & Billing
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Deterministic daily accrual statements, site-wise billing, and multi-site consolidated customer accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatements}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setPreviewCalculation(null);
              setIsGeneratorOpen(true);
            }}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            Generate Rental Statement
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search statement #, customer, site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "CALCULATED", "APPROVED", "FINALIZED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? "bg-[#0B1E36] text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Statements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Statement #</th>
                <th className="p-3.5">Mode</th>
                <th className="p-3.5">Customer & Site</th>
                <th className="p-3.5">Period</th>
                <th className="p-3.5 text-right">Rental Accrual</th>
                <th className="p-3.5 text-right font-bold text-slate-900">Net Payable</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading statements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No rental statements found. Click &quot;Generate Rental Statement&quot; to compute monthly billings.
                  </td>
                </tr>
              ) : (
                filtered.map((stmt) => (
                  <React.Fragment key={stmt.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => handleViewDetail(stmt.id)}
                          className="font-mono font-bold text-[#0B1E36] hover:underline flex items-center gap-1"
                        >
                          {stmt.statementNumber}
                          {expandedStatementId === stmt.id ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            stmt.billingMode === "CONSOLIDATED"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {stmt.billingMode}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{stmt.customer?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {stmt.customerSite
                            ? stmt.customerSite.siteName
                            : `Consolidated (${stmt._count?.siteSummaries || 0} sites)`}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(stmt.periodStartDate).toLocaleDateString()} to{" "}
                        {new Date(stmt.periodEndDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        ₹{Number(stmt.totalRentalAmount).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-slate-900">
                        ₹{Number(stmt.netPayableAmount).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            stmt.status === "FINALIZED"
                              ? "bg-emerald-100 text-emerald-800"
                              : stmt.status === "APPROVED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {stmt.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {stmt.status === "CALCULATED" && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(stmt.id, stmt.statementNumber)}
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Approve
                            </Button>
                          )}
                          {stmt.status === "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={() => handleFinalize(stmt.id, stmt.statementNumber)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Lock className="h-3 w-3 mr-1" /> Finalize
                            </Button>
                          )}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            <a
                              href={`/api/v1/rentals/statements/${stmt.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Printer className="h-3 w-3 mr-1" /> Print
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Line Items & Day Details */}
                    {expandedStatementId === stmt.id && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={8} className="p-4">
                          {isLoadingDetail ? (
                            <div className="text-center py-4 text-xs text-slate-400">
                              Loading line items & daily calculation log...
                            </div>
                          ) : !detailedStatement ? (
                            <div className="text-center py-4 text-xs text-slate-500">
                              No calculation details found.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <h4 className="font-bold text-xs text-[#0B1E36] uppercase tracking-wider">
                                Line Item Calculation Breakdown ({detailedStatement.items.length} items)
                              </h4>
                              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                                    <tr>
                                      <th className="p-2">Material</th>
                                      <th className="p-2">Site</th>
                                      <th className="p-2 text-right">Opening Qty</th>
                                      <th className="p-2 text-right">Delivered</th>
                                      <th className="p-2 text-right">Returned</th>
                                      <th className="p-2 text-right">Closing Qty</th>
                                      <th className="p-2 text-center">Days</th>
                                      <th className="p-2 text-right">Daily Rate</th>
                                      <th className="p-2 text-right">Total (INR)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {detailedStatement.items.map((it: any) => (
                                      <tr key={it.id}>
                                        <td className="p-2 font-medium">
                                          {it.materialVariant?.name} ({it.materialVariant?.materialCode})
                                        </td>
                                        <td className="p-2 text-slate-500">{it.customerSite?.siteName}</td>
                                        <td className="p-2 text-right font-mono">{Number(it.openingHeldQty).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono">{Number(it.newDeliveredQty).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono text-slate-500">{Number(it.returnedQty).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-900">{Number(it.closingHeldQty).toFixed(2)}</td>
                                        <td className="p-2 text-center">{it.billableDays}</td>
                                        <td className="p-2 text-right font-mono">₹{Number(it.applicableDailyRate).toFixed(2)}</td>
                                        <td className="p-2 text-right font-mono font-bold text-emerald-800">
                                          ₹{Number(it.rentalAmount).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GENERATE STATEMENT MODAL */}
      <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36] flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#F26522]" />
              Generate Monthly Rental Statement
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Mode Selector */}
            <div className="flex gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="billingMode"
                  checked={billingMode === "SITE_WISE"}
                  onChange={() => setBillingMode("SITE_WISE")}
                  className="text-[#0B1E36]"
                />
                <span>Site-Wise Statement (Single Construction Site)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="billingMode"
                  checked={billingMode === "CONSOLIDATED"}
                  onChange={() => setBillingMode("CONSOLIDATED")}
                  className="text-[#0B1E36]"
                />
                <span>Consolidated Customer Statement (Multiple Sites)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>Customer</Label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerCode})
                    </option>
                  ))}
                </select>
              </div>

              {billingMode === "SITE_WISE" ? (
                <div>
                  <Label required>Customer Site</Label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    required
                    disabled={sites.length === 0}
                    className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
                  >
                    <option value="">-- Select Construction Site --</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.siteName} ({s.siteCode})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label>Consolidated Sites</Label>
                  <div className="mt-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded max-h-24 overflow-y-auto">
                    {sites.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedSiteIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSiteIds((prev) => [...prev, s.id]);
                            } else {
                              setSelectedSiteIds((prev) => prev.filter((id) => id !== s.id));
                            }
                          }}
                        />
                        <span>{s.siteName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label required>Period Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1.5 h-9 text-xs"
                />
              </div>

              <div>
                <Label required>Period End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>

            {/* Inclusions */}
            <div className="flex flex-wrap gap-4 pt-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDamage}
                  onChange={(e) => setIncludeDamage(e.target.checked)}
                />
                <span>Include Approved Damage Claims</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMissing}
                  onChange={(e) => setIncludeMissing(e.target.checked)}
                />
                <span>Include Approved Missing Stock Claims</span>
              </label>
            </div>

            {/* Run Calculation Trigger */}
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={handleCalculatePreview}
                disabled={isCalculating || !selectedCustomerId}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                {isCalculating ? "Calculating Accruals..." : "Calculate Statement Preview"}
              </Button>
            </div>

            {/* Live Calculation Preview */}
            {previewCalculation && (
              <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#0B1E36]">
                      Statement Calculation Preview
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customer: <strong>{previewCalculation.customerName}</strong> | Period: {previewCalculation.periodStartDate} to {previewCalculation.periodEndDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Net Payable Amount</span>
                    <p className="text-xl font-black text-[#F26522]">
                      ₹{Number(previewCalculation.netPayableAmount).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded border">
                    <span className="text-slate-500">Total Rental Accrual</span>
                    <p className="font-bold text-slate-900 mt-1">₹{Number(previewCalculation.totalRentalAmount).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded border">
                    <span className="text-slate-500">Damage Claims</span>
                    <p className="font-bold text-red-600 mt-1">₹{Number(previewCalculation.totalDamageCharges).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded border">
                    <span className="text-slate-500">Missing Claims</span>
                    <p className="font-bold text-red-600 mt-1">₹{Number(previewCalculation.totalMissingCharges).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded border">
                    <span className="text-slate-500">Total Billable Days</span>
                    <p className="font-bold text-slate-900 mt-1">{previewCalculation.totalBillableDays} days</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-2">Material Variant</th>
                        <th className="p-2">Site</th>
                        <th className="p-2 text-right">Closing Held</th>
                        <th className="p-2 text-center">Days</th>
                        <th className="p-2 text-right">Daily Rate</th>
                        <th className="p-2 text-right">Rental Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewCalculation.items.map((it: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium">{it.materialName} ({it.materialCode})</td>
                          <td className="p-2 text-slate-500">{it.siteName}</td>
                          <td className="p-2 text-right font-mono">{Number(it.closingHeldQty).toFixed(2)}</td>
                          <td className="p-2 text-center">{it.billableDays}</td>
                          <td className="p-2 text-right font-mono">₹{Number(it.applicableDailyRate).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-800">
                            ₹{Number(it.rentalAmount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSaveStatement}
                    disabled={isSaving}
                    className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
                  >
                    {isSaving ? "Saving..." : "Confirm & Save Statement"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGeneratorOpen(false)}
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

