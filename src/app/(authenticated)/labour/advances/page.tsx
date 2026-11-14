"use client";

import * as React from "react";
import {
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  User,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LabourAdvancesPage() {
  const [advances, setAdvances] = React.useState<any[]>([]);
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    workerId: "",
    advanceDate: new Date().toISOString().split("T")[0],
    amount: 1000,
    paymentMode: "CASH",
    paymentReference: "",
    purpose: "Personal emergency / Festival advance",
    postToAccounts: true,
    remarks: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [aRes, wRes] = await Promise.all([
        fetch("/api/v1/labour/advances"),
        fetch("/api/v1/labour/workers?status=ACTIVE"),
      ]);

      const [aData, wData] = await Promise.all([aRes.json(), wRes.json()]);

      if (aData.success) setAdvances(aData.data);
      if (wData.success) setWorkers(wData.data);
    } catch (err) {
      console.error("Failed to load advances", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/v1/labour/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: formData.workerId,
          advanceDate: formData.advanceDate,
          amount: Number(formData.amount),
          paymentMode: formData.paymentMode,
          paymentReference: formData.paymentReference || undefined,
          purpose: formData.purpose || undefined,
          postToAccounts: formData.postToAccounts,
          remarks: formData.remarks || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to issue advance");
      }

      setIsModalOpen(false);
      setFormData({
        workerId: "",
        advanceDate: new Date().toISOString().split("T")[0],
        amount: 1000,
        paymentMode: "CASH",
        paymentReference: "",
        purpose: "Personal emergency / Festival advance",
        postToAccounts: true,
        remarks: "",
      });
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to issue advance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdvances = advances.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      a.advanceNumber?.toLowerCase().includes(q) ||
      a.worker?.name?.toLowerCase().includes(q) ||
      a.worker?.workerCode?.toLowerCase().includes(q) ||
      a.purpose?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Labour Advances & Loans</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Issue worker advances, manage recovery against wage settlements & track balance under Account 1050
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
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Issue Advance
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search advance # or worker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          >
            <option value="ALL">All Status</option>
            <option value="APPROVED">Active / Unrecovered</option>
            <option value="PARTIALLY_RECOVERED">Partially Recovered</option>
            <option value="RECOVERED">Fully Recovered</option>
          </select>
        </div>
      </div>

      {/* Advances Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Advance #</th>
                <th className="p-3">Worker</th>
                <th className="p-3">Issue Date</th>
                <th className="p-3 text-right">Advance Amount</th>
                <th className="p-3 text-right">Recovered</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3">Mode</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdvances.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-[#0B1E36]">{a.advanceNumber}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{a.worker?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{a.worker?.workerCode}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {new Date(a.advanceDate).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-900">
                    ₹{Number(a.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600">
                    ₹{Number(a.recoveredAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#F26522]">
                    ₹{Number(a.outstandingAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">
                      {a.paymentMode}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        a.status === "RECOVERED"
                          ? "bg-emerald-100 text-emerald-800"
                          : a.status === "PARTIALLY_RECOVERED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAdvances.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No advances found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Advance Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0B1E36]">Issue Labour Advance</h2>
                <p className="text-xs text-slate-500">Provide advance money to worker with general ledger posting</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Worker <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.workerId}
                  onChange={(e) => setFormData({ ...formData, workerId: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                >
                  <option value="">-- Choose Worker --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.workerCode}) - {w.category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Advance Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.advanceDate}
                    onChange={(e) => setFormData({ ...formData, advanceDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Reference / UTR #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / Cash voucher"
                    value={formData.paymentReference}
                    onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Purpose of Advance
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance / Medical emergency"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="postAccounts"
                  checked={formData.postToAccounts}
                  onChange={(e) => setFormData({ ...formData, postToAccounts: e.target.checked })}
                  className="rounded border-slate-300 text-[#0B1E36] focus:ring-[#0B1E36]"
                />
                <label htmlFor="postAccounts" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Post Double-Entry Journal (Debit Account 1050 Labour Advances, Credit Cash/Bank)
                </label>
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
                  disabled={isSubmitting}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Issuing Advance..." : "Confirm & Issue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

