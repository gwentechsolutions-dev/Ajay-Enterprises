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
  Send,
  Printer,
  Copy,
  ExternalLink,
  Edit3,
  Clock,
  ShieldCheck,
  Check,
  Phone,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

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
  const [orderReference, setOrderReference] = React.useState("");
  const [autoSendWhatsApp, setAutoSendWhatsApp] = React.useState(true);
  const [items, setItems] = React.useState<
    Array<{ materialVariantId: string; quantity: string; agreedDailyRate: string; remarks: string }>
  >([]);

  // Amendment Modal State
  const [isAmendModalOpen, setIsAmendModalOpen] = React.useState(false);
  const [isAmending, setIsAmending] = React.useState(false);
  const [targetAgreement, setTargetAgreement] = React.useState<any | null>(null);
  const [amendmentReason, setAmendmentReason] = React.useState("");
  const [amendStartDate, setAmendStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [amendEndDate, setAmendEndDate] = React.useState("");
  const [amendPaymentTerms, setAmendPaymentTerms] = React.useState("Net 15 Days");
  const [amendItems, setAmendItems] = React.useState<
    Array<{ materialVariantId: string; quantity: string; agreedDailyRate: string; remarks: string }>
  >([]);

  // WhatsApp Dialog State
  const [whatsAppModalOpen, setWhatsAppModalOpen] = React.useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = React.useState<any | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = React.useState("");
  const [whatsAppContactName, setWhatsAppContactName] = React.useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = React.useState(false);

  // Copied link state
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Confirm Modal
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

  // When customer changes in create modal, filter sites
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

  // Combobox options
  const customerOptions = React.useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: `${c.customerCode || ""} • ${c.primaryMobile || c.whatsappNumber || "No phone"}`,
    }));
  }, [customers]);

  const siteOptions = React.useMemo(() => {
    return sites.map((s) => ({
      value: s.id,
      label: s.siteName,
      sublabel: `${s.siteCode || ""} • ${s.fullAddress || s.city || ""}`,
    }));
  }, [sites]);

  const variantOptions = React.useMemo(() => {
    return variants.map((v) => ({
      value: v.id,
      label: v.name,
      sublabel: `${v.materialCode} • ${v.size || ""} (${v.uom}) • ₹${Number(v.defaultDailyRate || 0).toFixed(2)}/day`,
    }));
  }, [variants]);

  // Item management in Create Modal
  const handleAddItem = () => {
    if (variants.length === 0) return;
    const defaultVar = variants[0];
    setItems((prev) => [
      ...prev,
      {
        materialVariantId: defaultVar.id,
        quantity: "100",
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

  // Item management in Amend Modal
  const handleAddAmendItem = () => {
    if (variants.length === 0) return;
    const defaultVar = variants[0];
    setAmendItems((prev) => [
      ...prev,
      {
        materialVariantId: defaultVar.id,
        quantity: "100",
        agreedDailyRate: defaultVar.defaultDailyRate?.toString() || "10",
        remarks: "",
      },
    ]);
  };

  const handleRemoveAmendItem = (index: number) => {
    setAmendItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAmendItemChange = (index: number, field: string, value: string) => {
    setAmendItems((prev) => {
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
        orderReference: orderReference.trim() || null,
        autoSendWhatsApp,
        items: items.map((it) => ({
          materialVariantId: it.materialVariantId,
          quantity: Number(it.quantity) || 0,
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

      toast.success(json.message || "Rental Agreement created successfully.");
      setIsModalOpen(false);
      setItems([]);
      fetchAgreements();
    } catch (err: any) {
      toast.error(err.message || "Failed to create agreement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAmendModal = (agr: any) => {
    setTargetAgreement(agr);
    setAmendmentReason("");
    setAmendStartDate(new Date().toISOString().split("T")[0]);
    setAmendEndDate(agr.endDate ? new Date(agr.endDate).toISOString().split("T")[0] : "");
    setAmendPaymentTerms(agr.paymentTerms || "Net 15 Days");
    setAmendItems(
      (agr.items || []).map((it: any) => ({
        materialVariantId: it.materialVariantId,
        quantity: it.quantity ? String(it.quantity) : "0",
        agreedDailyRate: it.dailyRentalRate ? String(it.dailyRentalRate) : "0",
        remarks: it.remarks || "",
      }))
    );
    setIsAmendModalOpen(true);
  };

  const handleSubmitAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAgreement) return;
    if (!amendmentReason.trim()) {
      toast.error("Please enter a reason for this amendment.");
      return;
    }
    if (amendItems.length === 0) {
      toast.error("At least one material item is required.");
      return;
    }

    setIsAmending(true);
    try {
      const res = await fetch(`/api/v1/rentals/agreements/${targetAgreement.id}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amendmentReason: amendmentReason.trim(),
          startDate: amendStartDate,
          endDate: amendEndDate || null,
          paymentTerms: amendPaymentTerms,
          items: amendItems.map((it) => ({
            materialVariantId: it.materialVariantId,
            quantity: Number(it.quantity) || 0,
            agreedDailyRate: Number(it.agreedDailyRate) || 0,
            remarks: it.remarks || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to amend agreement");
        return;
      }

      toast.success(json.message || "New amended agreement version created successfully.");
      setIsAmendModalOpen(false);
      fetchAgreements();
    } catch (err: any) {
      toast.error(err.message || "Failed to amend agreement");
    } finally {
      setIsAmending(false);
    }
  };

  const handleApprove = (id: string, agreementNumber: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Approve Rental Agreement",
      description: `Are you sure you want to approve and activate Agreement ${agreementNumber}? Once approved, active rental dispatches can reference these agreed rates, and PDF & WhatsApp notifications are dispatched automatically.`,
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

  const handleOpenWhatsAppModal = (agr: any) => {
    setWhatsAppTarget(agr);
    const phone =
      agr.customer?.whatsappNumber ||
      agr.customer?.primaryMobile ||
      agr.customerSite?.siteContactDetails ||
      "";
    setWhatsAppPhone(phone.replace(/\D/g, "").slice(-10));
    setWhatsAppContactName(agr.customer?.name || "");
    setWhatsAppModalOpen(true);
  };

  const handleSendWhatsAppNotification = async () => {
    if (!whatsAppTarget) return;
    setIsSendingWhatsApp(true);
    try {
      const res = await fetch(`/api/v1/rentals/agreements/${whatsAppTarget.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrideRecipient: whatsAppPhone ? `91${whatsAppPhone.slice(-10)}` : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to dispatch WhatsApp message.");
        return;
      }
      toast.success(json.message || "WhatsApp message dispatched successfully!");
      setWhatsAppModalOpen(false);
      fetchAgreements();
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch WhatsApp notification.");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleCopyAcknowledgeLink = (agr: any) => {
    if (!agr.acknowledgementToken) {
      toast.error("No acknowledgement token generated for this agreement.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ajay-enterprises-gwen-tech.vercel.app";
    const link = `${origin}/rentals/agreements/${agr.id}/acknowledge?token=${encodeURIComponent(agr.acknowledgementToken)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(agr.id);
    toast.success("Customer acknowledgement link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 3000);
  };

  const filtered = agreements.filter((agr) => {
    const matchStatus = statusFilter === "ALL" || agr.status === statusFilter;
    const matchSearch =
      agr.agreementNumber.toLowerCase().includes(search.toLowerCase()) ||
      agr.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      agr.customerSite?.siteName.toLowerCase().includes(search.toLowerCase()) ||
      (agr.orderReference && agr.orderReference.toLowerCase().includes(search.toLowerCase()));
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
            Automated rental contracts, daily rates, PDF slip generation, WhatsApp sharing, and customer digital acknowledgement.
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
            placeholder="Search agreement #, customer, site, order ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["ALL", "ACTIVE", "DRAFT", "ACKNOWLEDGED", "COMPLETED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
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
                <th className="p-3.5">Effective Date</th>
                <th className="p-3.5">Materials / Commitment</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">WhatsApp</th>
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
                filtered.map((agr) => {
                  const totalDaily = (agr.items || []).reduce(
                    (acc: number, it: any) =>
                      acc + (Number(it.quantity || 0) * Number(it.dailyRentalRate || 0)),
                    0
                  );
                  return (
                    <tr key={agr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0B1E36]">
                            {agr.agreementNumber}
                          </span>
                          {agr.version > 1 && (
                            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                              v{agr.version}
                            </span>
                          )}
                        </div>
                        {agr.orderReference && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Ref: {agr.orderReference}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{agr.customer?.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building className="h-3 w-3 shrink-0" />
                          <span>{agr.customerSite?.siteName}</span>
                          <span className="font-mono text-slate-400">({agr.customerSite?.siteCode})</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <div>From: {new Date(agr.startDate).toLocaleDateString("en-IN")}</div>
                        {agr.endDate && (
                          <div className="text-[11px] text-slate-400">
                            To: {new Date(agr.endDate).toLocaleDateString("en-IN")}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">
                          {agr.items?.length || 0} materials
                        </div>
                        {totalDaily > 0 && (
                          <div className="text-[11px] font-mono text-[#F26522] font-semibold">
                            ₹{totalDaily.toFixed(2)}/day est.
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            agr.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : agr.status === "ACKNOWLEDGED" || agr.status === "ACCEPTED"
                              ? "bg-blue-100 text-blue-800"
                              : agr.status === "COMPLETED"
                              ? "bg-slate-100 text-slate-800"
                              : agr.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {agr.status}
                        </span>
                        {agr.acknowledgedAt && (
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Ack by {agr.acknowledgedBy?.split(" ")[0]}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            agr.whatsAppStatus === "DELIVERED"
                              ? "bg-blue-100 text-blue-800"
                              : agr.whatsAppStatus === "SENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : agr.whatsAppStatus === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {agr.whatsAppStatus || "PENDING"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / View Slip */}
                          <a
                            href={`/api/v1/rentals/agreements/${agr.id}/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                            title="View / Print Printable Slip"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </a>

                          {/* WhatsApp Share */}
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsAppModal(agr)}
                            className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                            title="Share on WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>

                          {/* Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopyAcknowledgeLink(agr)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                            title="Copy Customer Acknowledgement Link"
                          >
                            {copiedId === agr.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Amend Agreement */}
                          {agr.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => handleOpenAmendModal(agr)}
                              className="p-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
                              title="Create Amended Agreement (V2, V3)"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Approve (if Draft) */}
                          {agr.status === "DRAFT" && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(agr.id, agr.agreementNumber)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            <fieldset
              disabled={isSubmitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", isSubmitting && "pointer-events-none opacity-60")}
            >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>Customer</Label>
                <div className="mt-1.5">
                  <SearchableCombobox
                    options={customerOptions}
                    value={selectedCustomerId}
                    onChange={(val) => setSelectedCustomerId(val)}
                    placeholder="Search and select customer..."
                    searchPlaceholder="Type customer name or code..."
                    required
                  />
                </div>
              </div>

              <div>
                <Label required>Customer Construction Site</Label>
                <div className="mt-1.5">
                  <SearchableCombobox
                    options={siteOptions}
                    value={selectedSiteId}
                    onChange={(val) => setSelectedSiteId(val)}
                    placeholder={
                      !selectedCustomerId
                        ? "Select customer first..."
                        : siteOptions.length === 0
                        ? "No sites registered for customer"
                        : "Search and select construction site..."
                    }
                    searchPlaceholder="Type site name or code..."
                    disabled={!selectedCustomerId || siteOptions.length === 0}
                    required
                  />
                </div>
              </div>

              <div>
                <Label required>Effective Start Date</Label>
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
                <Label>Order / Delivery Reference (Optional)</Label>
                <Input
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  placeholder="e.g. AE/DN/2026-27/0001 or PO-4501"
                  className="mt-1.5 h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label>Security Deposit Amount (₹)</Label>
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

              <div>
                <Label>Special Contractual Notes (Optional)</Label>
                <Input
                  value={specialTerms}
                  onChange={(e) => setSpecialTerms(e.target.value)}
                  placeholder="e.g. Minimum 30 days billing commitment"
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>

            {/* Material Rates Table */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label required className="text-xs font-bold text-slate-800">
                    Agreed Material Quantities & Daily Rental Rates
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Set agreed daily rental rates (exclusive of GST) for this site contract.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Material
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-2">Material Variant</th>
                      <th className="p-2 w-28 text-right">Quantity</th>
                      <th className="p-2 w-28 text-right">Daily Rate (₹)</th>
                      <th className="p-2">Remarks</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 min-w-[200px]">
                          <SearchableCombobox
                            options={variantOptions}
                            value={item.materialVariantId}
                            onChange={(val) => handleItemChange(idx, "materialVariantId", val)}
                            placeholder="Select material variant..."
                            searchPlaceholder="Type material name or code..."
                            required
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            placeholder="100"
                            className="h-8 text-xs font-mono text-right"
                          />
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
                            className="h-8 text-xs font-mono text-right"
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

            {/* Auto WhatsApp Option */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSendWhatsApp"
                checked={autoSendWhatsApp}
                onChange={(e) => setAutoSendWhatsApp(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="autoSendWhatsApp" className="text-xs text-emerald-950 font-medium cursor-pointer">
                Automatically generate PDF & transmit agreement notification to customer registered WhatsApp number upon creation.
              </label>
            </div>
            </fieldset>

            <DialogFooter className="pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                {isSubmitting ? "Creating & Generating PDF..." : "Save & Generate Agreement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AMENDMENT MODAL */}
      <Dialog open={isAmendModalOpen} onOpenChange={setIsAmendModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Create Versioned Agreement Amendment
            </DialogTitle>
          </DialogHeader>

          {targetAgreement && (
            <form onSubmit={handleSubmitAmendment} className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{targetAgreement.agreementNumber}</span> (Current Version {targetAgreement.version}) &bull;{" "}
                  <strong>{targetAgreement.customer?.name}</strong> at <strong>{targetAgreement.customerSite?.siteName}</strong>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                  Will create Version {targetAgreement.version + 1}
                </span>
              </div>

              <div>
                <Label required>Amendment Reason / Business Justification</Label>
                <Input
                  required
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="e.g. Revised daily rate for Props from ₹1.84 to ₹2.00 as agreed; additional materials included."
                  className="mt-1.5 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label required>New Effective Date</Label>
                  <Input
                    type="date"
                    value={amendStartDate}
                    onChange={(e) => setAmendStartDate(e.target.value)}
                    required
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label>Expected End Date</Label>
                  <Input
                    type="date"
                    value={amendEndDate}
                    onChange={(e) => setAmendEndDate(e.target.value)}
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Input
                    value={amendPaymentTerms}
                    onChange={(e) => setAmendPaymentTerms(e.target.value)}
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Material Rates Table */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <Label required className="text-xs font-bold text-slate-800">
                    Amended Material Rates & Quantities
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAmendItem}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Material
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <tr>
                        <th className="p-2">Material Variant</th>
                        <th className="p-2 w-28 text-right">Quantity</th>
                        <th className="p-2 w-28 text-right">Daily Rate (₹)</th>
                        <th className="p-2">Remarks</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {amendItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 min-w-[200px]">
                            <SearchableCombobox
                              options={variantOptions}
                              value={item.materialVariantId}
                              onChange={(val) => handleAmendItemChange(idx, "materialVariantId", val)}
                              placeholder="Select material variant..."
                              searchPlaceholder="Type material name or code..."
                              required
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => handleAmendItemChange(idx, "quantity", e.target.value)}
                              className="h-8 text-xs font-mono text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.agreedDailyRate}
                              onChange={(e) =>
                                handleAmendItemChange(idx, "agreedDailyRate", e.target.value)
                              }
                              className="h-8 text-xs font-mono text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={item.remarks}
                              onChange={(e) => handleAmendItemChange(idx, "remarks", e.target.value)}
                              placeholder="Optional notes"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveAmendItem(idx)}
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
                  onClick={() => setIsAmendModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAmending}
                  className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
                >
                  {isAmending ? "Issuing Amendment..." : "Create & Issue Amendment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* WHATSAPP SHARE MODAL */}
      <Dialog open={whatsAppModalOpen} onOpenChange={setWhatsAppModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1E36] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Share Rental Agreement on WhatsApp
            </DialogTitle>
          </DialogHeader>

          {whatsAppTarget && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">
                  {whatsAppTarget.agreementNumber} (Version {whatsAppTarget.version})
                </div>
                <div className="text-slate-600">
                  Customer: <strong>{whatsAppContactName}</strong>
                </div>
                <div className="text-slate-600">
                  Site: {whatsAppTarget.customerSite?.siteName}
                </div>
              </div>

              <div>
                <Label>Recipient WhatsApp Mobile Number (10 digits)</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-lg border border-slate-200">
                    +91
                  </span>
                  <Input
                    type="tel"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9444012345"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Direct WhatsApp Web Link Fallback */}
              {whatsAppPhone.length === 10 && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    Direct Browser Link (No API required):
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    You can launch WhatsApp directly in your browser or phone with the pre-formatted agreement notification:
                  </p>
                  <a
                    href={`https://wa.me/91${whatsAppPhone}?text=${encodeURIComponent(
                      `AJAY ENTERPRISES - Centering Material Rental Agreement\n\n` +
                      `Dear ${whatsAppContactName},\n` +
                      `Formal Rental Agreement ${whatsAppTarget.agreementNumber} (Version ${whatsAppTarget.version}) for your construction site ${whatsAppTarget.customerSite?.siteName} has been generated.\n\n` +
                      `Review & Acknowledge Online:\n` +
                      `${typeof window !== "undefined" ? window.location.origin : "https://ajay-enterprises-gwen-tech.vercel.app"}/rentals/agreements/${whatsAppTarget.id}/acknowledge?token=${whatsAppTarget.acknowledgementToken}\n\n` +
                      `Official Printable Document Slip:\n` +
                      `${typeof window !== "undefined" ? window.location.origin : "https://ajay-enterprises-gwen-tech.vercel.app"}/api/v1/rentals/agreements/${whatsAppTarget.id}/print\n\n` +
                      `Thank you for choosing AJAY ENTERPRISES!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Open in WhatsApp Web
                  </a>
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWhatsAppModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleSendWhatsAppNotification}
                  disabled={isSendingWhatsApp || whatsAppPhone.length < 10}
                  className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
                >
                  {isSendingWhatsApp ? "Dispatching..." : "Send via INVENTRA API"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CONFIRM MODAL */}
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
