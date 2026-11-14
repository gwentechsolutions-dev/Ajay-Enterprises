"use client";

import * as React from "react";
import {
  Calculator,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  CreditCard,
  TrendingDown,
  FileText,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LabourWagesPage() {
  const [settlements, setSettlements] = React.useState<any[]>([]);
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create Settlement Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [calcPreview, setCalcPreview] = React.useState<any | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Default to 1st of current month to today
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const [calcParams, setCalcParams] = React.useState({
    workerId: "",
    periodStart: firstDayOfMonth,
    periodEnd: todayStr,
    bonusAmount: 0,
    otherDeductions: 0,
    advanceDeduction: 0,
    postToAccounts: true,
    remarks: "",
  });

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [selectedSettlement, setSelectedSettlement] = React.useState<any | null>(null);
  const [paymentForm, setPaymentForm] = React.useState({
    amount: 0,
    paymentMode: "CASH",
    paymentReference: "",
    remarks: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch("/api/v1/labour/wages/settlements"),
        fetch("/api/v1/labour/workers?status=ACTIVE"),
      ]);

      const [sData, wData] = await Promise.all([sRes.json(), wRes.json()]);

      if (sData.success) setSettlements(sData.data);
      if (wData.success) setWorkers(wData.data);
    } catch (err) {
      console.error("Failed to load settlements", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handlePreviewCalculate = async () => {
    if (!calcParams.workerId) {
      setFormError("Please select a worker first.");
      return;
    }
    setIsCalculating(true);
    setFormError(null);

    try {
      const res = await fetch("/api/v1/labour/wages/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: calcParams.workerId,
          periodStart: calcParams.periodStart,
          periodEnd: calcParams.periodEnd,
          bonusAmount: Number(calcParams.bonusAmount) || 0,
          otherDeductions: Number(calcParams.otherDeductions) || 0,
          advanceDeduction: Number(calcParams.advanceDeduction) || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to calculate wage");
      }

      setCalcPreview(json.data);
      if (json.data.advanceDeduction && !calcParams.advanceDeduction) {
        setCalcParams((prev) => ({
          ...prev,
          advanceDeduction: Number(json.data.advanceDeduction),
        }));
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to preview wage");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcPreview) {
      setFormError("Please preview calculation before creating settlement.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/v1/labour/wages/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: calcParams.workerId,
          periodStart: calcParams.periodStart,
          periodEnd: calcParams.periodEnd,
          bonusAmount: Number(calcParams.bonusAmount) || 0,
          otherDeductions: Number(calcParams.otherDeductions) || 0,
          advanceDeduction: Number(calcParams.advanceDeduction) || 0,
          postToAccounts: calcParams.postToAccounts,
          remarks: calcParams.remarks || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate settlement");
      }

      setIsModalOpen(false);
      setCalcPreview(null);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create settlement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettlement) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/labour/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: selectedSettlement.workerId,
          wageSettlementId: selectedSettlement.id,
          amount: Number(paymentForm.amount),
          paymentMode: paymentForm.paymentMode,
          paymentReference: paymentForm.paymentReference || undefined,
          remarks: paymentForm.remarks || undefined,
          postToAccounts: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to record payment");
      }

      setPaymentModalOpen(false);
      setSelectedSettlement(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSettlements = settlements.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.settlementNumber?.toLowerCase().includes(q) ||
      s.worker?.name?.toLowerCase().includes(q) ||
      s.worker?.workerCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Labour Wage Settlements</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Attendance-driven wage calculation, overtime, advance recovery & double-entry wages journal (Account 5030)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCalcPreview(null);
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Calculate Settlement
          </Button>
        </div>
      </div>

      {/* Filter / Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search settlement # or worker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          />
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Settlement #</th>
                <th className="p-3">Worker</th>
                <th className="p-3">Billing Period</th>
                <th className="p-3 text-right">Gross Wages</th>
                <th className="p-3 text-right">Advance Recovered</th>
                <th className="p-3 text-right">Net Payable</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSettlements.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-[#0B1E36]">{s.settlementNumber}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{s.worker?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{s.worker?.workerCode}</div>
                  </td>
                  <td className="p-3 text-xs text-slate-600 font-mono">
                    {new Date(s.periodStart).toLocaleDateString("en-IN")} -{" "}
                    {new Date(s.periodEnd).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-900">
                    ₹{Number(s.grossWages || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-orange-600">
                    {Number(s.advanceDeduction || 0) > 0
                      ? `-₹${Number(s.advanceDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">
                    ₹{Number(s.netPayable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        s.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "APPROVED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {s.status !== "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSettlement(s);
                          setPaymentForm({
                            amount: Number(s.netPayable),
                            paymentMode: "CASH",
                            paymentReference: "",
                            remarks: `Settlement payout ${s.settlementNumber}`,
                          });
                          setPaymentModalOpen(true);
                        }}
                        className="text-xs text-[#0B1E36] border-slate-300 hover:bg-slate-50"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Pay Payout
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSettlements.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No wage settlements found. Click Calculate Settlement to compute wages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculate Settlement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0B1E36]">Compute Wage Settlement</h2>
                <p className="text-xs text-slate-500">Calculate attendance days, overtime & recover worker advances</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Worker <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={calcParams.workerId}
                    onChange={(e) => {
                      setCalcParams({ ...calcParams, workerId: e.target.value });
                      setCalcPreview(null);
                    }}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="">-- Choose Worker --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.workerCode}) - {w.wageType}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={calcParams.periodStart}
                    onChange={(e) => setCalcParams({ ...calcParams, periodStart: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={calcParams.periodEnd}
                    onChange={(e) => setCalcParams({ ...calcParams, periodEnd: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewCalculate}
                  disabled={isCalculating || !calcParams.workerId}
                  className="text-xs border-slate-300 hover:bg-slate-50"
                >
                  <Calculator className="w-3.5 h-3.5 mr-1" />
                  {isCalculating ? "Calculating..." : "Preview Wage Calculation"}
                </Button>
              </div>

              {/* Calculation Preview Result */}
              {calcPreview && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Computed Wage Breakdown</span>
                    <span className="font-mono text-emerald-700 font-bold text-sm">
                      Net: ₹{Number(calcPreview.netPayable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <div className="text-slate-400">Full Days</div>
                      <div className="font-bold text-slate-900 mt-0.5">{calcPreview.daysPresent}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <div className="text-slate-400">Half Days (0.5x)</div>
                      <div className="font-bold text-slate-900 mt-0.5">{calcPreview.halfDays}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <div className="text-slate-400">Overtime Hours</div>
                      <div className="font-bold text-blue-600 mt-0.5">{calcPreview.overtimeHours} hrs</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <div className="text-slate-400">Gross Wage</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        ₹{Number(calcPreview.grossAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Advance Recovery (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={calcParams.advanceDeduction}
                        onChange={(e) => setCalcParams({ ...calcParams, advanceDeduction: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">
                        Max active advance: ₹{Number(calcPreview.outstandingAdvance || 0)}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Bonus / Incentive (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={calcParams.bonusAmount}
                        onChange={(e) => setCalcParams({ ...calcParams, bonusAmount: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Other Deductions (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={calcParams.otherDeductions}
                        onChange={(e) => setCalcParams({ ...calcParams, otherDeductions: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="postToAccounts"
                  checked={calcParams.postToAccounts}
                  onChange={(e) => setCalcParams({ ...calcParams, postToAccounts: e.target.checked })}
                  className="rounded border-slate-300 text-[#0B1E36] focus:ring-[#0B1E36]"
                />
                <label htmlFor="postToAccounts" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Post Double-Entry Journal to General Ledger (Debit Account 5030 - Yard Wages, Credit Cash/Bank)
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Settlement Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional settlement remarks..."
                  value={calcParams.remarks}
                  onChange={(e) => setCalcParams({ ...calcParams, remarks: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !calcPreview}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Generating..." : "Finalise & Create Settlement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0B1E36]">Record Wage Payout</h2>
                <p className="text-xs text-slate-500">
                  Settlement: {selectedSettlement.settlementNumber} ({selectedSettlement.worker?.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={paymentForm.paymentReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Processing..." : "Confirm Payout"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

