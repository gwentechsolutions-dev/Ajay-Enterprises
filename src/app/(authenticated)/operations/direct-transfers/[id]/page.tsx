"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
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
  ExternalLink,
  ShieldCheck,
  Warehouse,
  Boxes,
  HelpCircle,
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
import { GpsCameraCaptureDialog } from "@/components/evidence/GpsCameraCaptureDialog";
import { GoogleMapsLocationInput } from "@/components/forms/google-maps-location-input";

export default function DirectTransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [transfer, setTransfer] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = React.useState(false);
  const [isGodownModalOpen, setIsGodownModalOpen] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [isGpsCameraOpen, setIsGpsCameraOpen] = React.useState(false);
  const [cameraCategory, setCameraCategory] = React.useState<"SOURCE_PICKUP" | "DESTINATION_UNLOAD">("SOURCE_PICKUP");

  // Manual entry toggle
  const [isManualRepInput, setIsManualRepInput] = React.useState(false);
  const [isManualDestRepInput, setIsManualDestRepInput] = React.useState(false);

  // Dispatch / Pickup Form
  const [dispatchForm, setDispatchForm] = React.useState({
    sourceRepName: "",
    sourceRepPhone: "",
    sourceRepDesignation: "Site Engineer",
    sourceRepSignatureUrl: "",
    sourceGpsLat: "13.0827000",
    sourceGpsLng: "80.2707000",
    sourceMapsUrl: "",
    sourcePhotoUrl: "",
    odometerReading: "",
    notes: "",
    items: [] as Array<{
      itemId: string;
      materialName: string;
      dispatchedQty: number;
      quantityCollected: string;
      remarks: string;
    }>,
  });

  // Receive Form
  const [receiveForm, setReceiveForm] = React.useState({
    destRepName: "",
    destRepPhone: "",
    destRepDesignation: "Site In-Charge",
    destRepSignatureUrl: "",
    destGpsLat: "13.0827000",
    destGpsLng: "80.2707000",
    destPhotoUrl: "",
    discrepancyNotes: "",
    discrepancyResponsibleParty: "UNDER_INVESTIGATION",
    rejectedDisposition: "RETURN_TO_WAREHOUSE",
    items: [] as Array<{
      itemId: string;
      materialName: string;
      baseQty: number;
      quantityAccepted: string;
      quantityGodownReturned: string;
      quantityDamaged: string;
      quantityMissing: string;
      quantityRejected: string;
      agreedDailyRate: string;
      remarks: string;
    }>,
  });

  // Godown Receiving Form
  const [godownForm, setGodownForm] = React.useState({
    warehouseId: "",
    yardArrivalGpsLat: "13.0827000",
    yardArrivalGpsLng: "80.2707000",
    yardOdometer: "",
    receiverName: "Warehouse In-Charge",
    photoUrl: "",
    remarks: "",
  });

  const [cancelReason, setCancelReason] = React.useState("");
  const [warehouses, setWarehouses] = React.useState<any[]>([]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTransfer(json.data);

        // Prepopulate dispatch items
        setDispatchForm((prev) => ({
          ...prev,
          items: (json.data.items || []).map((item: any) => ({
            itemId: item.id,
            materialName: item.materialVariant?.name || "Material",
            dispatchedQty: parseFloat(item.quantityDispatched),
            quantityCollected: (
              parseFloat(item.quantityCollected || "0") > 0
                ? parseFloat(item.quantityCollected)
                : parseFloat(item.quantityDispatched)
            ).toString(),
            remarks: item.remarks || "",
          })),
        }));

        // Prepopulate receive items
        setReceiveForm((prev) => ({
          ...prev,
          items: (json.data.items || []).map((item: any) => {
            const baseQty =
              parseFloat(item.quantityCollected || "0") > 0
                ? parseFloat(item.quantityCollected)
                : parseFloat(item.quantityDispatched);

            const destAgrItem = json.data.destinationRentalAgreement?.items?.find(
              (ai: any) => ai.materialVariantId === item.materialVariantId
            );
            const initialRate = item.agreedDailyRate
              ? item.agreedDailyRate.toString()
              : destAgrItem?.agreedDailyRate
              ? destAgrItem.agreedDailyRate.toString()
              : item.materialVariant?.defaultRentalRate
              ? item.materialVariant.defaultRentalRate.toString()
              : "";

            return {
              itemId: item.id,
              materialName: item.materialVariant?.name || "Material",
              baseQty,
              quantityAccepted: (
                parseFloat(item.quantityAccepted || "0") > 0
                  ? parseFloat(item.quantityAccepted)
                  : baseQty
              ).toString(),
              quantityGodownReturned: (parseFloat(item.quantityGodownReturned || "0")).toString(),
              quantityDamaged: (parseFloat(item.quantityDamaged || "0")).toString(),
              quantityMissing: (parseFloat(item.quantityMissing || "0")).toString(),
              quantityRejected: (parseFloat(item.quantityRejected || "0")).toString(),
              agreedDailyRate: initialRate,
              remarks: item.remarks || "",
            };
          }),
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

    // Fetch warehouses for godown receiving
    async function loadWarehouses() {
      try {
        const res = await fetch("/api/v1/warehouses");
        const json = await res.json();
        if (json.success && json.data) {
          setWarehouses(json.data);
          if (json.data.length > 0) {
            setGodownForm((prev) => ({ ...prev, warehouseId: json.data[0].id }));
          }
        }
      } catch {}
    }
    loadWarehouses();
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
      sourceRepName:
        prev.sourceRepName || matched?.name || transfer?.sourceCustomerSite?.siteInCharge || "",
      sourceRepPhone:
        prev.sourceRepPhone || matched?.phone || transfer?.sourceCustomerSite?.siteContactDetails || "",
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
      destRepName:
        prev.destRepName || matched?.name || transfer?.destinationCustomerSite?.siteInCharge || "",
      destRepPhone:
        prev.destRepPhone || matched?.phone || transfer?.destinationCustomerSite?.siteContactDetails || "",
      destRepDesignation: prev.destRepDesignation || matched?.designation || "Site In-Charge",
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

  const hasAutoOpened = React.useRef(false);

  React.useEffect(() => {
    if (!transfer || typeof window === "undefined" || hasAutoOpened.current) return;

    const actionParam = new URLSearchParams(window.location.search).get("action");
    if (!actionParam) return;

    if (actionParam === "pickup" && ["DRAFT", "SOURCE_PICKUP_PENDING"].includes(transfer.status)) {
      hasAutoOpened.current = true;
      openDispatchModal();
    } else if (
      actionParam === "deliver" &&
      ["SOURCE_PICKUP_COMPLETED", "IN_TRANSIT", "DISPATCHED"].includes(transfer.status)
    ) {
      hasAutoOpened.current = true;
      openReceiveModal();
    } else if (actionParam === "godown" && transfer.status === "GODOWN_RETURN_PENDING") {
      hasAutoOpened.current = true;
      setIsGodownModalOpen(true);
    }
  }, [transfer]);

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
          odometerReading: dispatchForm.odometerReading ? parseFloat(dispatchForm.odometerReading) : undefined,
          notes: dispatchForm.notes || undefined,
          items: dispatchForm.items.map((i) => ({
            itemId: i.itemId,
            quantityCollected: parseFloat(i.quantityCollected || "0"),
            remarks: i.remarks || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Source pickup confirmed! Source MRN completed, vehicle now en-route.");
        setIsDispatchModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Source pickup failed");
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
      const godown = parseFloat(item.quantityGodownReturned || "0");
      const dam = parseFloat(item.quantityDamaged || "0");
      const mis = parseFloat(item.quantityMissing || "0");
      const rej = parseFloat(item.quantityRejected || "0");
      const total = acc + godown + dam + mis + rej;

      if (Math.abs(total - item.baseQty) > 0.001) {
        toast.error(
          `Reconciliation mismatch for ${item.materialName}: Pickup (${item.baseQty}) ≠ Accepted + Godown Return + Damaged + Missing + Rejected (${total})`
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
          discrepancyResponsibleParty: receiveForm.discrepancyResponsibleParty,
          rejectedDisposition: receiveForm.rejectedDisposition,
          items: receiveForm.items.map((i) => ({
            itemId: i.itemId,
            quantityAccepted: parseFloat(i.quantityAccepted || "0"),
            quantityGodownReturned: parseFloat(i.quantityGodownReturned || "0"),
            quantityDamaged: parseFloat(i.quantityDamaged || "0"),
            quantityMissing: parseFloat(i.quantityMissing || "0"),
            quantityRejected: parseFloat(i.quantityRejected || "0"),
            agreedDailyRate: i.agreedDailyRate ? parseFloat(i.agreedDailyRate) : undefined,
            remarks: i.remarks || undefined,
          })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          "Delivery completed! Destination DN updated and rental batches transitioned."
        );
        setIsReceiveModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Delivery receipt reconciliation failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGodownReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!godownForm.warehouseId) {
      toast.error("Please select a receiving warehouse");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/direct-transfers/${id}/godown-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: godownForm.warehouseId,
          yardArrivalGpsLat: godownForm.yardArrivalGpsLat ? parseFloat(godownForm.yardArrivalGpsLat) : undefined,
          yardArrivalGpsLng: godownForm.yardArrivalGpsLng ? parseFloat(godownForm.yardArrivalGpsLng) : undefined,
          yardOdometer: godownForm.yardOdometer ? parseFloat(godownForm.yardOdometer) : undefined,
          photoUrl: godownForm.photoUrl || undefined,
          receiverName: godownForm.receiverName || undefined,
          remarks: godownForm.remarks || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Remaining materials received at godown! Transfer finalized.");
        setIsGodownModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Godown receiving failed");
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
        toast.success("Transfer cancelled successfully");
        setIsCancelModalOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || "Failed to cancel transfer");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#0B1E36]" />
        <p className="text-xs font-medium">Loading Direct Transfer Note & Linked Records...</p>
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
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
            Completed & Reconciled
          </Badge>
        );
      case "GODOWN_RETURN_PENDING":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 font-semibold">
            Godown Return Pending
          </Badge>
        );
      case "PARTIALLY_RECEIVED":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">
            Partial Discrepancy
          </Badge>
        );
      case "SOURCE_PICKUP_COMPLETED":
      case "IN_TRANSIT":
      case "DISPATCHED":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold">
            In Transit to Destination
          </Badge>
        );
      case "SOURCE_PICKUP_PENDING":
        return (
          <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 font-semibold">
            Awaiting Source Pickup
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="text-slate-600 font-semibold">
            Draft Prepared
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="font-semibold">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/operations/direct-transfers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Transfers Register
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
              AJAY ENTERPRISES Direct Site Transfer Control Panel • Created on{" "}
              {new Date(transfer.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
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

          {["DRAFT", "SOURCE_PICKUP_PENDING"].includes(transfer.status) && (
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
                className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                onClick={openDispatchModal}
              >
                <Send className="h-4 w-4 mr-2 text-[#F26522]" />
                Confirm Source Handover
              </Button>
            </>
          )}

          {["SOURCE_PICKUP_COMPLETED", "IN_TRANSIT", "DISPATCHED"].includes(transfer.status) && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={openReceiveModal}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Destination Delivery
            </Button>
          )}

          {transfer.status === "GODOWN_RETURN_PENDING" && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              onClick={() => setIsGodownModalOpen(true)}
            >
              <Warehouse className="h-4 w-4 mr-2" />
              Receive at Godown
            </Button>
          )}
        </div>
      </div>

      {/* Linked Documents Central Grid */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/50 shadow-sm">
        <CardHeader className="py-3 px-4 border-b border-blue-100/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Linked Multi-Document Lifecycle Coordination
            </div>
            <Badge variant="outline" className="text-[10px] bg-white font-mono">
              DSTN Master: {transfer.transferNumber}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Source MRN */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-semibold">
                SOURCE MRN
              </Badge>
              <span className="text-[10px] text-slate-500 font-medium">
                {transfer.sourceMrn?.status || "Pending"}
              </span>
            </div>
            <div>
              <p className="font-mono font-bold text-slate-900">
                {transfer.sourceMrn?.mrnNumber || "MRN-PENDING"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                From: {transfer.sourceCustomerSite?.siteName}
              </p>
            </div>
            {transfer.sourceMrnId && (
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/return-notes/${transfer.sourceMrnId}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                >
                  View MRN <ExternalLink className="h-3 w-3" />
                </Link>
                <a
                  href={`/api/v1/return-notes/${transfer.sourceMrnId}/print`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:text-slate-700 text-[11px]"
                >
                  Print PDF
                </a>
              </div>
            )}
          </div>

          {/* Vehicle Trip */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-orange-100 text-[#F26522] border-orange-200 text-[10px] font-semibold">
                FLEET TRIP
              </Badge>
              <span className="text-[10px] text-slate-500 font-medium">
                {transfer.vehicleTrip?.status || "Assigned"}
              </span>
            </div>
            <div>
              <p className="font-mono font-bold text-slate-900">
                {transfer.vehicleTrip?.tripNumber || "TRIP-PENDING"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {transfer.vehicle?.vehicleNumber || "Fleet"} • {transfer.driver?.name || "Driver"}
              </p>
            </div>
            <div className="pt-1 border-t border-slate-100 text-[11px] text-slate-600 truncate">
              Route: Site A → Site B {transfer.godownMrnId ? "→ Godown" : ""}
            </div>
          </div>

          {/* Destination DN */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold">
                DESTINATION DN
              </Badge>
              <span className="text-[10px] text-slate-500 font-medium">
                {transfer.destinationDn?.status || "Draft"}
              </span>
            </div>
            <div>
              <p className="font-mono font-bold text-slate-900">
                {transfer.destinationDn?.dnNumber || "DN-PENDING"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                To: {transfer.destinationCustomerSite?.siteName}
              </p>
            </div>
            {transfer.destinationDnId && (
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/delivery-notes/${transfer.destinationDnId}`}
                  className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                >
                  View DN <ExternalLink className="h-3 w-3" />
                </Link>
                <a
                  href={`/api/v1/delivery-notes/${transfer.destinationDnId}/print`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:text-slate-700 text-[11px]"
                >
                  Print PDF
                </a>
              </div>
            )}
          </div>

          {/* Godown Return MRN */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <Badge
                className={cn(
                  "text-[10px] font-semibold",
                  transfer.godownMrnId
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                )}
              >
                GODOWN RETURN
              </Badge>
              <span className="text-[10px] text-slate-500 font-medium">
                {transfer.godownMrnId ? transfer.godownMrn?.status : "Not Required"}
              </span>
            </div>
            <div>
              <p className="font-mono font-bold text-slate-900">
                {transfer.godownMrn?.mrnNumber || "No Return Leg"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {transfer.godownMrnId ? "Remaining items returning to yard" : "100% accepted at Site B"}
              </p>
            </div>
            {transfer.godownMrnId && (
              <div className="pt-1 border-t border-slate-100">
                <Link
                  href={`/return-notes/${transfer.godownMrnId}`}
                  className="text-purple-700 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                >
                  View Yard MRN <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sites & Logistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Site */}
        <Card className="border-slate-200 shadow-sm">
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
              <p className="text-xs text-slate-500 mt-0.5">{transfer.sourceCustomerSite?.fullAddress}</p>
            </div>
            {transfer.sourceRepName && (
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 block">Handover Representative</span>
                <span className="font-semibold text-slate-900">{transfer.sourceRepName}</span>
                <span className="text-slate-500 ml-1.5">({transfer.sourceRepDesignation})</span>
                {transfer.sourceRepPhone && (
                  <span className="text-slate-500 ml-2">📞 {transfer.sourceRepPhone}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Destination Site */}
        <Card className="border-slate-200 shadow-sm">
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
              <span className="font-medium text-slate-800">
                {transfer.destinationCustomerSite?.siteName}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {transfer.destinationCustomerSite?.fullAddress}
              </p>
            </div>
            {transfer.destRepName && (
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 block">Receiving Representative</span>
                <span className="font-semibold text-slate-900">{transfer.destRepName}</span>
                <span className="text-slate-500 ml-1.5">({transfer.destRepDesignation})</span>
                {transfer.destRepPhone && (
                  <span className="text-slate-500 ml-2">📞 {transfer.destRepPhone}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logistics & Rental Billing Rules */}
      <Card className="border-slate-200 shadow-sm">
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
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">Rental Cutoff Policy: </span>
              {transfer.includeCutoffDate ? (
                <span className="text-blue-700">
                  Cutoff date included for Customer A (Customer A pays on transfer day; Customer B
                  billing starts next day).
                </span>
              ) : (
                <span className="text-emerald-700">
                  Cutoff date excluded for Customer A (Customer A stops billing day before; Customer B
                  billing starts on transfer day).
                </span>
              )}
            </div>
            <Badge variant="outline" className="font-mono text-emerald-700 border-emerald-300 w-fit">
              Zero Overlap Verified
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Material Line Items & Reconciliation Matrix */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">
              Material Reconciliation Matrix
            </CardTitle>
            <p className="text-xs text-slate-500">
              Enforced: Dispatched = Accepted + Godown Return + Damaged + Missing + Rejected
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {transfer.items?.length || 0} Material Lines
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Material Code</th>
                  <th className="py-2.5 px-3">Material Name</th>
                  <th className="py-2.5 px-3">Ownership</th>
                  <th className="py-2.5 px-3 text-right">Dispatched</th>
                  <th className="py-2.5 px-3 text-right">Collected</th>
                  <th className="py-2.5 px-3 text-right text-emerald-700">Accepted</th>
                  <th className="py-2.5 px-3 text-right text-purple-700">Godown Return</th>
                  <th className="py-2.5 px-3 text-right text-amber-700">Damaged</th>
                  <th className="py-2.5 px-3 text-right text-rose-700">Missing</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfer.items?.map((item: any) => {
                  const qDispatched = parseFloat(item.quantityDispatched);
                  const qCollected =
                    parseFloat(item.quantityCollected || "0") > 0
                      ? parseFloat(item.quantityCollected)
                      : qDispatched;
                  const qAccepted = parseFloat(item.quantityAccepted || "0");
                  const qGodown = parseFloat(item.quantityGodownReturned || "0");
                  const qDamaged = parseFloat(item.quantityDamaged || "0");
                  const qMissing = parseFloat(item.quantityMissing || "0");

                  const isReconciled =
                    transfer.status === "COMPLETED" ||
                    Math.abs(qAccepted + qGodown + qDamaged + qMissing - qDispatched) < 0.001;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {item.materialVariant?.materialCode || "MAT"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {item.materialVariant?.name}
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({item.materialVariant?.uom})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {item.ownershipType}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {qDispatched}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {parseFloat(item.quantityCollected || "0") > 0
                          ? parseFloat(item.quantityCollected)
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">
                        {qAccepted > 0 ? qAccepted : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-purple-600">
                        {qGodown > 0 ? qGodown : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-600">
                        {qDamaged > 0 ? qDamaged : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        {qMissing > 0 ? qMissing : "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {transfer.status === "COMPLETED" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            Reconciled
                          </Badge>
                        ) : transfer.status === "GODOWN_RETURN_PENDING" ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            Godown Return
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-500">
                            In Progress
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Chronological Evidence & Audit Timeline */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/70 pb-3 border-b border-slate-100">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#0B1E36]" />
            Chronological Evidence & Point-of-Transfer Proof
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Handover Proof */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" /> Source Handover Proof
                </span>
                {transfer.dispatchedAt ? (
                  <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                    {new Date(transfer.dispatchedAt).toLocaleTimeString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-400">
                    Pending Handover
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <p>
                  <strong>Representative:</strong>{" "}
                  {transfer.sourceRepName
                    ? `${transfer.sourceRepName} (${transfer.sourceRepDesignation || "Site Rep"})`
                    : "Awaiting source handover"}
                </p>
                {transfer.sourceRepPhone && <p><strong>Phone:</strong> {transfer.sourceRepPhone}</p>}
                {transfer.sourceGpsLat && (
                  <p className="font-mono text-[10px] text-slate-500">
                    GPS: {parseFloat(transfer.sourceGpsLat).toFixed(6)},{" "}
                    {parseFloat(transfer.sourceGpsLng).toFixed(6)}
                  </p>
                )}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 mt-2">
                  {transfer.sourcePhotoUrl ? (
                    <a
                      href={transfer.sourcePhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <Camera className="h-3 w-3 text-[#F26522]" /> View Pickup Photo
                    </a>
                  ) : (
                    <span className="text-slate-400 italic text-[10px]">No pickup photo attached</span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 border-slate-300"
                    onClick={() => {
                      setCameraCategory("SOURCE_PICKUP");
                      setIsGpsCameraOpen(true);
                    }}
                  >
                    <Camera className="h-3 w-3 mr-1 text-[#F26522]" /> {transfer.sourcePhotoUrl ? "Retake" : "Snap Photo"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Destination Receipt Proof */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Destination Delivery Proof
                </span>
                {transfer.receivedAt ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                    {new Date(transfer.receivedAt).toLocaleTimeString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-400">
                    Pending Delivery
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <p>
                  <strong>Receiver:</strong>{" "}
                  {transfer.destRepName
                    ? `${transfer.destRepName} (${transfer.destRepDesignation || "Receiver"})`
                    : "Awaiting destination unloading"}
                </p>
                {transfer.destRepPhone && <p><strong>Phone:</strong> {transfer.destRepPhone}</p>}
                {transfer.destGpsLat && (
                  <p className="font-mono text-[10px] text-slate-500">
                    GPS: {parseFloat(transfer.destGpsLat).toFixed(6)},{" "}
                    {parseFloat(transfer.destGpsLng).toFixed(6)}
                  </p>
                )}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 mt-2">
                  {transfer.destPhotoUrl ? (
                    <a
                      href={transfer.destPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <Camera className="h-3 w-3 text-[#F26522]" /> View Delivery Photo
                    </a>
                  ) : (
                    <span className="text-slate-400 italic text-[10px]">No delivery photo attached</span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 border-slate-300"
                    onClick={() => {
                      setCameraCategory("DESTINATION_UNLOAD");
                      setIsGpsCameraOpen(true);
                    }}
                  >
                    <Camera className="h-3 w-3 mr-1 text-[#F26522]" /> {transfer.destPhotoUrl ? "Retake" : "Snap Photo"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPS Camera Dialog for Direct Transfers */}
      {isGpsCameraOpen && (
        <GpsCameraCaptureDialog
          open={isGpsCameraOpen}
          onOpenChange={setIsGpsCameraOpen}
          documentType="DIRECT_TRANSFER"
          documentId={transfer.id}
          documentNumber={transfer.transferNumber}
          siteName={cameraCategory === "SOURCE_PICKUP" ? transfer.sourceCustomerSite?.siteName : transfer.destinationCustomerSite?.siteName}
          customerName={cameraCategory === "SOURCE_PICKUP" ? transfer.sourceCustomer?.name : transfer.destinationCustomer?.name}
          defaultCategory={cameraCategory}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* DISPATCH / SOURCE PICKUP MODAL */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Confirm Material Pickup from Source Site
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record source site representative handover acknowledgement, GPS coordinates, and actual
              loaded equipment count.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDispatch} className="space-y-4 pt-2">
            <fieldset disabled={submitting} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Source Rep Name *</Label>
                  <button
                    type="button"
                    onClick={() => setIsManualRepInput(!isManualRepInput)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {isManualRepInput ? "← Select from Contacts" : "+ Enter Manually"}
                  </button>
                </div>

                {!isManualRepInput && sourceRepOptions.length > 0 ? (
                  <SearchableCombobox
                    options={sourceRepOptions}
                    value={dispatchForm.sourceRepName}
                    onChange={handleSelectSourceRep}
                    placeholder="Select authorized site representative..."
                    searchPlaceholder="Search name or designation..."
                  />
                ) : (
                  <Input
                    required
                    placeholder="E.g. Ramesh Kumar"
                    value={dispatchForm.sourceRepName}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, sourceRepName: e.target.value })
                    }
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input
                    placeholder="9876543210"
                    value={dispatchForm.sourceRepPhone}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, sourceRepPhone: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Designation</Label>
                  <Input
                    placeholder="Site In-Charge"
                    value={dispatchForm.sourceRepDesignation}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, sourceRepDesignation: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              {/* SINGLE LOCATION INPUT (REPLACES SEPARATE LAT/LNG BOXES) */}
              <GoogleMapsLocationInput
                id="dispatchMapsUrl"
                label="Site Pickup Location (Google Maps Link)"
                value={
                  dispatchForm.sourceMapsUrl ||
                  (dispatchForm.sourceGpsLat && dispatchForm.sourceGpsLng
                    ? `https://www.google.com/maps?q=${dispatchForm.sourceGpsLat},${dispatchForm.sourceGpsLng}`
                    : "")
                }
                latitude={dispatchForm.sourceGpsLat}
                longitude={dispatchForm.sourceGpsLng}
                required={false}
                onChange={({ latitude, longitude, mapsUrl }) => {
                  setDispatchForm((prev) => ({
                    ...prev,
                    sourceGpsLat: latitude !== null ? String(latitude) : "",
                    sourceGpsLng: longitude !== null ? String(longitude) : "",
                    sourceMapsUrl: mapsUrl,
                  }));
                }}
              />

              {/* Items Actual Collected */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <Label className="text-xs font-semibold text-slate-800">
                  Actual Quantities Loaded Onto Vehicle
                </Label>
                {dispatchForm.items.map((item, idx) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between gap-3 text-xs p-2 bg-slate-50 rounded"
                  >
                    <span className="font-medium text-slate-900 truncate">
                      {item.materialName} (Planned: {item.dispatchedQty})
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantityCollected}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDispatchForm((prev) => {
                          const copy = [...prev.items];
                          copy[idx].quantityCollected = val;
                          return { ...prev, items: copy };
                        });
                      }}
                      className="h-8 w-24 text-right text-xs font-semibold"
                    />
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-xs font-medium">Dispatch Remarks</Label>
                <Input
                  placeholder="Inspected and loaded onto company truck..."
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
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Confirm Pickup & Start Journey
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECEIVE / DESTINATION DELIVERY MODAL */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Destination Receipt & Quantity Reconciliation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verify received equipment at Customer B site. Base Collected = Accepted + Godown Return +
              Damaged + Missing + Rejected.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReceive} className="space-y-4 pt-2">
            <fieldset disabled={submitting} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Receiver Name *</Label>
                  <button
                    type="button"
                    onClick={() => setIsManualDestRepInput(!isManualDestRepInput)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {isManualDestRepInput ? "← Select from Contacts" : "+ Custom"}
                  </button>
                </div>

                {!isManualDestRepInput && destRepOptions.length > 0 ? (
                  <SearchableCombobox
                    options={destRepOptions}
                    value={receiveForm.destRepName}
                    onChange={handleSelectDestRep}
                    placeholder="Select authorized receiver..."
                    searchPlaceholder="Search receiver contacts..."
                  />
                ) : (
                  <Input
                    required
                    placeholder="E.g. Suresh Kumar"
                    value={receiveForm.destRepName}
                    onChange={(e) =>
                      setReceiveForm({ ...receiveForm, destRepName: e.target.value })
                    }
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input
                    placeholder="9845012345"
                    value={receiveForm.destRepPhone}
                    onChange={(e) =>
                      setReceiveForm({ ...receiveForm, destRepPhone: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Designation</Label>
                  <Input
                    placeholder="Site In-Charge / Receiver"
                    value={receiveForm.destRepDesignation}
                    onChange={(e) =>
                      setReceiveForm({ ...receiveForm, destRepDesignation: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Items Reconciliation Matrix */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="text-xs font-semibold text-slate-800">
                  Item Quantity Reconciliation Matrix
                </div>
                {receiveForm.items.map((item, idx) => (
                  <div
                    key={item.itemId}
                    className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900">{item.materialName}</span>
                      <Badge variant="outline" className="font-mono">
                        Collected: {item.baseQty}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-2 text-xs">
                      <div>
                        <Label className="text-[10px] font-semibold text-emerald-700">Accepted *</Label>
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
                          className="h-8 text-xs font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-semibold text-purple-700">
                          Godown Return
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantityGodownReturned}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveForm((prev) => {
                              const copy = [...prev.items];
                              copy[idx].quantityGodownReturned = val;
                              return { ...prev, items: copy };
                            });
                          }}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-semibold text-amber-700">Damaged</Label>
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
                        <Label className="text-[10px] font-semibold text-rose-700">Missing</Label>
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
                        <Label className="text-[10px] font-semibold text-slate-500">Rejected</Label>
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
                      <div>
                        <Label className="text-[10px] font-semibold text-blue-700">Rate (₹/day)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="₹/day"
                          value={item.agreedDailyRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveForm((prev) => {
                              const copy = [...prev.items];
                              copy[idx].agreedDailyRate = val;
                              return { ...prev, items: copy };
                            });
                          }}
                          className="h-8 text-xs font-mono text-blue-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-xs font-medium">Discrepancy Notes</Label>
                <Input
                  placeholder="Notes if accepted quantity differs from pickup..."
                  value={receiveForm.discrepancyNotes}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, discrepancyNotes: e.target.value })
                  }
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
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-emerald-600 text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirm Receipt & Transfer Custody
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* GODOWN RECEIVING MODAL */}
      <Dialog open={isGodownModalOpen} onOpenChange={setIsGodownModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Receive Remaining Materials at Godown
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Physically receive and inspect the remaining equipment returned from the direct
              transfer vehicle into warehouse inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGodownReceiving} className="space-y-4 pt-2">
            <fieldset disabled={submitting} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Receiving Warehouse *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: w.name,
                    sublabel: w.addressLine1 || w.city || undefined,
                  }))}
                  value={godownForm.warehouseId}
                  onChange={(val) => setGodownForm({ ...godownForm, warehouseId: val })}
                  placeholder="Select warehouse..."
                  searchPlaceholder="Search warehouse..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Receiving Staff / In-Charge</Label>
                <Input
                  value={godownForm.receiverName}
                  onChange={(e) => setGodownForm({ ...godownForm, receiverName: e.target.value })}
                  placeholder="Staff name"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Final Trip Odometer Reading</Label>
                <Input
                  type="number"
                  value={godownForm.yardOdometer}
                  onChange={(e) => setGodownForm({ ...godownForm, yardOdometer: e.target.value })}
                  placeholder="e.g. 45210"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Inspection Remarks</Label>
                <Input
                  value={godownForm.remarks}
                  onChange={(e) => setGodownForm({ ...godownForm, remarks: e.target.value })}
                  placeholder="Inspected and counted into yard racks"
                  className="h-8 text-xs"
                />
              </div>
            </fieldset>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsGodownModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Warehouse className="h-4 w-4 mr-2" />
                )}
                Confirm Godown Receipt & Complete Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CANCEL MODAL */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Cancel Transfer Note</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to cancel this transfer? Linked draft MRN and DN will also be
              cancelled. This action cannot be undone.
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
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
