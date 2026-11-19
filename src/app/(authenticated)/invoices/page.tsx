"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ReceiptIndianRupee,
  ArrowRight,
  Filter,
  Truck,
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
import { TableSkeleton } from "@/components/ui/loading-states";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { fetchWithClientCache, invalidateClientCache } from "@/lib/client-cache";

export default function InvoicesPage() {
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  // Convert Statement Modal
  const [isStatementModalOpen, setIsStatementModalOpen] = React.useState(false);
  const [selectedStatementId, setSelectedStatementId] = React.useState("");
  const [invDate, setInvDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [invNotes, setInvNotes] = React.useState("");
  const [transportCharges, setTransportCharges] = React.useState("");
  const [transportDescription, setTransportDescription] = React.useState("");
  const [unbilledDns, setUnbilledDns] = React.useState<any[]>([]);
  const [loadingUnbilledDns, setLoadingUnbilledDns] = React.useState(false);
  const [userEditedTransport, setUserEditedTransport] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // View Invoice Detail Modal
  const [activeInvoice, setActiveInvoice] = React.useState<any | null>(null);

  // Auto-detect unbilled delivery notes with transport charges for selected statement
  React.useEffect(() => {
    if (!selectedStatementId) {
      setTransportCharges("");
      setTransportDescription("");
      setUnbilledDns([]);
      setUserEditedTransport(false);
      return;
    }

    const st = statements.find((s) => s.id === selectedStatementId);
    if (!st || !st.customerId) {
      setUnbilledDns([]);
      return;
    }

    let isMounted = true;
    setLoadingUnbilledDns(true);

    const queryUrl = `/api/v1/delivery-notes?customerId=${st.customerId}${
      st.customerSiteId ? `&customerSiteId=${st.customerSiteId}` : ""
    }`;

    fetch(queryUrl)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted || !json.success || !Array.isArray(json.data)) return;

        // Filter unbilled delivery notes with transport charges > 0 delivered on or before statement period end
        const periodEnd = st.periodEndDate ? new Date(st.periodEndDate) : null;
        const matchingDns = json.data.filter((dn: any) => {
          if (dn.isTransportBilled) return false;
          const charges = Number(dn.transportCharges || 0);
          if (charges <= 0) return false;
          if (periodEnd && dn.deliveryDate) {
            return new Date(dn.deliveryDate) <= periodEnd;
          }
          return true;
        });

        setUnbilledDns(matchingDns);

        const totalUnbilledTransport = matchingDns.reduce(
          (sum: number, dn: any) => sum + Number(dn.transportCharges || 0),
          0
        );

        if (!userEditedTransport) {
          if (totalUnbilledTransport > 0) {
            setTransportCharges(totalUnbilledTransport.toString());
            setTransportDescription(
              `Transportation & Delivery Freight Charges to Site (${matchingDns.map((d: any) => d.dnNumber).join(", ")})`
            );
          } else {
            setTransportCharges("");
            setTransportDescription("");
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching unbilled delivery notes for statement:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingUnbilledDns(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStatementId, statements, userEditedTransport]);

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [invData, stmtData] = await Promise.all([
        fetchWithClientCache("/api/v1/invoices", {
          forceRefresh,
          onBackgroundUpdate: (fresh) => {
            if (fresh) setInvoices(fresh);
          },
        }),
        fetchWithClientCache("/api/v1/rentals/statements?status=APPROVED,FINALIZED", {
          forceRefresh,
          onBackgroundUpdate: (fresh) => {
            if (fresh) setStatements(fresh);
          },
        }),
      ]);

      if (invData) setInvoices(invData);
      if (stmtData) setStatements(stmtData);
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stmtId = params.get("statementId");
      if (stmtId) {
        setSelectedStatementId(stmtId);
        setIsStatementModalOpen(true);
      }
    }
  }, []);

  const selectedStatement = React.useMemo(() => {
    return statements.find((st) => st.id === selectedStatementId) || null;
  }, [statements, selectedStatementId]);

  const statementOptions = React.useMemo<ComboboxOption[]>(() => {
    return statements.map((st) => {
      const isAlreadyInvoiced = st.invoices?.some((inv: any) => inv.status !== "CANCELLED");
      const invoiceNo = isAlreadyInvoiced
        ? st.invoices?.find((inv: any) => inv.status !== "CANCELLED")?.invoiceNumber
        : null;
      const amountStr = Number(st.netPayableAmount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return {
        value: st.id,
        label: `${st.statementNumber} — ${st.customer?.name || "Customer"} (₹${amountStr})`,
        sublabel: isAlreadyInvoiced
          ? `Already Invoiced (${invoiceNo})`
          : `${st.billingMode === "SITE_WISE" ? st.customerSite?.siteName || "Site" : "Consolidated"} • ${st.status}`,
        badge: isAlreadyInvoiced ? "INVOICED" : st.status,
        disabled: isAlreadyInvoiced,
      };
    });
  }, [statements]);

  const handleConvertStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatementId) {
      setErrorMsg("Please select an approved statement");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/invoices/from-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: selectedStatementId,
          invoiceDate: invDate,
          dueDate,
          notes: invNotes || undefined,
          transportCharges: transportCharges ? parseFloat(transportCharges) : undefined,
          transportDescription: transportDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to generate invoice");
      }
      setIsStatementModalOpen(false);
      setSelectedStatementId("");
      setTransportCharges("");
      setTransportDescription("");
      setUnbilledDns([]);
      setUserEditedTransport(false);
      invalidateClientCache("/api/v1/invoices");
      invalidateClientCache("/api/v1/rentals/statements");
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || inv.paymentStatus === statusFilter;
    const matchesType = typeFilter === "ALL" || inv.invoiceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate totals
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.grandTotal ?? i.totalAmount ?? 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount ?? 0), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + Number(i.outstandingAmount ?? i.balanceAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Tax Invoices</h1>
          <p className="text-sm text-slate-500">
            GST-compliant sales and monthly rental invoices with automated double-entry ledger posting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setErrorMsg(null);
              setIsStatementModalOpen(true);
            }}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white"
          >
            <ReceiptIndianRupee className="w-4 h-4 mr-2" />
            Convert Statement to Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Invoices</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">{invoices.length}</div>
          <div className="text-xs text-slate-500 mt-1">Generated tax invoices</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Billed</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">
            ₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Gross revenue invoiced</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Customer receipts applied</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Outstanding Balance</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Accounts receivable balance</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by invoice number, customer name, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Invoice Types</option>
              <option value="RENTAL">Rental Invoice</option>
              <option value="SALES">Sales Invoice</option>
              <option value="SERVICE">Service Invoice</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[950px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Invoice #</th>
                <th className="px-4 py-3 whitespace-nowrap">Customer & Site</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Due Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Taxable</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">GST</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total Amount</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={10} rows={5} />
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No tax invoices found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#0B1E36]">
                      {inv.invoiceNumber}
                      {inv.rentalStatement && (
                        <span className="block text-[11px] font-normal text-sky-600">
                          Ref: {inv.rentalStatement.statementNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{inv.customer?.name}</div>
                      <div className="text-xs text-slate-500">
                        {inv.customerSite?.siteName || "Consolidated / Multiple Sites"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {inv.invoiceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      ₹{Number(inv.taxableAmount ?? inv.subtotal ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      <div>₹{Number(inv.totalTaxAmount ?? inv.totalTax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-slate-400">
                        {inv.isInterState ? "IGST" : "CGST+SGST"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B1E36]">
                      ₹{Number(inv.grandTotal ?? inv.totalAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          inv.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.paymentStatus === "PARTIALLY_PAID"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <WhatsAppShareButton doc={inv} docType="INVOICE" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/api/v1/invoices/${inv.id}/print`, "_blank")}
                          title="Print A4 Tax Invoice"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-[#F26522]"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveInvoice(inv)}
                          className="h-8 px-2 text-xs text-[#0B1E36] hover:bg-slate-100"
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert Statement to Invoice Modal */}
      <Dialog open={isStatementModalOpen} onOpenChange={setIsStatementModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Convert Rental Statement to Tax Invoice
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConvertStatement} className="space-y-4">
            <fieldset
              disabled={isSubmitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", isSubmitting && "pointer-events-none opacity-60")}
            >
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">
                Select Approved Statement *
              </Label>
              <div className="mt-1">
                <SearchableCombobox
                  options={statementOptions}
                  value={selectedStatementId}
                  onChange={(val) => setSelectedStatementId(val)}
                  placeholder="-- Choose Approved Statement --"
                  searchPlaceholder="Search statement # or customer..."
                  emptyText="No approved or finalized statements found."
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Only statements in APPROVED or FINALIZED status can be invoiced.
              </p>

              {selectedStatement && (
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-semibold text-slate-800">{selectedStatement.customer?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Construction Site:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStatement.customerSite?.siteName || "Consolidated (All Sites)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Billing Period:</span>
                    <span className="text-slate-700 font-mono">
                      {new Date(selectedStatement.periodStartDate).toLocaleDateString("en-IN")} to{" "}
                      {new Date(selectedStatement.periodEndDate).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-700 font-bold">Net Rental Payable:</span>
                    <span className="font-bold font-mono text-emerald-600 text-sm">
                      ₹{Number(selectedStatement.netPayableAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Invoice Date *</Label>
                <Input
                  type="date"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Due Date *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            {/* Optional Transportation / Freight Charges Section */}
            <div className="p-3 bg-orange-50/40 border border-orange-200/70 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-[#F26522]" />
                  Transportation / Freight Charges (₹) (Optional)
                </Label>
                {unbilledDns.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white text-orange-700 border border-orange-200 font-semibold shadow-2xs">
                    {unbilledDns.length} unbilled delivery trip{unbilledDns.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={transportCharges}
                    onChange={(e) => {
                      setTransportCharges(e.target.value);
                      setUserEditedTransport(true);
                    }}
                    className="bg-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    One-time freight charge on this tax invoice (does not carry forward to monthly statements).
                  </span>
                </div>

                <div>
                  <Input
                    placeholder="Freight description (optional)"
                    value={transportDescription}
                    onChange={(e) => setTransportDescription(e.target.value)}
                    className="bg-white text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Tariff SAC: 9965 (Goods Transport Agency)
                  </span>
                </div>
              </div>

              {unbilledDns.length > 0 && (
                <div className="text-[11px] text-slate-600 bg-white/90 p-2 rounded border border-orange-100 flex items-center justify-between mt-1">
                  <span>
                    Auto-detected{" "}
                    <strong>
                      ₹
                      {unbilledDns
                        .reduce((sum, d) => sum + Number(d.transportCharges || 0), 0)
                        .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>{" "}
                    from {unbilledDns.length} unbilled delivery note(s):{" "}
                    <span className="font-mono text-slate-500">{unbilledDns.map((d) => d.dnNumber).join(", ")}</span>
                  </span>
                  {!userEditedTransport && (
                    <span className="text-[10px] text-emerald-600 font-semibold shrink-0 ml-2">Pre-filled</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Invoice Notes / Remarks</Label>
              <Input
                placeholder="Optional notes to appear on invoice..."
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-md text-xs text-slate-600 border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-700">Automated Accounting & Tax Posting:</div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>Generates sequential tax invoice number (INV-YYYY-NNNN).</li>
                <li>Calculates CGST/SGST (intra-state) or IGST (inter-state) with paise round-off.</li>
                <li>Posts General Ledger journal: Debits Accounts Receivable (1030), Credits Rental Income (4010), Credits Transportation Income (4050/4030 if freight charged), Credits GST Output Liability (2041/2042/2043).</li>
                <li>Freezes finalized snapshot payload ensuring immutable financial records.</li>
              </ul>
            </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStatementModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingText="Generating Tax Invoice..."
                className="bg-[#F26522] hover:bg-[#EA580C] text-white"
              >
                Generate Tax Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail View Modal */}
      {activeInvoice && (
        <Dialog open={!!activeInvoice} onOpenChange={() => setActiveInvoice(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold text-[#0B1E36]">
                  Invoice {activeInvoice.invoiceNumber}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <WhatsAppShareButton doc={activeInvoice} docType="INVOICE" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/api/v1/invoices/${activeInvoice.id}/print`, "_blank")}
                    className="text-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    Print A4
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Customer:</span>
                  <span className="font-semibold text-slate-800">{activeInvoice.customer?.name}</span>
                  <span className="block text-slate-500 mt-1">GSTIN: {activeInvoice.customerGstin || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Site / Destination:</span>
                  <span className="font-semibold text-slate-800">
                    {activeInvoice.customerSite?.siteName || "Consolidated / Multiple Sites"}
                  </span>
                  <span className="block text-slate-500 mt-1">
                    Place of Supply: State {activeInvoice.placeOfSupply} ({activeInvoice.isInterState ? "Inter-State" : "Intra-State"})
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2 text-center">HSN/SAC</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeInvoice.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{item.itemDescription}</td>
                        <td className="p-2 text-center text-slate-500">{item.hsnSacCode}</td>
                        <td className="p-2 text-right">{Number(item.quantity).toFixed(2)} {item.uom}</td>
                        <td className="p-2 text-right">₹{Number(item.unitRate).toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">₹{Number(item.taxableValue).toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">₹{Number(item.totalAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-right">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxable Subtotal:</span>
                  <span className="font-semibold">₹{Number(activeInvoice.taxableAmount ?? activeInvoice.subtotal ?? 0).toFixed(2)}</span>
                </div>
                {Number(activeInvoice.cgstAmount ?? activeInvoice.totalCgst ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (9%):</span>
                    <span>₹{Number(activeInvoice.cgstAmount ?? activeInvoice.totalCgst ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.sgstAmount ?? activeInvoice.totalSgst ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (9%):</span>
                    <span>₹{Number(activeInvoice.sgstAmount ?? activeInvoice.totalSgst ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.igstAmount ?? activeInvoice.totalIgst ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST (18%):</span>
                    <span>₹{Number(activeInvoice.igstAmount ?? activeInvoice.totalIgst ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.roundOff ?? activeInvoice.roundOffAmount ?? 0) !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span>₹{Number(activeInvoice.roundOff ?? activeInvoice.roundOffAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-[#0B1E36]">
                  <span>Grand Total:</span>
                  <span>₹{Number(activeInvoice.grandTotal ?? activeInvoice.totalAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Amount Paid:</span>
                  <span>₹{Number(activeInvoice.paidAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-600 font-bold">
                  <span>Balance Due:</span>
                  <span>₹{Number(activeInvoice.outstandingAmount ?? activeInvoice.balanceAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveInvoice(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

