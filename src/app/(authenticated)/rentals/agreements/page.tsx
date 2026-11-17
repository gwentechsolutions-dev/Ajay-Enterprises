"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Calendar,
  Building,
  IndianRupee,
  AlertCircle,
  X,
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
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export default function RentalAgreementsPage() {
  const [agreements, setAgreements] = React.useState<any[]>([]);
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
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("0");
  const [paymentTerms, setPaymentTerms] = React.useState("Net 15 Days");
  const [specialTerms, setSpecialTerms] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{ materialVariantId: string; agreedDailyRate: string; remarks: string }>
  >([]);
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary" | "success";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fetchAgreements = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/agreements");
      const json = await res.json();
      if (json.success) {
        setAgreements(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch agreements:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAgreements();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsModalOpen(true);
      }
    }

    // Fetch Master Data
    fetch("/api/v1/customers")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCustomers(j.data || []);
      })
      .catch(() => {});

    fetch("/api/v1/materials/variants")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setVariants(j.data || []);
      })
      .catch(() => {});
  }, [fetchAgreements]);

  // When customer changes, filter sites
  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSites([]);
      return;
    }
    const c = customers.find((cust) => cust.id === selectedCustomerId);
    setSites(c?.sites || []);
    if (c?.sites && c.sites.length > 0) {
      setSelectedSiteId(c.sites[0].id);
    } else {
      setSelectedSiteId("");
    }
  }, [selectedCustomerId, customers]);

  const handleAddItem = () => {
    if (variants.length === 0) return;
    const defaultVar = variants[0];
    setItems((prev) => [
      ...prev,
      {
        materialVariantId: defaultVar.id,
        agreedDailyRate: defaultVar.defaultDailyRate?.toString() || "10",
        remarks: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === "materialVariantId") {
        const v = variants.find((vr) => vr.id === value);
        if (v && v.defaultDailyRate) {
          copy[index].agreedDailyRate = v.defaultDailyRate.toString();
        }
      }
      return copy;
    });
  };

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedSiteId) {
      toast.error("Please select both a Customer and Customer Site.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one material variant rate.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        customerSiteId: selectedSiteId,
        startDate,
        endDate: endDate || null,
        billingFrequency: "MONTHLY",
        billingCycleDay: 1,
        depositAmount: Number(depositAmount) || 0,
        depositStatus: Number(depositAmount) > 0 ? "PENDING" : "FULLY_PAID",
        paymentTerms,
        specialTerms: specialTerms || null,
        items: items.map((it) => ({
          materialVariantId: it.materialVariantId,
          agreedDailyRate: Number(it.agreedDailyRate) || 0,
          remarks: it.remarks || null,
        })),
      };

      const res = await fetch("/api/v1/rentals/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to create agreement");
        return;
      }

      toast.success("Rental Agreement created successfully.");
      setIsModalOpen(false);
      setItems([]);
      fetchAgreements();
    } catch (err: any) {
      toast.error(err.message || "Failed to create agreement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = (id: string, agreementNumber: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Approve Rental Agreement",
      description: `Are you sure you want to approve and activate Agreement ${agreementNumber}? Once approved, active rental dispatches can reference these agreed rates.`,
      confirmText: "Approve & Activate",
      variant: "primary",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/rentals/agreements/${id}/approve`, {
            method: "POST",
          });
          const json = await res.json();
          if (json.success) {
            toast.success(`Agreement ${agreementNumber} approved and activated.`);
            fetchAgreements();
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          } else {
            toast.error(json.error?.message || "Failed to approve agreement");
          }
        } catch (err: any) {
          toast.error(err.message || "Approval failed");
        }
      },
    });
  };

  const filtered = agreements.filter((agr) => {
    const matchStatus = statusFilter === "ALL" || agr.status === statusFilter;
    const matchSearch =
      agr.agreementNumber.toLowerCase().includes(search.toLowerCase()) ||
      agr.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      agr.customerSite?.siteName.toLowerCase().includes(search.toLowerCase());
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
            Rental Agreements Master
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Configure site-specific daily rental rates, security deposits, and multi-site billing agreements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAgreements}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              if (items.length === 0 && variants.length > 0) {
                handleAddItem();
              }
              setIsModalOpen(true);
            }}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Rental Agreement
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search agreement, customer, site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["ALL", "ACTIVE", "DRAFT", "COMPLETED"].map((st) => (
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

      {/* Agreements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Agreement #</th>
                <th className="p-3.5">Customer & Site</th>
                <th className="p-3.5">Period</th>
                <th className="p-3.5">Deposit</th>
                <th className="p-3.5">Rates Configured</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading agreements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No rental agreements found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((agr) => (
                  <tr key={agr.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-[#0B1E36]">
                        {agr.agreementNumber}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{agr.customer?.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {agr.customerSite?.siteName} ({agr.customerSite?.siteCode})
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div>From: {new Date(agr.startDate).toLocaleDateString()}</div>
                      {agr.endDate && <div>To: {new Date(agr.endDate).toLocaleDateString()}</div>}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">
                        ₹{Number(agr.depositAmount).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">{agr.depositStatus}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                        {agr.items?.length || 0} materials
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          agr.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : agr.status === "COMPLETED"
                            ? "bg-slate-100 text-slate-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {agr.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {agr.status === "DRAFT" && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(agr.id, agr.agreementNumber)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
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

      {/* CREATE AGREEMENT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Create Site Rental Agreement
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateAgreement} className="space-y-4 pt-2">
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
                <Label required>Customer Construction Site</Label>
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

              <div>
                <Label required>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1.5 h-9 text-xs"
                />
              </div>

              <div>
                <Label>Expected End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5 h-9 text-xs"
                />
              </div>

              <div>
                <Label>Security Deposit Amount (INR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mt-1.5 h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label>Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. Net 15 Days, Due on presentation"
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>

            {/* Material Rates Table */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <Label required className="text-xs font-bold text-slate-800">
                  Agreed Daily Rental Rates for Centering Materials
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Material Rate
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-2">Material Variant</th>
                      <th className="p-2 w-32">Daily Rate (₹)</th>
                      <th className="p-2">Remarks</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={item.materialVariantId}
                            onChange={(e) =>
                              handleItemChange(idx, "materialVariantId", e.target.value)
                            }
                            className="w-full h-8 rounded border border-slate-300 px-2 text-xs"
                          >
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.materialCode})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.agreedDailyRate}
                            onChange={(e) =>
                              handleItemChange(idx, "agreedDailyRate", e.target.value)
                            }
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.remarks}
                            onChange={(e) => handleItemChange(idx, "remarks", e.target.value)}
                            placeholder="Optional notes"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                {isSubmitting ? "Creating..." : "Save Agreement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />
    </div>
  );
}

