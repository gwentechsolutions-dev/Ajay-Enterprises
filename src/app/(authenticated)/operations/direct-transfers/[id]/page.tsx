"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Printer,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building,
  User,
  MapPin,
  Camera,
  FileCheck,
  Send,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { toast } from "sonner";

export default function DirectTransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [transfer, setTransfer] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Manual entry toggle
  const [isManualRepInput, setIsManualRepInput] = React.useState(false);
  const [isManualDestRepInput, setIsManualDestRepInput] = React.useState(false);

  // Dispatch Form
  const [dispatchForm, setDispatchForm] = React.useState({
    sourceRepName: "",
    sourceRepPhone: "",
    sourceRepDesignation: "Site Engineer",
    sourceRepSignatureUrl: "",
    sourceGpsLat: "12.9716000",
    sourceGpsLng: "77.5946000",
    sourcePhotoUrl: "",
    notes: "",
  });

  // Receive Form
  const [receiveForm, setReceiveForm] = React.useState({
    destRepName: "",
    destRepPhone: "",
    destRepDesignation: "Project Manager",
    destRepSignatureUrl: "",
    destGpsLat: "12.9720000",
    destGpsLng: "77.5950000",
    destPhotoUrl: "",
    discrepancyNotes: "",
    items: [] as Array<{
      itemId: string;
      materialName: string;
      dispatchedQty: number;
      quantityAccepted: string;
      quantityDamaged: string;
      quantityMissing: string;
      quantityRejected: string;
      remarks: string;
    }>,
  });

  const [cancelReason, setCancelReason] = React.useState("");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTransfer(json.data);

        // Prepopulate receive items
        setReceiveForm((prev) => ({
          ...prev,
          items: (json.data.items || []).map((item: any) => ({
            itemId: item.id,
            materialName: item.materialVariant?.name || "Material",
            dispatchedQty: parseFloat(item.quantityDispatched),
            quantityAccepted: parseFloat(item.quantityDispatched).toString(),
            quantityDamaged: "0",
            quantityMissing: "0",
            quantityRejected: "0",
            remarks: "",
          })),
        }));
      } else {
        toast.error(json.error?.message || "Failed to load transfer note");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  const sourceRepCandidates: any[] = React.useMemo(() => {
    return transfer?.sourceRepCandidates || [];
  }, [transfer]);

  const sourceRepOptions: ComboboxOption[] = React.useMemo(() => {
    return sourceRepCandidates.map((c: any) => ({
      value: c.name,
      label: c.name,
      sublabel: `${c.designation || "Site Representative"}${c.phone ? ` • 📞 ${c.phone}` : ""}`,
      badge: c.badge || "CONTACT",
    }));
  }, [sourceRepCandidates]);

  const destRepCandidates: any[] = React.useMemo(() => {
    return transfer?.destRepCandidates || [];
  }, [transfer]);

  const destRepOptions: ComboboxOption[] = React.useMemo(() => {
    return destRepCandidates.map((c: any) => ({
      value: c.name,
      label: c.name,
      sublabel: `${c.designation || "Site Receiver"}${c.phone ? ` • 📞 ${c.phone}` : ""}`,
      badge: c.badge || "CONTACT",
    }));
  }, [destRepCandidates]);

  const handleSelectSourceRep = (val: string) => {
    const matched = sourceRepCandidates.find(
      (c: any) => c.name.toLowerCase().trim() === val.toLowerCase().trim()
    );

    if (matched) {
      setDispatchForm((prev) => ({
        ...prev,
        sourceRepName: matched.name,
        sourceRepPhone: matched.phone || prev.sourceRepPhone,
        sourceRepDesignation: matched.designation || prev.sourceRepDesignation,
      }));
    } else {
      setDispatchForm((prev) => ({
        ...prev,
        sourceRepName: val,
      }));
    }
  };

  const handleSelectDestRep = (val: string) => {
    const matched = destRepCandidates.find(
      (c: any) => c.name.toLowerCase().trim() === val.toLowerCase().trim()
    );

    if (matched) {
      setReceiveForm((prev) => ({
        ...prev,
        destRepName: matched.name,
        destRepPhone: matched.phone || prev.destRepPhone,
        destRepDesignation: matched.designation || prev.destRepDesignation,
      }));
    } else {
      setReceiveForm((prev) => ({
        ...prev,
        destRepName: val,
      }));
    }
  };

  const openDispatchModal = () => {
    const matched = sourceRepCandidates[0] || null;

    setDispatchForm((prev) => ({
      ...prev,
      sourceRepName: prev.sourceRepName || matched?.name || transfer?.sourceCustomerSite?.siteInCharge || "",
      sourceRepPhone: prev.sourceRepPhone || matched?.phone || transfer?.sourceCustomerSite?.siteContactDetails || "",
      sourceRepDesignation: prev.sourceRepDesignation || matched?.designation || "Site In-Charge",
      sourceGpsLat: transfer?.sourceCustomerSite?.gpsLatitude
        ? transfer.sourceCustomerSite.gpsLatitude.toString()
        : prev.sourceGpsLat,
      sourceGpsLng: transfer?.sourceCustomerSite?.gpsLongitude
        ? transfer.sourceCustomerSite.gpsLongitude.toString()
        : prev.sourceGpsLng,
    }));

    setIsManualRepInput(false);
    setIsDispatchModalOpen(true);

    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDispatchForm((prev) => ({
            ...prev,
            sourceGpsLat: pos.coords.latitude.toFixed(7),
            sourceGpsLng: pos.coords.longitude.toFixed(7),
          }));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const openReceiveModal = () => {
    const matched = destRepCandidates[0] || null;

    setReceiveForm((prev) => ({
      ...prev,
      destRepName: prev.destRepName || matched?.name || transfer?.destinationCustomerSite?.siteInCharge || "",
      destRepPhone: prev.destRepPhone || matched?.phone || transfer?.destinationCustomerSite?.siteContactDetails || "",
      destRepDesignation: prev.destRepDesignation || matched?.designation || "Site Engineer",
      destGpsLat: transfer?.destinationCustomerSite?.gpsLatitude
        ? transfer.destinationCustomerSite.gpsLatitude.toString()
        : prev.destGpsLat,
      destGpsLng: transfer?.destinationCustomerSite?.gpsLongitude
        ? transfer.destinationCustomerSite.gpsLongitude.toString()
        : prev.destGpsLng,
    }));

    setIsManualDestRepInput(false);
    setIsReceiveModalOpen(true);

    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setReceiveForm((prev) => ({
            ...prev,
            destGpsLat: pos.coords.latitude.toFixed(7),
            destGpsLng: pos.coords.longitude.toFixed(7),
          }));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchForm.sourceRepName) {
      toast.error("Please enter source representative name");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceRepName: dispatchForm.sourceRepName,
          sourceRepPhone: dispatchForm.sourceRepPhone || undefined,
          sourceRepDesignation: dispatchForm.sourceRepDesignation || undefined,
          sourceRepSignatureUrl: dispatchForm.sourceRepSignatureUrl || undefined,
          sourceGpsLat: dispatchForm.sourceGpsLat ? parseFloat(dispatchForm.sourceGpsLat) : undefined,
          sourceGpsLng: dispatchForm.sourceGpsLng ? parseFloat(dispatchForm.sourceGpsLng) : undefined,
          sourcePhotoUrl: dispatchForm.sourcePhotoUrl || undefined,
          notes: dispatchForm.notes || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Direct Site Transfer dispatched successfully!");
        setIsDispatchModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Dispatch failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.destRepName) {
      toast.error("Please enter destination receiver name");
      return;
    }

    // Verify reconciliation totals
    for (const item of receiveForm.items) {
      const acc = parseFloat(item.quantityAccepted || "0");
      const dam = parseFloat(item.quantityDamaged || "0");
      const mis = parseFloat(item.quantityMissing || "0");
      const rej = parseFloat(item.quantityRejected || "0");
      const total = acc + dam + mis + rej;

      if (Math.abs(total - item.dispatchedQty) > 0.001) {
        toast.error(
          `Reconciliation mismatch for ${item.materialName}: Dispatched (${item.dispatchedQty}) ≠ Sum (${total})`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destRepName: receiveForm.destRepName,
          destRepPhone: receiveForm.destRepPhone || undefined,
          destRepDesignation: receiveForm.destRepDesignation || undefined,
          destRepSignatureUrl: receiveForm.destRepSignatureUrl || undefined,
          destGpsLat: receiveForm.destGpsLat ? parseFloat(receiveForm.destGpsLat) : undefined,
          destGpsLng: receiveForm.destGpsLng ? parseFloat(receiveForm.destGpsLng) : undefined,
          destPhotoUrl: receiveForm.destPhotoUrl || undefined,
          discrepancyNotes: receiveForm.discrepancyNotes || undefined,
          items: receiveForm.items.map((i) => ({
            itemId: i.itemId,
            quantityAccepted: parseFloat(i.quantityAccepted || "0"),
            quantityDamaged: parseFloat(i.quantityDamaged || "0"),
            quantityMissing: parseFloat(i.quantityMissing || "0"),
            quantityRejected: parseFloat(i.quantityRejected || "0"),
            remarks: i.remarks || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Transfer received and custody updated successfully!");
        setIsReceiveModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Receipt reconciliation failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", reason: cancelReason }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Direct Site Transfer cancelled");
        setIsCancelModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Cancellation failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
        Loading transfer note details...
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="py-24 text-center text-slate-500">
        <XCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
        Transfer note not found.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">Completed</Badge>;
      case "PARTIALLY_RECEIVED":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">Partial Discrepancy</Badge>;
      case "DISPATCHED":
      case "IN_TRANSIT":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-medium">In Transit</Badge>;
      case "DRAFT":
        return <Badge variant="outline" className="text-slate-600 font-medium">Draft</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive" className="font-medium">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/operations/direct-transfers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Register
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono tracking-tight text-slate-900">
                {transfer.transferNumber}
              </h1>
              {getStatusBadge(transfer.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              AJAY ENTERPRISES Direct Site Transfer Note • Created on{" "}
              {new Date(transfer.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={`/api/v1/direct-transfers/${transfer.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              title="Print Official Direct Site Transfer Note (DSTN)"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Note / PDF
            </a>
          </Button>

          {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(transfer.status) && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => setIsCancelModalOpen(true)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={openDispatchModal}
              >
                <Send className="h-4 w-4 mr-2" />
                Dispatch Transfer
              </Button>
            </>
          )}

          {["DISPATCHED", "IN_TRANSIT"].includes(transfer.status) && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={openReceiveModal}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Receive & Reconcile
            </Button>
          )}
        </div>
      </div>

      {/* Sites & Logistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Site */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600" />
              Source Construction Site (Released From)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Customer A</span>
              <span className="font-semibold text-slate-900">{transfer.sourceCustomer?.name}</span>
              <span className="text-xs text-slate-500 ml-2 font-mono">
                ({transfer.sourceCustomer?.customerCode})
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Site Location</span>
              <span className="font-medium text-slate-800">{transfer.sourceCustomerSite?.siteName}</span>
              <p className="text-xs text-slate-500 mt-0.5">{transfer.sourceCustomerSite?.address}</p>
            </div>
          </CardContent>
        </Card>

        {/* Destination Site */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Building className="h-4 w-4 text-[#F26522]" />
              Destination Construction Site (Delivered To)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Customer B</span>
              <span className="font-semibold text-slate-900">{transfer.destinationCustomer?.name}</span>
              <span className="text-xs text-slate-500 ml-2 font-mono">
                ({transfer.destinationCustomer?.customerCode})
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Site Location</span>
              <span className="font-medium text-slate-800">{transfer.destinationCustomerSite?.siteName}</span>
              <p className="text-xs text-slate-500 mt-0.5">{transfer.destinationCustomerSite?.address}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logistics & Rental Billing Rules */}
      <Card className="border-slate-200">
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block">Transfer Date</span>
            <span className="font-semibold text-slate-900 text-sm">
              {new Date(transfer.transferDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Company Vehicle</span>
            <span className="font-semibold text-slate-900 text-sm">
              {transfer.vehicle?.vehicleNumber || "Company Fleet"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Assigned Driver</span>
            <span className="font-semibold text-slate-900 text-sm">
              {transfer.driver?.name || "Driver"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Transport Charges</span>
            <span className="font-semibold text-slate-900 text-sm">
              ₹{parseFloat(transfer.transportCharges || "0").toFixed(2)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">Rental Cutoff Rule: </span>
              {transfer.includeCutoffDate ? (
                <span className="text-blue-700">
                  Cutoff date included for Customer A (Customer A pays on transfer day; Customer B billing starts next day).
                </span>
              ) : (
                <span className="text-emerald-700">
                  Cutoff date excluded for Customer A (Customer A stops billing day before; Customer B billing starts on transfer day).
                </span>
              )}
            </div>
            <Badge variant="outline" className="font-mono text-emerald-700 border-emerald-300">
              Zero Overlap Verified
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Material Line Items Table */}
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Equipment Items & Quantity Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Material Variant</th>
                  <th className="py-2.5 px-4">Ownership</th>
                  <th className="py-2.5 px-4 text-right">Dispatched</th>
                  <th className="py-2.5 px-4 text-right">Accepted</th>
                  <th className="py-2.5 px-4 text-right">Damaged</th>
                  <th className="py-2.5 px-4 text-right">Missing</th>
                  <th className="py-2.5 px-4 text-right">Rejected</th>
                  <th className="py-2.5 px-4 text-right">Daily Rate (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfer.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.materialVariant?.name}
                      <span className="text-xs text-slate-400 ml-1.5">({item.materialVariant?.uom})</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.ownershipType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {parseFloat(item.quantityDispatched)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">
                      {parseFloat(item.quantityAccepted || "0")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600">
                      {parseFloat(item.quantityDamaged || "0")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600">
                      {parseFloat(item.quantityMissing || "0")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {parseFloat(item.quantityRejected || "0")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ₹{parseFloat(item.agreedDailyRate || "0").toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Evidence & Site Acknowledgment Proof */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Site Evidence */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-blue-600" />
              Source Site Dispatch Acknowledgment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            {transfer.dispatchedAt ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Representative:</span>
                  <span className="font-medium text-slate-900">
                    {transfer.sourceRepName} ({transfer.sourceRepDesignation || "Rep"})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-slate-700">{transfer.sourceRepPhone || "Not provided"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dispatched At:</span>
                  <span className="text-slate-700">
                    {new Date(transfer.dispatchedAt).toLocaleString()}
                  </span>
                </div>
                {transfer.sourceGpsLat && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">GPS Coordinates:</span>
                    <span className="font-mono text-blue-600">
                      {parseFloat(transfer.sourceGpsLat).toFixed(6)}, {parseFloat(transfer.sourceGpsLng).toFixed(6)}
                    </span>
                  </div>
                )}
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified Source Release
                </Badge>
              </>
            ) : (
              <p className="text-slate-400 py-4 text-center">Dispatch acknowledgment pending.</p>
            )}
          </CardContent>
        </Card>

        {/* Destination Site Evidence */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Destination Site Custody Acceptance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            {transfer.receivedAt ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Receiver:</span>
                  <span className="font-medium text-slate-900">
                    {transfer.destRepName} ({transfer.destRepDesignation || "Rep"})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-slate-700">{transfer.destRepPhone || "Not provided"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Received At:</span>
                  <span className="text-slate-700">
                    {new Date(transfer.receivedAt).toLocaleString()}
                  </span>
                </div>
                {transfer.destGpsLat && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">GPS Coordinates:</span>
                    <span className="font-mono text-emerald-600">
                      {parseFloat(transfer.destGpsLat).toFixed(6)}, {parseFloat(transfer.destGpsLng).toFixed(6)}
                    </span>
                  </div>
                )}
                {transfer.discrepancyNotes && (
                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-800">
                    <span className="font-semibold block">Discrepancy Notes:</span>
                    {transfer.discrepancyNotes}
                  </div>
                )}
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Custody Transferred to Customer B
                </Badge>
              </>
            ) : (
              <p className="text-slate-400 py-4 text-center">Destination site receipt pending.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispatch Modal */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Dispatch Material from Source Site
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record source representative acknowledgment and GPS point-of-release.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDispatch} className="space-y-4">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-medium">Source Rep Name *</Label>
                <button
                  type="button"
                  onClick={() => setIsManualRepInput(!isManualRepInput)}
                  className="text-[11px] text-[#F26522] hover:underline font-semibold cursor-pointer"
                >
                  {isManualRepInput ? "← Select from contacts" : "+ Enter custom name"}
                </button>
              </div>

              {isManualRepInput ? (
                <Input
                  placeholder="Enter representative name manually..."
                  value={dispatchForm.sourceRepName}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sourceRepName: e.target.value })}
                  className="mt-1"
                  autoFocus
                  required
                />
              ) : (
                <SearchableCombobox
                  options={sourceRepOptions}
                  value={dispatchForm.sourceRepName}
                  onChange={handleSelectSourceRep}
                  placeholder={
                    sourceRepOptions.length > 0
                      ? "Select site representative or type name..."
                      : "Type representative name..."
                  }
                  searchPlaceholder="Search site contacts or type new name..."
                  emptyText="No contacts found. Press Enter or click below to use as custom name."
                  allowCustomValue={true}
                  customBadge="MANUAL"
                  className="mt-1"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  placeholder="9876543210"
                  value={dispatchForm.sourceRepPhone}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sourceRepPhone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Designation</Label>
                <Input
                  placeholder="Site Supervisor"
                  value={dispatchForm.sourceRepDesignation}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sourceRepDesignation: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">GPS Latitude</Label>
                <Input
                  value={dispatchForm.sourceGpsLat}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sourceGpsLat: e.target.value })}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">GPS Longitude</Label>
                <Input
                  value={dispatchForm.sourceGpsLng}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sourceGpsLng: e.target.value })}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Dispatch Remarks</Label>
              <Input
                placeholder="Inspected and loaded onto vehicle"
                value={dispatchForm.notes}
                onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
            </fieldset>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDispatchModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-blue-600 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Confirm Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Destination Receipt & Quantity Reconciliation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verify received equipment quantities at Customer B site. Dispatched must equal Accepted + Damaged + Missing + Rejected.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            {/* Receiver Contact Information */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-medium">Receiver Name *</Label>
                <button
                  type="button"
                  onClick={() => setIsManualDestRepInput(!isManualDestRepInput)}
                  className="text-[11px] text-[#F26522] hover:underline font-semibold cursor-pointer"
                >
                  {isManualDestRepInput ? "← Select from contacts" : "+ Enter custom name"}
                </button>
              </div>

              {isManualDestRepInput ? (
                <Input
                  placeholder="Enter receiver name manually..."
                  value={receiveForm.destRepName}
                  onChange={(e) => setReceiveForm({ ...receiveForm, destRepName: e.target.value })}
                  className="mt-1"
                  autoFocus
                  required
                />
              ) : (
                <SearchableCombobox
                  options={destRepOptions}
                  value={receiveForm.destRepName}
                  onChange={handleSelectDestRep}
                  placeholder={
                    destRepOptions.length > 0
                      ? "Select destination site receiver or type name..."
                      : "Type receiver name..."
                  }
                  searchPlaceholder="Search receiver contacts or type new name..."
                  emptyText="No contacts found. Press Enter or click below to use as custom name."
                  allowCustomValue={true}
                  customBadge="MANUAL"
                  className="mt-1"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  placeholder="9876543210"
                  value={receiveForm.destRepPhone}
                  onChange={(e) => setReceiveForm({ ...receiveForm, destRepPhone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Designation</Label>
                <Input
                  placeholder="Site In-Charge / Receiver"
                  value={receiveForm.destRepDesignation}
                  onChange={(e) => setReceiveForm({ ...receiveForm, destRepDesignation: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="text-xs font-semibold text-slate-800">Item Quantity Reconciliation</div>
              {receiveForm.items.map((item, idx) => (
                <div key={item.itemId} className="p-2.5 bg-slate-50 rounded border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-900">{item.materialName}</span>
                    <Badge variant="outline" className="font-mono">
                      Dispatched: {item.dispatchedQty}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px] text-emerald-700">Accepted *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantityAccepted}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReceiveForm((prev) => {
                            const copy = [...prev.items];
                            copy[idx].quantityAccepted = val;
                            return { ...prev, items: copy };
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-amber-700">Damaged</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantityDamaged}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReceiveForm((prev) => {
                            const copy = [...prev.items];
                            copy[idx].quantityDamaged = val;
                            return { ...prev, items: copy };
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-rose-700">Missing</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantityMissing}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReceiveForm((prev) => {
                            const copy = [...prev.items];
                            copy[idx].quantityMissing = val;
                            return { ...prev, items: copy };
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">Rejected</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantityRejected}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReceiveForm((prev) => {
                            const copy = [...prev.items];
                            copy[idx].quantityRejected = val;
                            return { ...prev, items: copy };
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-medium">Discrepancy Notes</Label>
              <Input
                placeholder="Notes if accepted quantity differs from dispatched..."
                value={receiveForm.discrepancyNotes}
                onChange={(e) => setReceiveForm({ ...receiveForm, discrepancyNotes: e.target.value })}
                className="mt-1"
              />
            </div>
            </fieldset>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReceiveModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-emerald-600 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirm Receipt & Transfer Custody
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Cancel Transfer Note</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to cancel this transfer? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs font-medium">Reason for Cancellation</Label>
            <Input
              placeholder="E.g. Site schedule delayed..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>
              Keep Transfer
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={submitting}
              onClick={handleCancel}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
