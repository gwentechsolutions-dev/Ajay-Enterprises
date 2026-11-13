"use client";

import * as React from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Search,
  Warehouse as WarehouseIcon,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { toast } from "sonner";

export default function StockAuditsPage() {
  const [audits, setAudits] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    warehouseId: "",
    title: "",
    remarks: "",
  });

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [aRes, wRes] = await Promise.all([
        fetch("/api/v1/inventory/stock-audits"),
        fetch("/api/v1/warehouses"),
      ]);
      const [aData, wData] = await Promise.all([aRes.json(), wRes.json()]);

      if (aData.success) setAudits(aData.data);
      if (wData.success) setWarehouses(wData.data);
    } catch {
      toast.error("Failed to load stock verification records.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/inventory/stock-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to initiate audit");
      toast.success(`Stock audit ${data.data.auditNumber} initiated. Expected stock balances snapshotted.`);
      setIsModalOpen(false);
      setForm({ warehouseId: "", title: "", remarks: "" });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Physical Stock Verification & Reconciliation
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
              {audits.length} Audits
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Physical warehouse counts, expected vs actual variance calculation & automated ledger adjustment
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> + Initiate Stock Verification
        </Button>
      </div>

      {/* Audits Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Audit Ref #</th>
                <th className="py-3 px-4">Warehouse / Yard</th>
                <th className="py-3 px-4">Audit Title & Scope</th>
                <th className="py-3 px-4">Conducted Date</th>
                <th className="py-3 px-4">Auditor</th>
                <th className="py-3 px-4 text-center">Items Count</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading physical verification records...
                  </td>
                </tr>
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <ClipboardCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No stock verification records found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &quot;+ Initiate Stock Verification&quot; to begin physical stock audit for a warehouse.
                    </p>
                  </td>
                </tr>
              ) : (
                audits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {a.auditNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {a.warehouse?.name}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{a.title}</div>
                      {a.remarks ? <div className="text-[11px] text-slate-400 italic">{a.remarks}</div> : null}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      {new Date(a.auditDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {a.conductedBy?.name || "System"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {a._count?.items || 0}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          a.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                            : a.status === "PENDING_APPROVAL"
                            ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold"
                            : "bg-blue-50 text-blue-800 border-blue-200 font-semibold"
                        }
                      >
                        {a.status === "COMPLETED" ? "Reconciled" : a.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/inventory/audits/${a.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-slate-300">
                          Open Worksheet <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* INITIATE AUDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Physical Stock Verification</DialogTitle>
            <DialogDescription>
              Select a warehouse yard to freeze and snapshot expected ledger balances for physical count comparison.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAudit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label required>Warehouse Yard to Verify</Label>
              <SearchableCombobox
                options={warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode }))}
                value={form.warehouseId}
                onChange={(val) => setForm({ ...form, warehouseId: val })}
                placeholder="Select yard..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audTitle" required>Audit Title / Purpose</Label>
              <Input
                id="audTitle"
                placeholder="e.g. Q4 Centering Material Physical Count / Annual Audit"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audRemarks">Audit Notes</Label>
              <Input
                id="audRemarks"
                placeholder="Supervised by yard manager"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Snapshot & Open Audit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

