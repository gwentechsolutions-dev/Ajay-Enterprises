"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  ShieldAlert,
  Trash2,
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

interface DamageItemRow {
  id: string;
  materialVariantId: string;
  assessmentType: "DAMAGED_REPAIRABLE" | "DAMAGED_SCRAP" | "MISSING";
  quantity: string;
  chargeAmount: string;
  remarks: string;
}

export default function DamageLossPage() {
  const [assessments, setAssessments] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [selectedSiteId, setSelectedSiteId] = React.useState("");

  // Multiple items state
  const [items, setItems] = React.useState<DamageItemRow[]>([
    {
      id: "row-1",
      materialVariantId: "",
      assessmentType: "DAMAGED_REPAIRABLE",
      quantity: "1",
      chargeAmount: "500",
      remarks: "",
    },
  ]);

  const fetchAssessments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/damage-loss");
      const json = await res.json();
      if (json.success) {
        setAssessments(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAssessments();

    fetch("/api/v1/customers")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCustomers(j.data || []);
      })
      .catch(() => {});

    fetch("/api/v1/materials/variants")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const varList = j.data || [];
          setVariants(varList);
          if (varList.length > 0) {
            setItems((prev) =>
              prev.map((it) => (it.materialVariantId ? it : { ...it, materialVariantId: varList[0].id }))
            );
          }
        }
      })
      .catch(() => {});
  }, [fetchAssessments]);

  // Update sites on customer change
  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSites([]);
      setSelectedSiteId("");
      return;
    }
    const c = customers.find((cust) => cust.id === selectedCustomerId);
    const sList = c?.sites || [];
    setSites(sList);
    if (sList.length > 0) setSelectedSiteId(sList[0].id);
  }, [selectedCustomerId, customers]);

  // Multi-item handlers
  const handleAddItem = () => {
    const defaultVariantId = variants.length > 0 ? variants[0].id : "";
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialVariantId: defaultVariantId,
        assessmentType: "DAMAGED_REPAIRABLE",
        quantity: "1",
        chargeAmount: "500",
        remarks: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: keyof DamageItemRow, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const resetModal = () => {
    setSelectedCustomerId("");
    setSelectedSiteId("");
    setItems([
      {
        id: `row-${Date.now()}`,
        materialVariantId: variants.length > 0 ? variants[0].id : "",
        assessmentType: "DAMAGED_REPAIRABLE",
        quantity: "1",
        chargeAmount: "500",
        remarks: "",
      },
    ]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedSiteId) {
      alert("Please select both Customer and Construction Site.");
      return;
    }

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.materialVariantId) {
        alert(`Item #${i + 1}: Please select a Material Variant.`);
        return;
      }
      const qty = Number(it.quantity);
      if (isNaN(qty) || qty <= 0) {
        alert(`Item #${i + 1}: Affected quantity must be greater than zero.`);
        return;
      }
      const charge = Number(it.chargeAmount);
      if (isNaN(charge) || charge < 0) {
        alert(`Item #${i + 1}: Charge amount must be zero or a positive amount.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        customerSiteId: selectedSiteId,
        items: items.map((it) => ({
          materialVariantId: it.materialVariantId,
          assessmentType: it.assessmentType,
          quantity: Number(it.quantity),
          approvedChargeAmount: Number(it.chargeAmount) || 0,
          remarks: it.remarks?.trim() || null,
        })),
      };

      const res = await fetch("/api/v1/rentals/damage-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || "Failed to record assessments");
        return;
      }

      setIsModalOpen(false);
      resetModal();
      fetchAssessments();
    } catch (err: any) {
      alert(err.message || "Failed to record assessments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string, num: string) => {
    if (!confirm(`Approve Damage/Loss Claim ${num}?`)) return;
    try {
      const res = await fetch(`/api/v1/rentals/damage-loss/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) fetchAssessments();
      else alert(json.error?.message || "Approval failed");
    } catch (err: any) {
      alert(err.message || "Approval failed");
    }
  };

  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const totalAmount = items.reduce((acc, it) => acc + (Number(it.chargeAmount) || 0), 0);

  const filtered = assessments.filter((a) => {
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchSearch =
      a.assessmentNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      a.customerSite?.siteName.toLowerCase().includes(search.toLowerCase()) ||
      a.materialVariant?.name.toLowerCase().includes(search.toLowerCase());
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
            Damage & Missing Equipment Claims
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Record repairable equipment damages, scrap write-offs, and missing material customer loss recovery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAssessments}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              resetModal();
              setIsModalOpen(true);
            }}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Record Damage / Loss Claim
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search claim #, customer, material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "PENDING_APPROVAL", "APPROVED", "SETTLED"].map((st) => (
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

      {/* Claims Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Claim #</th>
                <th className="p-3.5">Customer & Site</th>
                <th className="p-3.5">Material & Type</th>
                <th className="p-3.5 text-right">Quantity</th>
                <th className="p-3.5 text-right font-bold text-slate-900">Charge Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading claims...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No damage or missing equipment claims recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-[#0B1E36]">{a.assessmentNumber}</span>
                      <div className="text-[10px] text-slate-500">
                        {new Date(a.assessmentDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{a.customer?.name}</div>
                      <div className="text-[11px] text-slate-500">{a.customerSite?.siteName}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{a.materialVariant?.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Type:{" "}
                        <span className="text-red-700 font-bold">{a.assessmentType}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      {Number(a.quantity).toFixed(2)} {a.materialVariant?.uom}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-red-600">
                      ₹{Number(a.approvedChargeAmount).toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.status === "SETTLED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {a.status === "PENDING_APPROVAL" && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(a.id, a.assessmentNumber)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve Claim
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MULTI-ITEM MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1E36] flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Record Damage or Loss Assessment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {/* Top Customer & Site Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <Label required className="text-xs font-semibold text-slate-700">Customer</Label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label required className="text-xs font-semibold text-slate-700">Customer Site</Label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  required
                  disabled={sites.length === 0}
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium disabled:opacity-60"
                >
                  <option value="">-- Select Site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.siteName} ({s.siteCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-xs font-bold text-[#0B1E36] uppercase tracking-wide">
                    Assessed Items Breakdown ({items.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add multiple damaged, scrapped, or missing items in this single submission.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddItem}
                  className="text-xs border-[#0B1E36] text-[#0B1E36] hover:bg-slate-100 font-semibold h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1 text-[#F26522]" /> Add Another Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#0B1E36] text-white flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-5">
                        <Label required className="text-[11px] text-slate-600 font-semibold">
                          Material Variant
                        </Label>
                        <select
                          value={item.materialVariantId}
                          onChange={(e) => handleUpdateItem(idx, "materialVariantId", e.target.value)}
                          required
                          className="w-full mt-1 h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium"
                        >
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.materialCode}) {v.uom ? `[${v.uom}]` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <Label required className="text-[11px] text-slate-600 font-semibold">
                          Assessment Type
                        </Label>
                        <select
                          value={item.assessmentType}
                          onChange={(e) =>
                            handleUpdateItem(
                              idx,
                              "assessmentType",
                              e.target.value as "DAMAGED_REPAIRABLE" | "DAMAGED_SCRAP" | "MISSING"
                            )
                          }
                          className="w-full mt-1 h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium"
                        >
                          <option value="DAMAGED_REPAIRABLE">Damaged (Repairable)</option>
                          <option value="DAMAGED_SCRAP">Scrap (Beyond Repair)</option>
                          <option value="MISSING">Missing / Lost on Site</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <Label required className="text-[11px] text-slate-600 font-semibold">
                          Affected Qty
                        </Label>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                          required
                          className="mt-1 h-9 text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label required className="text-[11px] text-slate-600 font-semibold">
                          Charge Amount (₹)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.chargeAmount}
                          onChange={(e) => handleUpdateItem(idx, "chargeAmount", e.target.value)}
                          required
                          className="mt-1 h-9 text-xs font-mono font-black text-red-600"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <Label className="text-[10px] text-slate-500 uppercase font-semibold">
                          Remarks / Inspection Notes
                        </Label>
                        <Input
                          value={item.remarks}
                          onChange={(e) => handleUpdateItem(idx, "remarks", e.target.value)}
                          placeholder="e.g. Severely bent prop outer tube during column box shuttering."
                          className="mt-1 h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary Footer Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="text-slate-600 font-medium">
                  Total Items: <strong className="text-slate-900">{items.length}</strong> | Total Affected Quantity:{" "}
                  <strong className="text-slate-900 font-mono">{totalQuantity.toFixed(2)}</strong>
                </div>
                <div className="text-slate-700">
                  Total Approved Charges to Bill:{" "}
                  <strong className="text-red-700 text-sm font-black font-mono">
                    ₹{totalAmount.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                {isSubmitting ? "Recording..." : `Record ${items.length} Assessment(s)`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
