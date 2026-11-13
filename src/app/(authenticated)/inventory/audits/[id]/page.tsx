"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ArrowLeft,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Save,
  CheckCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function StockAuditWorksheetPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [audit, setAudit] = React.useState<any | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [conditions, setConditions] = React.useState<Record<string, string>>({});
  const [remarks, setRemarks] = React.useState<Record<string, string>>({});

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [approving, setApproving] = React.useState(false);

  const fetchAudit = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/inventory/stock-audits/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to load audit");
      setAudit(data.data);

      // Pre-fill count state from existing items
      const initialCounts: Record<string, number> = {};
      const initialConditions: Record<string, string> = {};
      const initialRemarks: Record<string, string> = {};

      for (const item of data.data.items || []) {
        initialCounts[item.id] = Number(item.physicalQty);
        initialConditions[item.id] = item.condition || "GOOD";
        initialRemarks[item.id] = item.remarks || "";
      }

      setCounts(initialCounts);
      setConditions(initialConditions);
      setRemarks(initialRemarks);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleCountChange = (itemId: string, value: string) => {
    const val = value === "" ? 0 : Number(value);
    setCounts((prev) => ({ ...prev, [itemId]: val }));
  };

  // Submit physical counts
  const handleSaveCounts = async () => {
    if (!audit) return;
    try {
      setSaving(true);
      const payload = {
        stockAuditId: audit.id,
        items: audit.items.map((item: any) => ({
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          physicalQty: counts[item.id] !== undefined ? counts[item.id] : Number(item.physicalQty),
          condition: conditions[item.id] || item.condition || "GOOD",
          remarks: remarks[item.id] || item.remarks || null,
        })),
      };

      const res = await fetch(`/api/v1/inventory/stock-audits/${id}/count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to save counts");
      toast.success(data.message);
      await fetchAudit();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Approve & Reconcile
  const handleApproveAndReconcile = async () => {
    if (!audit) return;
    try {
      setApproving(true);
      const res = await fetch(`/api/v1/inventory/stock-audits/${id}/approve`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to approve audit");
      toast.success(data.message);
      await fetchAudit();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0B1E36] mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading physical verification worksheet...</p>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Audit Record Not Found</h2>
        <Link href="/inventory/audits">
          <Button variant="outline" size="sm">Back to Audits</Button>
        </Link>
      </div>
    );
  }

  const isCompleted = audit.status === "COMPLETED";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/inventory/audits">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {audit.title}
              </h1>
              <Badge variant="outline" className="font-mono text-xs bg-slate-100 font-bold">
                {audit.auditNumber}
              </Badge>
              <Badge
                variant="outline"
                className={
                  isCompleted
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                    : audit.status === "PENDING_APPROVAL"
                    ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold"
                    : "bg-blue-50 text-blue-800 border-blue-200 font-semibold"
                }
              >
                {isCompleted ? "Reconciled & Completed" : audit.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Yard: <strong>{audit.warehouse?.name}</strong> ({audit.warehouse?.warehouseCode}) • Date:{" "}
              {new Date(audit.auditDate).toLocaleDateString("en-IN")} • Auditor: {audit.conductedBy?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveCounts}
                disabled={saving}
                className="text-xs border-slate-300 font-medium"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5 text-slate-600" />
                )}
                Save Physical Counts
              </Button>

              <Button
                size="sm"
                onClick={handleApproveAndReconcile}
                disabled={approving}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
              >
                {approving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                )}
                Approve & Post Ledger Adjustments
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>Approved by {audit.approvedBy?.name || "Administrator"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Information Banner */}
      <Card className="border-slate-200 shadow-none bg-slate-50/60 p-4">
        <div className="text-xs text-slate-600 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0B1E36] shrink-0 mt-0.5" />
          <div>
            <strong>Reconciliation Protocol (Prompt 10 & Business Rule 16):</strong> Expected stock balances are frozen from the immutable movement ledger. Physical counts are verified against expected quantities. Upon approval, automated <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">FOUND_STOCK</code> (excess) or <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">MISSING</code> (shortage) adjustment movements are posted. Inventory balances are never directly overwritten.
          </div>
        </div>
      </Card>

      {/* Worksheet Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Material Code</th>
                <th className="py-3 px-4">Material Variant & Size</th>
                <th className="py-3 px-4 text-center">Ownership</th>
                <th className="py-3 px-4 text-right">Expected Ledger Qty</th>
                <th className="py-3 px-4 text-center w-36">Actual Physical Count</th>
                <th className="py-3 px-4 text-right">Variance / Difference</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {audit.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No material items loaded for this audit.
                  </td>
                </tr>
              ) : (
                audit.items?.map((item: any) => {
                  const expected = Number(item.expectedQty);
                  const counted = counts[item.id] !== undefined ? counts[item.id] : Number(item.physicalQty);
                  const diff = counted - expected;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.materialVariant?.materialCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.materialVariant?.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.materialVariant?.size} • {item.materialVariant?.uom}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {item.ownershipType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 text-sm">
                        {expected}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCompleted ? (
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {counted}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            value={counted}
                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                            className="h-8 font-mono font-bold text-center text-xs"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {diff === 0 ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 font-mono font-semibold">
                            Balanced (0)
                          </Badge>
                        ) : diff > 0 ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono font-bold">
                            +{diff} (Excess)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 font-mono font-bold">
                            {diff} (Shortage)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="text-[11px] text-slate-700">{item.condition}</span>
                        ) : (
                          <select
                            value={conditions[item.id] || item.condition || "GOOD"}
                            onChange={(e) => setConditions({ ...conditions, [item.id]: e.target.value })}
                            className="h-8 text-xs border border-slate-200 rounded-md px-2 bg-white"
                          >
                            <option value="GOOD">Good</option>
                            <option value="FAIR">Fair</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="SCRAP">Scrap</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isCompleted ? (
                          <span className="text-slate-500 italic text-[11px]">{item.remarks || "—"}</span>
                        ) : (
                          <Input
                            placeholder="Count remarks"
                            value={remarks[item.id] || ""}
                            onChange={(e) => setRemarks({ ...remarks, [item.id]: e.target.value })}
                            className="h-8 text-xs"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
