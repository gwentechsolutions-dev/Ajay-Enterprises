"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Building,
  IndianRupee,
  ShieldAlert,
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

export default function DamageLossPage() {
  const [assessments, setAssessments] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Create Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [selectedSiteId, setSelectedSiteId] = React.useState("");
  const [selectedVariantId, setSelectedVariantId] = React.useState("");
  const [assessmentType, setAssessmentType] = React.useState("DAMAGED_REPAIRABLE");
  const [quantity, setQuantity] = React.useState("1");
  const [chargeAmount, setChargeAmount] = React.useState("500");
  const [remarks, setRemarks] = React.useState("");

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
          setVariants(j.data || []);
          if (j.data && j.data.length > 0) setSelectedVariantId(j.data[0].id);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedSiteId || !selectedVariantId) {
      alert("Please fill all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        customerSiteId: selectedSiteId,
        materialVariantId: selectedVariantId,
        assessmentType,
        quantity: Number(quantity) || 1,
        approvedChargeAmount: Number(chargeAmount) || 0,
        remarks: remarks || null,
      };

      const res = await fetch("/api/v1/rentals/damage-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error?.message || "Failed to record assessment");
        return;
      }

      setIsModalOpen(false);
      fetchAssessments();
    } catch (err: any) {
      alert(err.message || "Failed to record assessment");
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
            onClick={() => setIsModalOpen(true)}
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

      {/* CREATE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1E36] flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Record Damage or Loss Assessment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
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

              <div>
                <Label required>Customer Site</Label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  required
                  disabled={sites.length === 0}
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
                >
                  <option value="">-- Select Site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.siteName} ({s.siteCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <Label required>Material Variant</Label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  required
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.materialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label required>Assessment Type</Label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full mt-1.5 h-9 rounded-md border border-slate-300 bg-white px-3 text-xs"
                >
                  <option value="DAMAGED_REPAIRABLE">Damaged (Repairable / Maintenance)</option>
                  <option value="DAMAGED_SCRAP">Damaged Beyond Repair (Scrap Write-off)</option>
                  <option value="MISSING">Missing / Lost on Site</option>
                </select>
              </div>

              <div>
                <Label required>Affected Quantity</Label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="mt-1.5 h-9 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <Label required>Approved Charge Amount to Bill Customer (INR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  required
                  className="mt-1.5 h-9 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Remarks / Inspection Assessment</Label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Severely bent prop outer tube during column box shuttering."
                  className="mt-1.5 h-9 text-xs"
                />
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
                {isSubmitting ? "Recording..." : "Record Assessment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

