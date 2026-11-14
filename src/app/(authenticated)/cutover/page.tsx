"use client";

import * as React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  Layers,
  Building2,
  DollarSign,
  Scale,
  RefreshCw,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react";

export default function CutoverPage() {
  const [activeTab, setActiveTab] = React.useState<"readiness" | "stock" | "finance" | "reconciliation">("readiness");
  const [loading, setLoading] = React.useState(true);
  const [readinessData, setReadinessData] = React.useState<any>(null);
  const [reconciliationData, setReconciliationData] = React.useState<any>(null);
  const [stockBatches, setStockBatches] = React.useState<any[]>([]);
  const [balanceBatches, setBalanceBatches] = React.useState<any[]>([]);
  const [trialBalance, setTrialBalance] = React.useState<any>(null);
  const [message, setMessage] = React.useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Form states for opening stock entry
  const [stockCsvText, setStockCsvText] = React.useState("");
  const [stockPreview, setStockPreview] = React.useState<any>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [submittingStock, setSubmittingStock] = React.useState(false);

  // Sign-off modal / state
  const [signOffNotes, setSignOffNotes] = React.useState("");
  const [signingOff, setSigningOff] = React.useState(false);

  const fetchAllData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [readinessRes, reconRes, stockRes, balRes, tbRes] = await Promise.all([
        fetch("/api/v1/cutover/readiness").then((r) => r.json()),
        fetch("/api/v1/cutover/reconciliation").then((r) => r.json()),
        fetch("/api/v1/cutover/opening-stock").then((r) => r.json()),
        fetch("/api/v1/cutover/opening-balances").then((r) => r.json()),
        fetch("/api/v1/cutover/opening-balances?view=trial-balance").then((r) => r.json()),
      ]);

      if (readinessRes.success) setReadinessData(readinessRes.data);
      if (reconRes.success) setReconciliationData(reconRes.data);
      if (stockRes.success) setStockBatches(stockRes.data || []);
      if (balRes.success) setBalanceBatches(balRes.data || []);
      if (tbRes.success) setTrialBalance(tbRes.data);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to load cutover data" });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle CSV Preview
  const handlePreviewCsv = async () => {
    if (!stockCsvText.trim()) {
      setMessage({ type: "error", text: "Please paste CSV rows to preview." });
      return;
    }
    setPreviewing(true);
    setMessage(null);
    try {
      const lines = stockCsvText.trim().split("\n");
      const rows = lines.map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        return {
          materialCodeOrId: parts[0] || "",
          ownershipType: parts[1] || "OWNED",
          locationType: parts[2] || "WAREHOUSE",
          warehouseCodeOrId: parts[3] || "",
          siteCodeOrId: parts[4] || "",
          quantity: parts[5] || "0",
          unitCost: parts[6] || "",
          condition: parts[7] || "GOOD",
          dailyRentalRate: parts[8] || "",
          notes: parts[9] || "",
        };
      });

      const res = await fetch("/api/v1/cutover/opening-stock/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }).then((r) => r.json());

      if (res.success) {
        setStockPreview(res.data);
        if (!res.data.isValid) {
          setMessage({ type: "error", text: `CSV has ${res.data.errors.length} validation errors. Review before creating batch.` });
        } else {
          setMessage({ type: "success", text: `CSV validated successfully: ${res.data.validRows} rows ready.` });
        }
      } else {
        setMessage({ type: "error", text: res.error?.message || "Preview failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "CSV preview failed" });
    } finally {
      setPreviewing(false);
    }
  };

  // Handle Create Stock Batch
  const handleCreateStockBatch = async () => {
    if (!stockPreview || !stockPreview.isValid || stockPreview.parsedItems.length === 0) {
      setMessage({ type: "error", text: "Validate CSV first before creating batch." });
      return;
    }
    setSubmittingStock(true);
    try {
      const res = await fetch("/api/v1/cutover/opening-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Opening Stock Cutover Batch",
          items: stockPreview.parsedItems,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: `Opening stock batch ${res.data.batchNumber} created in DRAFT state.` });
        setStockCsvText("");
        setStockPreview(null);
        fetchAllData();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to create batch" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create stock batch" });
    } finally {
      setSubmittingStock(false);
    }
  };

  // Handle Post Stock Batch
  const handlePostStockBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/v1/cutover/opening-stock/${batchId}/post`, { method: "POST" }).then((r) => r.json());
      if (res.success) {
        setMessage({ type: "success", text: `Batch posted successfully into inventory ledger!` });
        fetchAllData();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to post batch" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to post stock batch" });
    }
  };

  // Handle Finalize Cutover Sign-Off
  const handleFinalizeSignOff = async () => {
    setSigningOff(true);
    try {
      const res = await fetch("/api/v1/cutover/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signOffNotes }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: "Cutover and Opening Reconciliations finalized successfully by Owner!" });
        fetchAllData();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Cannot finalize cutover" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Sign-off failed" });
    } finally {
      setSigningOff(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B1E36] text-white p-6 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#F26522] text-xs font-semibold px-2 py-0.5 rounded tracking-wide uppercase">
              Phase 8 • Production Cutover & Go-Live
            </span>
            <span className="text-xs text-slate-300">Operating Business: AJAY ENTERPRISES</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cutover Control & Reconciliation Hub</h1>
          <p className="text-sm text-slate-300 mt-1">
            Guided master data cutover, opening stock ledger, opening financial trial balance, and statutory readiness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Audit
          </button>

          <div className="text-right">
            <div className="text-xs text-slate-400">Cutover State</div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                reconciliationData?.overallStatus === "COMPLETED"
                  ? "bg-emerald-500 text-white"
                  : reconciliationData?.overallStatus === "BLOCKED"
                  ? "bg-rose-500 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {reconciliationData?.overallStatus || "INITIALIZING"}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-md text-sm flex items-start justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : message.type === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("readiness")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "readiness"
              ? "border-[#F26522] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 className="h-4 w-4" />
          1. Company Readiness
          {readinessData && (
            <span className="text-xs px-1.5 py-0.2 bg-slate-100 rounded-full font-mono">
              {readinessData.readyChecks}/{readinessData.totalChecks}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "stock"
              ? "border-[#F26522] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers className="h-4 w-4" />
          2. Opening Stock Entry
          {stockBatches.length > 0 && (
            <span className="text-xs px-1.5 py-0.2 bg-slate-100 rounded-full font-mono">
              {stockBatches.length} Batches
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "finance"
              ? "border-[#F26522] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          3. Opening Balances & Trial Balance
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "reconciliation"
              ? "border-[#F26522] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Scale className="h-4 w-4" />
          4. Reconciliation & Blocker Gate
          {reconciliationData?.blockerReasons?.length > 0 && (
            <span className="text-xs px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full font-mono">
              {reconciliationData.blockerReasons.length} Blockers
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: READINESS CHECKLIST */}
      {activeTab === "readiness" && readinessData && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Company Configuration & Legal Identity</h2>
            <p className="text-xs text-slate-500 mb-4">
              Inspects configuration parameters required for GST, statutory invoices, and banking operations for AJAY ENTERPRISES.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Legal Business Name</div>
                <div className="text-sm font-bold text-slate-900">{readinessData.companyProfile.name}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">GSTIN</div>
                <div className="text-sm font-bold text-slate-900">{readinessData.companyProfile.gstin || "Not Configured"}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Permanent Account Number (PAN)</div>
                <div className="text-sm font-bold text-slate-900">{readinessData.companyProfile.pan || "Not Configured"}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Active Fiscal Year</div>
                <div className="text-sm font-bold text-slate-900">{readinessData.companyProfile.activeFiscalYear}</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {readinessData.items.map((item: any) => (
                <div key={item.id} className="p-4 flex items-start justify-between hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{item.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          item.status === "CONFIGURED"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "SIMULATED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.details}</p>
                    {item.missingFields?.length > 0 && (
                      <div className="text-xs text-rose-600 font-mono mt-1">
                        Requires owner input: {item.missingFields.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {item.isReady ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Honest Disclosure Card */}
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-lg">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5 mb-2">
              <Info className="h-4 w-4" />
              Statutory & Integration Disclosures
            </h3>
            <ul className="text-xs text-amber-800 space-y-1 list-disc pl-5">
              <li><strong>FYN E-Way Bill:</strong> Sandbox / Simulation adapter operational. Real government NIC connection requires authorized FYN live credentials. Dispatches remain fully operational.</li>
              <li><strong>WhatsApp Delivery:</strong> Ready for provider webhook attachment. All dispatches generate high-fidelity PDFs downloadable directly.</li>
              <li><strong>GST Returns:</strong> Preparation schedules generate exact GSTR-1 and GSTR-3B monthly breakdowns for portal submission.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: OPENING STOCK ENTRY */}
      {activeTab === "stock" && (
        <div className="space-y-6">
          {/* CSV Import Facility */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Import Opening Stock Data</h2>
                <p className="text-xs text-slate-500">
                  Paste CSV rows formatted as: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0B1E36]">MaterialCode, Ownership(OWNED/HIRED_IN), Location(WAREHOUSE/CUSTOMER_SITE), WarehouseCode, SiteCode, Qty, UnitCost, Condition, DailyRate, Notes</code>
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={stockCsvText}
              onChange={(e) => setStockCsvText(e.target.value)}
              placeholder="e.g. MAT-0001, OWNED, WAREHOUSE, WH-MAIN, , 500, 1200.00, GOOD, 2.50, Initial Yard Count"
              className="w-full text-xs font-mono p-3 border border-slate-300 rounded focus:ring-2 focus:ring-[#F26522] focus:border-transparent outline-none"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handlePreviewCsv}
                disabled={previewing || !stockCsvText.trim()}
                className="px-4 py-2 bg-[#0B1E36] hover:bg-slate-800 text-white text-xs font-bold rounded shadow transition flex items-center gap-2"
              >
                <Upload className="h-3.5 w-3.5" />
                {previewing ? "Validating..." : "Preview & Validate CSV"}
              </button>

              {stockPreview && stockPreview.isValid && (
                <button
                  onClick={handleCreateStockBatch}
                  disabled={submittingStock}
                  className="px-4 py-2 bg-[#F26522] hover:bg-orange-600 text-white text-xs font-bold rounded shadow transition"
                >
                  {submittingStock ? "Saving..." : "Create Draft Opening Batch"}
                </button>
              )}
            </div>

            {/* Preview Results */}
            {stockPreview && (
              <div className="mt-4 p-4 bg-slate-50 rounded border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Validation: {stockPreview.validRows} valid rows, {stockPreview.invalidRows} errors
                  </span>
                  <div className="space-x-3 text-slate-600">
                    <span>Owned Qty: <strong>{stockPreview.summary.totalOwnedQty}</strong></span>
                    <span>Hired-In Qty: <strong>{stockPreview.summary.totalHiredQty}</strong></span>
                    <span>Owned Valuation: <strong>Rs. {stockPreview.summary.totalOwnedValuation}</strong></span>
                  </div>
                </div>

                {stockPreview.errors?.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 space-y-1">
                    {stockPreview.errors.map((err: any, i: number) => (
                      <div key={i}>Row {err.row}: [{err.field}] {err.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Existing Stock Batches */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-800">
              Opening Stock Batches
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Cutover Date</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Owned Qty</th>
                    <th className="p-3">Hired Qty</th>
                    <th className="p-3">Valuation</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        No opening stock batches created yet.
                      </td>
                    </tr>
                  ) : (
                    stockBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-[#0B1E36]">{b.batchNumber}</td>
                        <td className="p-3">{b.title}</td>
                        <td className="p-3">{new Date(b.cutoverDate).toLocaleDateString()}</td>
                        <td className="p-3">{b.totalItems}</td>
                        <td className="p-3 font-mono">{b.totalOwnedQty}</td>
                        <td className="p-3 font-mono">{b.totalHiredQty}</td>
                        <td className="p-3 font-mono font-semibold">Rs. {b.totalOwnedValuation}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.status === "POSTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {b.status !== "POSTED" && (
                            <button
                              onClick={() => handlePostStockBatch(b.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-sm"
                            >
                              Post to Ledger
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPENING BALANCES & TRIAL BALANCE */}
      {activeTab === "finance" && trialBalance && (
        <div className="space-y-6">
          {/* Subledger Totals Card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500">Customer Receivables</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Rs. {trialBalance.subledgerSummary.customerReceivablesTotal}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500">Supplier Payables</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Rs. {trialBalance.subledgerSummary.supplierPayablesTotal}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500">Cash & Bank Accounts</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Rs. {trialBalance.subledgerSummary.cashAndBankTotal}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500">Fixed Assets Valuation</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Rs. {trialBalance.subledgerSummary.fixedAssetsTotal}
              </div>
            </div>
          </div>

          {/* Opening Trial Balance Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Opening Trial Balance & Double-Entry Equality</h3>
                <p className="text-xs text-slate-500">
                  All opening financial entries must balance with zero tolerance: SUM(Debits) == SUM(Credits).
                </p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded font-bold ${
                  trialBalance.isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {trialBalance.isBalanced ? "BALANCED (0.00 Difference)" : `UNBALANCED (Diff: Rs. ${trialBalance.difference})`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Account Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Subcategory</th>
                    <th className="p-3 text-right">Debit (Rs.)</th>
                    <th className="p-3 text-right">Credit (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {trialBalance.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                        No financial opening balances posted yet.
                      </td>
                    </tr>
                  ) : (
                    trialBalance.rows.map((row: any) => (
                      <tr key={row.accountCode} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-[#0B1E36]">{row.accountCode}</td>
                        <td className="p-3 font-sans font-medium">{row.accountName}</td>
                        <td className="p-3 font-sans">{row.category}</td>
                        <td className="p-3 font-sans text-slate-500">{row.subcategory}</td>
                        <td className="p-3 text-right text-slate-900">{parseFloat(row.debit).toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-900">{parseFloat(row.credit).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t border-slate-300">
                  <tr>
                    <td colSpan={4} className="p-3 text-right font-sans">Total Opening Balances:</td>
                    <td className="p-3 text-right">Rs. {trialBalance.totalDebit}</td>
                    <td className="p-3 text-right">Rs. {trialBalance.totalCredit}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RECONCILIATION & BLOCKER GATE */}
      {activeTab === "reconciliation" && reconciliationData && (
        <div className="space-y-6">
          {/* Reconciliation Dimensions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reconciliationData.reconciliationAreas.map((area: any) => (
              <div key={area.code} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{area.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      area.status === "RECONCILED"
                        ? "bg-emerald-100 text-emerald-800"
                        : area.status === "PENDING_DATA"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {area.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600">{area.details}</div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <span>Subledger: {area.subledgerFigure}</span>
                  <span>Difference: <strong>{area.difference}</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Blocker Reasons Alert */}
          {reconciliationData.blockerReasons?.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Unresolved Mandatory Cutover Blockers
              </h3>
              <p className="text-xs text-rose-700">
                The Owner cannot finalize cutover or declare production live while the following discrepancies remain unresolved:
              </p>
              <ul className="text-xs text-rose-800 list-disc pl-5 space-y-1">
                {reconciliationData.blockerReasons.map((b: string, i: number) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Master Owner Sign-Off Gate */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Owner Cutover Sign-Off & Seal</h2>
            <p className="text-xs text-slate-600">
              By authorizing cutover sign-off, the Business Owner confirms that opening stock ledgers, customer/supplier subledgers, and opening double-entry financial balances are audited, reconciled, and ready for day-to-day operations at AJAY ENTERPRISES.
            </p>

            <textarea
              rows={2}
              value={signOffNotes}
              onChange={(e) => setSignOffNotes(e.target.value)}
              placeholder="Enter owner cutover sign-off remarks or audit confirmation..."
              className="w-full text-xs p-3 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-[#F26522]"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {reconciliationData.canMarkCutoverComplete
                  ? "✓ All mandatory reconciliations passed. Ready for owner sign-off."
                  : "🔒 Cutover sign-off is locked until mandatory reconciliation blockers are resolved."}
              </span>

              <button
                onClick={handleFinalizeSignOff}
                disabled={signingOff || !reconciliationData.canMarkCutoverComplete}
                className={`px-5 py-2.5 text-xs font-bold rounded shadow transition flex items-center gap-2 ${
                  reconciliationData.canMarkCutoverComplete
                    ? "bg-[#0B1E36] hover:bg-slate-800 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                {signingOff ? "Signing Off..." : "Authorize Cutover Completion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
