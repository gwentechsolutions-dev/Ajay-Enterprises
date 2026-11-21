"use client";

import * as React from "react";
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  FileText,
  IndianRupee,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/portal";

export default function PilotPage() {
  const [pilots, setPilots] = React.useState<any[]>([]);
  const [selectedPilot, setSelectedPilot] = React.useState<any>(null);
  const [metrics, setMetrics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Pilot Form Modal / Form
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [targetEndDate, setTargetEndDate] = React.useState("");

  // Exception form
  const [showExceptionModal, setShowExceptionModal] = React.useState(false);
  const [excCategory, setExcCategory] = React.useState<"DISPATCH" | "RETURN" | "DIRECT_TRANSFER" | "BILLING" | "FLEET" | "LABOUR" | "DAMAGE">("DISPATCH");
  const [excSeverity, setExcSeverity] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [excDescription, setExcDescription] = React.useState("");

  // Complete review modal
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [completionReview, setCompletionReview] = React.useState("");

  const fetchPilots = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/pilot").then((r) => r.json());
      if (res.success) {
        setPilots(res.data || []);
        if (res.data?.length > 0 && !selectedPilot) {
          loadPilotDetails(res.data[0].id);
        }
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to fetch pilot programs" });
    } finally {
      setLoading(false);
    }
  }, [selectedPilot]);

  const loadPilotDetails = async (pilotId: string) => {
    try {
      const res = await fetch(`/api/v1/pilot/${pilotId}`).then((r) => r.json());
      if (res.success) {
        setMetrics(res.data);
        const p = pilots.find((item) => item.id === pilotId);
        if (p) setSelectedPilot(p);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to load pilot details" });
    }
  };

  React.useEffect(() => {
    fetchPilots();
  }, [fetchPilots]);

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          targetEndDate: targetEndDate || new Date(Date.now() + 14 * 86400000).toISOString(),
          selectedWarehouses: [],
          selectedCustomers: [],
          selectedSites: [],
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: `Pilot program ${res.data.pilotNumber} created successfully.` });
        setShowCreate(false);
        setName("");
        setDescription("");
        fetchPilots();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to create pilot" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error creating pilot" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivatePilot = async (pilotId: string) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/pilot/${pilotId}/activate`, { method: "POST" }).then((r) => r.json());
      if (res.success) {
        setMessage({ type: "success", text: "Pilot program activated by Owner!" });
        loadPilotDetails(pilotId);
        fetchPilots();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Activation failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to activate pilot" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metrics) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/pilot/${metrics.pilotNumber}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: excCategory,
          severity: excSeverity,
          description: excDescription,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: "Exception logged successfully." });
        setShowExceptionModal(false);
        setExcDescription("");
        loadPilotDetails(selectedPilot.id);
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to log exception" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error logging exception" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePilot = async () => {
    if (!selectedPilot) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/pilot/${selectedPilot.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionReview }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: "Pilot program concluded and signed off by Owner!" });
        setShowCompleteModal(false);
        loadPilotDetails(selectedPilot.id);
        fetchPilots();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Completion failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to complete pilot" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1E36] text-white p-6 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#F26522] text-xs font-semibold px-2 py-0.5 rounded tracking-wide uppercase">
              Operational Pilot
            </span>
            <span className="text-xs text-slate-300">Live Business Environment • AJAY ENTERPRISES</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Pilot Operations & Monitoring</h1>
          <p className="text-sm text-slate-300 mt-1">
            Track real customer dispatches, returns, direct transfers, and billing across selected pilot construction sites.
          </p>
        </div>

        <Button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F26522] hover:bg-orange-600 text-white text-xs font-bold rounded shadow transition"
        >
          <Plus className="h-4 w-4" />
          Define New Pilot
        </Button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm flex items-start justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold ml-4">×</button>
        </div>
      )}

      {/* Pilot List & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Pilot Selector */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilot Programs</h2>
          {pilots.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">No pilot programs configured.</div>
          ) : (
            <div className="space-y-2">
              {pilots.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPilot(p);
                    loadPilotDetails(p.id);
                  }}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    selectedPilot?.id === p.id
                      ? "border-[#F26522] bg-orange-50/40"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{p.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        p.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "COMPLETED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono mt-1">{p.pilotNumber}</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Target: {new Date(p.targetEndDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Active Pilot Metrics */}
        <div className="lg:col-span-3 space-y-6">
          {metrics ? (
            <>
              {/* Status Header */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{metrics.name}</h2>
                    <span className="font-mono text-xs text-slate-500">({metrics.pilotNumber})</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Start: {new Date(metrics.startDate).toLocaleDateString()} | Target End: {new Date(metrics.targetEndDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {metrics.status === "DRAFT" && (
                    <Button
                      onClick={() => handleActivatePilot(selectedPilot.id)}
                      isLoading={isSubmitting}
                      loadingText="Activating..."
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      Authorize & Activate Pilot
                    </Button>
                  )}
                  {metrics.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => setShowExceptionModal(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded shadow transition flex items-center gap-1.5"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Log Exception
                      </button>
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        className="px-3 py-1.5 bg-[#0B1E36] hover:bg-slate-800 text-white text-xs font-bold rounded shadow transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Conclude Pilot
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Operations Tracked Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Delivery Notes</div>
                    <div className="text-lg font-bold text-slate-900">{metrics.operationsTracked.deliveryNotesCount}</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Return Notes</div>
                    <div className="text-lg font-bold text-slate-900">{metrics.operationsTracked.returnNotesCount}</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded">
                    <ArrowLeftRight className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Direct Transfers</div>
                    <div className="text-lg font-bold text-slate-900">{metrics.operationsTracked.directSiteTransfersCount}</div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Invoices Billed</div>
                    <div className="text-lg font-bold text-slate-900">₹{metrics.totalBilledAmount}</div>
                  </div>
                </div>
              </div>

              {/* Logged Exceptions */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Operational Exceptions & Discrepancies Log</h3>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 rounded font-mono font-bold">
                    {metrics.exceptionsCount} Logged
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {metrics.exceptions.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Zero operational exceptions logged. Pilot running smoothly.
                    </div>
                  ) : (
                    metrics.exceptions.map((exc: any) => (
                      <div key={exc.id} className="p-4 flex items-start justify-between text-xs hover:bg-slate-50/50">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                exc.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : exc.severity === "HIGH"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {exc.severity}
                            </span>
                            <span className="font-bold text-slate-800">{exc.category}</span>
                            <span className="text-slate-400">• {new Date(exc.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-700">{exc.description}</p>
                          {exc.resolutionNotes && (
                            <p className="text-emerald-700 font-medium">Resolution: {exc.resolutionNotes}</p>
                          )}
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">{exc.loggedBy}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-400 text-sm">
              Select or create a pilot program to view operational metrics.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Define Pilot */}
      {showCreate && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 my-auto border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Define New Operational Pilot</h3>
            <form onSubmit={handleCreatePilot} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Pilot Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. South Zone High-Rise Pilot"
                  className="w-full text-xs p-2 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Target End Date</label>
                <input
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-[#F26522]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope, selected customers, and operational guidelines..."
                  className="w-full text-xs p-2 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-[#F26522]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Creating..."
                  className="px-4 py-1.5 bg-[#F26522] text-white text-xs font-bold rounded shadow hover:bg-orange-600"
                >
                  Create Pilot
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Modal: Log Exception */}
      {showExceptionModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 my-auto border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Log Operational Exception</h3>
            <form onSubmit={handleLogException} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Category *</label>
                <select
                  value={excCategory}
                  onChange={(e: any) => setExcCategory(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                >
                  <option value="DISPATCH">DISPATCH (Delivery Note)</option>
                  <option value="RETURN">RETURN (Material Return Note)</option>
                  <option value="DIRECT_TRANSFER">DIRECT TRANSFER (Site-to-Site)</option>
                  <option value="BILLING">BILLING & INVOICING</option>
                  <option value="FLEET">FLEET & TRIPS</option>
                  <option value="LABOUR">LABOUR & ATTENDANCE</option>
                  <option value="DAMAGE">DAMAGE & SCRAP</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Severity *</label>
                <select
                  value={excSeverity}
                  onChange={(e: any) => setExcSeverity(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={excDescription}
                  onChange={(e) => setExcDescription(e.target.value)}
                  placeholder="Describe the discrepancy, delay, damaged item, or customer issue..."
                  className="w-full text-xs p-2 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-[#F26522]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Logging..."
                  className="px-4 py-1.5 bg-[#0B1E36] text-white text-xs font-bold rounded shadow hover:bg-slate-800"
                >
                  Log Exception
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Modal: Conclude Pilot */}
      {showCompleteModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 my-auto border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Owner Pilot Completion Review</h3>
            <p className="text-xs text-slate-600">
              Provide the executive review on the pilot execution before declaring the pilot officially concluded.
            </p>
            <textarea
              rows={3}
              value={completionReview}
              onChange={(e) => setCompletionReview(e.target.value)}
              placeholder="e.g. 14-day pilot executed with 12 dispatches, zero inventory leakage, and accurate billing reconciliation."
              className="w-full text-xs p-2 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-[#F26522]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <Button
                type="button"
                onClick={handleCompletePilot}
                isLoading={isSubmitting}
                loadingText="Signing Off..."
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded shadow hover:bg-emerald-700"
              >
                Conclude & Sign Off
              </Button>
            </div>
          </div>
        </div>
      </ModalPortal>
    )}
  </div>
);
}
