"use client";

import * as React from "react";
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Truck,
  HardHat,
  Boxes,
  ReceiptIndianRupee,
  FileSpreadsheet,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DemoDataStatus {
  isLoaded: boolean;
  status: "LOADED" | "NOT_LOADED";
  isOwner: boolean;
  activeRun: {
    id: string;
    runNumber: string;
    totalRecords: number;
    moduleCounts: Record<string, number>;
    createdAt: string;
    generatedBy?: string | null;
  } | null;
  history: Array<{
    id: string;
    runNumber: string;
    status: string;
    totalRecords: number;
    createdAt: string;
    clearedAt?: string | null;
  }>;
}

export default function DemoDataPage() {
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [statusData, setStatusData] = React.useState<DemoDataStatus | null>(null);
  const [clearModalOpen, setClearModalOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/demo-data");
      if (!res.ok) {
        throw new Error("Failed to load demo data status");
      }
      const json = await res.json();
      if (json.success) {
        setStatusData(json.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load demo status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/v1/demo-data", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate demo dataset");
      }
      toast.success(json.data?.message || "Demo dataset successfully generated!");
      // Dispatch custom event to notify DemoModeBanner immediately
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("demo-status-changed"));
      }
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Error generating demo dataset");
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    try {
      setClearing(true);
      const res = await fetch("/api/v1/demo-data/clear", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to clear demo data");
      }
      toast.success(json.data?.message || "Demo data successfully cleared!");
      setClearModalOpen(false);
      setConfirmInput("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("demo-status-changed"));
      }
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Error clearing demo dataset");
    } finally {
      setClearing(false);
    }
  };

  const isLoaded = statusData?.isLoaded ?? false;
  const activeRun = statusData?.activeRun;
  const counts = activeRun?.moduleCounts || {};

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Database className="w-6 h-6 text-orange-600" />
              Demo Data Manager
            </h1>
            {isLoaded ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 font-mono text-xs px-2.5 py-0.5">
                ● DEMO ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600 border-slate-300 font-mono text-xs px-2.5 py-0.5">
                ○ NOT LOADED
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Generate interconnected demonstration business records for AJAY ENTERPRISES or cleanly reset demo data.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || generating || clearing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {isLoaded ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmInput("");
                setClearModalOpen(true);
              }}
              disabled={clearing || generating}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Demo Data
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={generating || clearing}
              className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generating ? "Generating Dataset..." : "Generate Demo Data"}
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Demo Status
            </CardDescription>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {isLoaded ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Loaded & Active
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Not Loaded
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {isLoaded
                ? "Full business transactions populated"
                : "Clean database with real configuration only"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Active Dataset ID
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-slate-900">
              {activeRun?.runNumber || "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {activeRun?.createdAt ? new Date(activeRun.createdAt).toLocaleString("en-IN") : "No active dataset"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Total Demo Records
            </CardDescription>
            <CardTitle className="text-xl font-bold text-slate-900 font-mono">
              {activeRun?.totalRecords ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Tracked in registry for safe reset</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Safety Isolation
            </CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              100% Protected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Genuine data & settings strictly preserved</p>
          </CardContent>
        </Card>
      </div>

      {/* When Demo Data is Loaded: Show Module Breakdown */}
      {isLoaded && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              Module-Wise Record Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Interconnected records created across all core INVENTRA domains for AJAY ENTERPRISES
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <Boxes className="w-4 h-4 text-orange-600" />
                  Master Data
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.masterData ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Customers, Sites, Suppliers</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  Inventory
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.inventory ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Movements & Stock Balances</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <ReceiptIndianRupee className="w-4 h-4 text-purple-600" />
                  Purchases
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.purchases ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">POs, GRNs, Bills, Payments</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  Operations
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.operations ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">DN, MRN, GPS Proof, DSTN</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  Rentals
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.rentals ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Agreements, Batches, Statements</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <ReceiptIndianRupee className="w-4 h-4 text-teal-600" />
                  Accounting
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.accounting ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Invoices, Receipts, Journals</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  Fleet
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.fleet ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Trucks, Drivers, Trips, Fuel</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <HardHat className="w-4 h-4 text-amber-700" />
                  Labour
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.labour ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Workers, Muster, Wages</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-rose-600" />
                  Maintenance
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {counts.maintenance ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Repairs, Welding, Recondition</div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg shadow-2xs flex flex-col justify-center">
                <div className="text-xs font-bold text-amber-900">Total Generated</div>
                <div className="text-2xl font-bold font-mono text-amber-950 mt-1">
                  {activeRun?.totalRecords ?? 0}
                </div>
                <div className="text-[11px] text-amber-800">Across 10 Modules</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safety & Isolation Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-600" />
              Strict Data Isolation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-1.5">
            <p>
              Every generated record carries <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">isDemo=true</code> and is tracked in the <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">DemoDataRecord</code> registry.
            </p>
            <p>
              Genuine company settings, owner user accounts, and tax profiles are strictly untouched.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              100% Genuine Accounting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-1.5">
            <p>
              No pretend transactions. General ledger journals adhere to strict double-entry (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Debits == Credits</code>).
            </p>
            <p>
              Stock balances are mathematically derived from movement ledgers, preserving all INVENTRA rules.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              External Actions Suppressed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-1.5">
            <p>
              Real WhatsApp transmissions, SMS notifications, and government NIC E-Way Bill calls are safely simulated.
            </p>
            <p>
              Feel confident demonstrating dispatches and invoicing without triggering real-world external side effects.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Generation History Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-200">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            Demo Generation & Reset History
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Immutable log of demo data generation and cleanup runs for compliance and auditability
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Dataset ID</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Records</th>
                  <th className="py-2.5 px-4">Generated At</th>
                  <th className="py-2.5 px-4">Cleared At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusData?.history && statusData.history.length > 0 ? (
                  statusData.history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{h.runNumber}</td>
                      <td className="py-2.5 px-4">
                        {h.status === "ACTIVE" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-mono text-[10px]">
                            ACTIVE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono text-[10px]">
                            CLEARED
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{h.totalRecords}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(h.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {h.clearedAt ? new Date(h.clearedAt).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No demo data runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal for Clearing Demo Data */}
      <Dialog open={clearModalOpen} onOpenChange={setClearModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirm Demo Data Deletion
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-2 space-y-2">
              <p>
                You are about to delete all <strong>{activeRun?.totalRecords ?? 0}</strong> demo records belonging to dataset{" "}
                <strong className="font-mono">{activeRun?.runNumber}</strong>.
              </p>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-900 text-xs">
                <strong>Guaranteed Safety:</strong> Only records generated as part of this demo dataset will be removed. Your genuine business records, company profiles, documents, bank accounts, and user credentials will remain completely untouched.
              </div>
              <p className="text-slate-700 font-medium">
                To confirm deletion, type <code className="bg-slate-100 text-red-600 px-1 py-0.5 rounded font-mono font-bold">CLEAR DEMO</code> below:
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type CLEAR DEMO to confirm"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setClearModalOpen(false);
                setConfirmInput("");
              }}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              disabled={confirmInput !== "CLEAR DEMO" || clearing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearing ? "Clearing Demo Data..." : "Permanently Clear Demo Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
