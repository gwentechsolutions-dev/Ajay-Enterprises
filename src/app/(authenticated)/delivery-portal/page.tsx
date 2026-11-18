"use client";

import * as React from "react";
import {
  Compass,
  Phone,
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Loader2,
  FileCheck,
  AlertCircle,
  Truck,
  RotateCcw,
  ArrowRight,
  Building,
  Warehouse,
  Check,
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
import { toast } from "sonner";
import { queueOfflineDraft, getOfflineQueue, syncPendingDrafts } from "@/lib/offline/drafts";
import { stampGpsWatermarkOnPhoto } from "@/lib/gps-watermark";
import { FormFieldError } from "@/components/ui/form-field-error";
import { parseApiValidationErrors, formatValidationToast } from "@/lib/forms/validation-mapper";

export default function DeliveryPortalPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(true);
  const [offlineCount, setOfflineCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"ALL" | "DELIVERIES" | "PICKUPS" | "COMPLETED">("ALL");

  // Delivery Modal State (DN)
  const [selectedDN, setSelectedDN] = React.useState<any>(null);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = React.useState(false);
  const [submittingDelivery, setSubmittingDelivery] = React.useState(false);
  const [uploadingDeliveryPhoto, setUploadingDeliveryPhoto] = React.useState(false);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = React.useState<string | null>(null);
  const deliveryCameraInputRef = React.useRef<HTMLInputElement>(null);
  const [deliverErrors, setDeliverErrors] = React.useState<Record<string, string>>({});

  const [deliveryProofForm, setDeliveryProofForm] = React.useState({
    receiverName: "",
    receiverPhone: "",
    receiverDesignation: "Site Supervisor",
    photoUrl: "",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
    gpsAccuracy: 5.0,
    gpsFetching: false,
    remarks: "Unloaded and physically handed over at site.",
  });

  // Pickup Modal State (MRN)
  const [selectedMRN, setSelectedMRN] = React.useState<any>(null);
  const [isPickupModalOpen, setIsPickupModalOpen] = React.useState(false);
  const [submittingPickup, setSubmittingPickup] = React.useState(false);
  const [uploadingPickupPhoto, setUploadingPickupPhoto] = React.useState(false);
  const [pickupPhotoPreview, setPickupPhotoPreview] = React.useState<string | null>(null);
  const pickupCameraInputRef = React.useRef<HTMLInputElement>(null);
  const [pickupErrors, setPickupErrors] = React.useState<Record<string, string>>({});

  const [pickupProofForm, setPickupProofForm] = React.useState({
    receiverName: "",
    receiverPhone: "",
    receiverDesignation: "Site Supervisor",
    destinationType: "YARD" as "YARD" | "SITE_TRANSFER",
    destinationSiteName: "",
    photoUrl: "",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
    gpsAccuracy: 5.0,
    gpsFetching: false,
    remarks: "Materials verified against return checklist and loaded onto vehicle.",
  });

  const loadDeliveryFeed = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/portals/delivery");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast.error("Operating in offline or low-connectivity mode.");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateNetworkStatus = React.useCallback(() => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setIsOnline(online);
    const queue = getOfflineQueue();
    setOfflineCount(queue.filter((q) => q.status === "pending_sync").length);
  }, []);

  React.useEffect(() => {
    loadDeliveryFeed();
    updateNetworkStatus();

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, [loadDeliveryFeed, updateNetworkStatus]);

  // GPS auto-capture for Delivery
  const handleCaptureDeliveryGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setDeliveryProofForm((prev) => ({ ...prev, gpsFetching: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryProofForm((prev) => ({
          ...prev,
          gpsLatitude: Number(pos.coords.latitude.toFixed(6)),
          gpsLongitude: Number(pos.coords.longitude.toFixed(6)),
          gpsAccuracy: Number(pos.coords.accuracy.toFixed(1)),
          gpsFetching: false,
        }));
        toast.success("GPS Location verified successfully!");
      },
      (err) => {
        setDeliveryProofForm((prev) => ({ ...prev, gpsFetching: false }));
        toast.error(`GPS Error: ${err.message}. Using last known location.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // GPS auto-capture for Pickup
  const handleCapturePickupGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setPickupProofForm((prev) => ({ ...prev, gpsFetching: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupProofForm((prev) => ({
          ...prev,
          gpsLatitude: Number(pos.coords.latitude.toFixed(6)),
          gpsLongitude: Number(pos.coords.longitude.toFixed(6)),
          gpsAccuracy: Number(pos.coords.accuracy.toFixed(1)),
          gpsFetching: false,
        }));
        toast.success("GPS Location verified successfully!");
      },
      (err) => {
        setPickupProofForm((prev) => ({ ...prev, gpsFetching: false }));
        toast.error(`GPS Error: ${err.message}. Using last known location.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Photo Capture for Delivery
  const handleDeliveryPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDeliveryPhoto(true);
      const { watermarkedFile, dataUrl } = await stampGpsWatermarkOnPhoto({
        file,
        latitude: deliveryProofForm.gpsLatitude,
        longitude: deliveryProofForm.gpsLongitude,
        accuracy: deliveryProofForm.gpsAccuracy,
        siteName: selectedDN?.customerSite?.siteName || "Construction Site",
        customerName: selectedDN?.customer?.name || "",
        documentNumber: selectedDN?.dnNumber || "DELIVERY-NOTE",
        timestamp: new Date(),
      });

      setDeliveryPhotoPreview(dataUrl);

      const formData = new FormData();
      formData.append("file", watermarkedFile);
      formData.append("folder", "delivery-proofs");

      const res = await fetch("/api/v1/storage/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Photo upload failed");

      const uploadedPath = json.data?.url || (json.data?.storagePath ? `/api/v1/storage/download?path=${encodeURIComponent(json.data.storagePath)}` : "");
      setDeliveryProofForm((prev) => ({ ...prev, photoUrl: uploadedPath }));
      toast.success("Site proof photo captured with GPS watermark!");
    } catch (err: any) {
      toast.error(`Photo upload error: ${err.message}`);
    } finally {
      setUploadingDeliveryPhoto(false);
    }
  };

  // Handle Photo Capture for Pickup
  const handlePickupPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPickupPhoto(true);
      const { watermarkedFile, dataUrl } = await stampGpsWatermarkOnPhoto({
        file,
        latitude: pickupProofForm.gpsLatitude,
        longitude: pickupProofForm.gpsLongitude,
        accuracy: pickupProofForm.gpsAccuracy,
        siteName: selectedMRN?.customerSite?.siteName || "Construction Site",
        customerName: selectedMRN?.customer?.name || "",
        documentNumber: selectedMRN?.mrnNumber || "MATERIAL-RETURN",
        timestamp: new Date(),
      });

      setPickupPhotoPreview(dataUrl);

      const formData = new FormData();
      formData.append("file", watermarkedFile);
      formData.append("folder", "return-proofs");

      const res = await fetch("/api/v1/storage/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Photo upload failed");

      const uploadedPath = json.data?.url || (json.data?.storagePath ? `/api/v1/storage/download?path=${encodeURIComponent(json.data.storagePath)}` : "");
      setPickupProofForm((prev) => ({ ...prev, photoUrl: uploadedPath }));
      toast.success("Site pickup photo captured with GPS watermark!");
    } catch (err: any) {
      toast.error(`Photo upload error: ${err.message}`);
    } finally {
      setUploadingPickupPhoto(false);
    }
  };

  const openDeliveryModal = (dn: any) => {
    setSelectedDN(dn);
    setDeliveryPhotoPreview(null);
    setDeliverErrors({});
    const initialPhone = (dn.customerSite?.siteContactDetails || "").replace(/\D/g, "").slice(0, 10);
    setDeliveryProofForm({
      receiverName: (dn.customerSite?.siteInCharge || "").slice(0, 100),
      receiverPhone: initialPhone,
      receiverDesignation: "Site Supervisor",
      photoUrl: "",
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      gpsAccuracy: 4.5,
      gpsFetching: false,
      remarks: "Materials verified against checklist and delivered.",
    });
    setIsDeliverModalOpen(true);
    handleCaptureDeliveryGPS();
  };

  const openPickupModal = (mrn: any) => {
    setSelectedMRN(mrn);
    setPickupPhotoPreview(null);
    setPickupErrors({});
    const initialPhone = (mrn.customerSite?.siteContactDetails || "").replace(/\D/g, "").slice(0, 10);
    setPickupProofForm({
      receiverName: (mrn.customerSite?.siteInCharge || "").slice(0, 100),
      receiverPhone: initialPhone,
      receiverDesignation: "Site In-Charge",
      destinationType: "YARD",
      destinationSiteName: "",
      photoUrl: "",
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      gpsAccuracy: 4.5,
      gpsFetching: false,
      remarks: `Loaded onto vehicle ${mrn.vehicleNumber || ""}. Returning to ${mrn.receivingWarehouse?.name || "Yard"}.`,
    });
    setIsPickupModalOpen(true);
    handleCapturePickupGPS();
  };

  // Submit Delivery Note Handover
  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN) return;

    const newErrors: Record<string, string> = {};
    if (!deliveryProofForm.receiverName || deliveryProofForm.receiverName.trim().length < 2) {
      newErrors.receiverName = "Receiver full name is required (minimum 2 characters)";
    }
    const cleanPhone = (deliveryProofForm.receiverPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.receiverPhone = "Receiver mobile phone is required";
    } else if (cleanPhone.length !== 10) {
      newErrors.receiverPhone = `Must be exactly 10 digits (currently ${cleanPhone.length} digits)`;
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.receiverPhone = "Must start with 6, 7, 8, or 9 (valid Indian mobile)";
    }

    if (!deliveryProofForm.photoUrl) {
      newErrors.photo = "Site delivery proof photo is required before confirming handover";
    }

    if (Object.keys(newErrors).length > 0) {
      setDeliverErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      return toast.error(firstError);
    }

    setDeliverErrors({});

    try {
      setSubmittingDelivery(true);

      if (!isOnline) {
        queueOfflineDraft({
          documentType: "DELIVERY_NOTE",
          payload: {
            dnId: selectedDN.id,
            ...deliveryProofForm,
            receiverPhone: cleanPhone,
          },
        });
        toast.warning("Network offline! Saved to local queue. Will sync automatically when connected.");
        updateNetworkStatus();
        setIsDeliverModalOpen(false);
        return;
      }

      const res = await fetch(`/api/v1/delivery-notes/${selectedDN.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverName: deliveryProofForm.receiverName.trim(),
          receiverPhone: cleanPhone,
          receiverDesignation: deliveryProofForm.receiverDesignation,
          photoUrl: deliveryProofForm.photoUrl,
          gpsLatitude: deliveryProofForm.gpsLatitude,
          gpsLongitude: deliveryProofForm.gpsLongitude,
          gpsAccuracy: deliveryProofForm.gpsAccuracy,
          receiverSignatureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRNDAsNSA5MCwyMCIgc3Ryb2tlPSJibGFjayIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==",
          remarks: deliveryProofForm.remarks,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const parsed = parseApiValidationErrors(json);
        if (parsed.hasErrors) {
          setDeliverErrors(parsed.fieldErrors);
          toast.error(formatValidationToast(parsed));
          return;
        }
        throw new Error(json.error?.message || "Delivery submission failed");
      }

      toast.success(`Delivery Note ${selectedDN.dnNumber} completed! Custody confirmed.`);
      setIsDeliverModalOpen(false);
      loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Submit Material Return Note Pickup
  const handleCompletePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMRN) return;

    const newErrors: Record<string, string> = {};
    if (!pickupProofForm.receiverName || pickupProofForm.receiverName.trim().length < 2) {
      newErrors.receiverName = "Handover person name is required (minimum 2 characters)";
    }
    const cleanPhone = (pickupProofForm.receiverPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.receiverPhone = "Mobile phone is required";
    } else if (cleanPhone.length !== 10) {
      newErrors.receiverPhone = `Must be exactly 10 digits (currently ${cleanPhone.length} digits)`;
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.receiverPhone = "Must start with 6, 7, 8, or 9 (valid Indian mobile)";
    }

    if (!pickupProofForm.photoUrl) {
      newErrors.photo = "Site pickup proof photo is required before confirming return";
    }

    if (Object.keys(newErrors).length > 0) {
      setPickupErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      return toast.error(firstError);
    }

    setPickupErrors({});

    try {
      setSubmittingPickup(true);

      if (!isOnline) {
        queueOfflineDraft({
          documentType: "RETURN_NOTE",
          payload: {
            mrnId: selectedMRN.id,
            ...pickupProofForm,
            receiverPhone: cleanPhone,
          },
        });
        toast.warning("Network offline! Saved to local queue. Will sync automatically when connected.");
        updateNetworkStatus();
        setIsPickupModalOpen(false);
        return;
      }

      const res = await fetch(`/api/v1/return-notes/${selectedMRN.id}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverName: pickupProofForm.receiverName.trim(),
          receiverPhone: cleanPhone,
          receiverDesignation: pickupProofForm.receiverDesignation,
          destinationType: pickupProofForm.destinationType,
          destinationSiteName: pickupProofForm.destinationSiteName.trim() || undefined,
          photoUrl: pickupProofForm.photoUrl,
          gpsLatitude: pickupProofForm.gpsLatitude,
          gpsLongitude: pickupProofForm.gpsLongitude,
          gpsAccuracy: pickupProofForm.gpsAccuracy,
          receiverSignatureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRNDAsNSA5MCwyMCIgc3Ryb2tlPSJibGFjayIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==",
          remarks: pickupProofForm.remarks,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Pickup submission failed");
      }

      toast.success(json.message || `Material Return Note ${selectedMRN.mrnNumber} pickup confirmed!`);
      setIsPickupModalOpen(false);
      loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingPickup(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await syncPendingDrafts(async (item) => {
        if (item.documentType === "RETURN_NOTE") {
          const mrnRes = await fetch(`/api/v1/return-notes/${item.payload.mrnId}/pickup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          return mrnRes.ok;
        } else {
          const deliverRes = await fetch(`/api/v1/delivery-notes/${item.payload.dnId}/deliver`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          return deliverRes.ok;
        }
      });
      toast.success(`Sync complete: ${res.synced} items synchronized, ${res.failed} failed.`);
      updateNetworkStatus();
      loadDeliveryFeed();
    } catch {
      toast.error("Failed to synchronize offline queue.");
    } finally {
      setSyncing(false);
    }
  };

  const pendingDeliveries = data?.activeDeliveries || [];
  const pendingPickups = data?.activePickups || [];
  const completedDeliveries = data?.completedToday || [];
  const completedPickups = data?.completedPickupsToday || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Mobile-optimised App Header */}
      <div className="bg-[#0B1E36] text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F26522] flex items-center justify-center font-bold text-white shadow">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight">Delivery Driver Portal</h1>
            <p className="text-xs text-slate-300">AJAY ENTERPRISES Field Dispatch & Returns</p>
          </div>
        </div>

        {/* Connectivity badge */}
        <div className="text-right">
          {isOnline ? (
            <Badge className="bg-emerald-500 text-white text-[11px] flex items-center gap-1 font-bold">
              <Wifi className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge className="bg-amber-500 text-white text-[11px] flex items-center gap-1 font-bold">
              <WifiOff className="h-3 w-3" /> Offline Mode
            </Badge>
          )}

          {offlineCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={syncing || !isOnline}
              className="text-[10px] text-amber-300 underline block mt-1 hover:text-white"
            >
              {syncing ? "Syncing..." : `${offlineCount} pending sync (Tap to sync)`}
            </button>
          )}
        </div>
      </div>

      {/* Driver Queue Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div
          onClick={() => setActiveTab("DELIVERIES")}
          className={`p-3 rounded-xl border text-center cursor-pointer transition ${
            activeTab === "DELIVERIES"
              ? "bg-sky-100/90 border-sky-400 shadow-sm"
              : "bg-sky-50/60 border-sky-200 hover:bg-sky-100/60"
          }`}
        >
          <div className="text-2xl font-black text-sky-900">{pendingDeliveries.length}</div>
          <div className="text-[11px] text-sky-700 font-bold mt-0.5 flex items-center justify-center gap-1">
            <Truck className="w-3 h-3" />
            Deliveries (DN)
          </div>
        </div>

        <div
          onClick={() => setActiveTab("PICKUPS")}
          className={`p-3 rounded-xl border text-center cursor-pointer transition ${
            activeTab === "PICKUPS"
              ? "bg-amber-100/90 border-amber-400 shadow-sm"
              : "bg-amber-50/60 border-amber-200 hover:bg-amber-100/60"
          }`}
        >
          <div className="text-2xl font-black text-amber-900">{pendingPickups.length}</div>
          <div className="text-[11px] text-amber-700 font-bold mt-0.5 flex items-center justify-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Pickups (MRN)
          </div>
        </div>

        <div
          onClick={() => setActiveTab("COMPLETED")}
          className={`p-3 rounded-xl border text-center cursor-pointer transition ${
            activeTab === "COMPLETED"
              ? "bg-emerald-100/90 border-emerald-400 shadow-sm"
              : "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/60"
          }`}
        >
          <div className="text-2xl font-black text-emerald-900">
            {completedDeliveries.length + completedPickups.length}
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed Today
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`flex-1 py-1.5 rounded-lg text-center transition ${
            activeTab === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All Tasks ({pendingDeliveries.length + pendingPickups.length})
        </button>
        <button
          onClick={() => setActiveTab("DELIVERIES")}
          className={`flex-1 py-1.5 rounded-lg text-center transition ${
            activeTab === "DELIVERIES" ? "bg-white text-sky-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Deliveries ({pendingDeliveries.length})
        </button>
        <button
          onClick={() => setActiveTab("PICKUPS")}
          className={`flex-1 py-1.5 rounded-lg text-center transition ${
            activeTab === "PICKUPS" ? "bg-white text-amber-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Pickups ({pendingPickups.length})
        </button>
        <button
          onClick={() => setActiveTab("COMPLETED")}
          className={`flex-1 py-1.5 rounded-lg text-center transition ${
            activeTab === "COMPLETED" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Done ({completedDeliveries.length + completedPickups.length})
        </button>
      </div>

      {/* Active Tasks Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
            Loading assigned routes and material pickups...
          </div>
        ) : (
          <>
            {/* 1. PICKUPS / RETURNS SECTION */}
            {(activeTab === "ALL" || activeTab === "PICKUPS") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                    Assigned Material Pickups / Returns ({pendingPickups.length})
                  </h2>
                </div>

                {pendingPickups.length === 0 ? (
                  activeTab === "PICKUPS" && (
                    <Card className="p-6 text-center text-slate-500 border-slate-200">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-sm">No Pending Pickups!</p>
                      <p className="text-xs text-slate-400 mt-1">All material return collections are complete.</p>
                    </Card>
                  )
                ) : (
                  pendingPickups.map((mrn: any) => (
                    <Card key={mrn.id} className="border-amber-200/80 shadow-sm overflow-hidden bg-white">
                      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200/80 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-amber-950">{mrn.mrnNumber}</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            PICKUP
                          </span>
                        </div>
                        {mrn.vehicleNumber && (
                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            {mrn.vehicleNumber}
                          </span>
                        )}
                      </div>

                      <CardContent className="p-4 space-y-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase text-slate-400">Returning Customer</div>
                          <h3 className="font-black text-base text-slate-900">{mrn.customer?.name}</h3>
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                            <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>{mrn.customerSite?.siteName}</strong> &bull; {mrn.customerSite?.fullAddress || "Site location"}
                            </span>
                          </div>
                        </div>

                        {/* Destination Information */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Return Destination</div>
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Warehouse className="w-3.5 h-3.5 text-slate-600" />
                              {mrn.receivingWarehouse?.name || "Main Centering Yard"}
                            </div>
                          </div>
                          {mrn.customerSite?.siteContactDetails && (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-xs h-8 px-3"
                            >
                              <a href={`tel:${mrn.customerSite.siteContactDetails}`}>
                                <Phone className="h-3.5 w-3.5 mr-1" />
                                Call Site
                              </a>
                            </Button>
                          )}
                        </div>

                        {/* Items to Pick Up */}
                        <div className="border-t border-slate-100 pt-2">
                          <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">
                            Materials to Collect ({mrn.items?.length || 0} items)
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {mrn.items?.map((it: any) => (
                              <div key={it.id} className="bg-amber-50/50 border border-amber-100 px-2 py-1 rounded text-slate-800">
                                &bull; <strong className="font-mono text-amber-900">{Number(it.returnedQty)}</strong> &times; {it.materialVariant?.name}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          onClick={() => openPickupModal(mrn)}
                          className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-bold h-11 flex items-center justify-center gap-2 shadow"
                        >
                          <Camera className="h-4 w-4 text-[#F26522]" />
                          Capture Proof & Complete Return
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* 2. DELIVERIES SECTION */}
            {(activeTab === "ALL" || activeTab === "DELIVERIES") && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-sky-600" />
                    Assigned Outward Deliveries ({pendingDeliveries.length})
                  </h2>
                </div>

                {pendingDeliveries.length === 0 ? (
                  activeTab === "DELIVERIES" && (
                    <Card className="p-6 text-center text-slate-500 border-slate-200">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-sm">All Deliveries Completed!</p>
                      <p className="text-xs text-slate-400 mt-1">No pending dispatches assigned to your vehicle.</p>
                    </Card>
                  )
                ) : (
                  pendingDeliveries.map((dn: any) => (
                    <Card key={dn.id} className="border-sky-200/80 shadow-sm overflow-hidden bg-white">
                      <div className="bg-sky-50 px-4 py-2 border-b border-sky-200/80 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-sky-950">{dn.dnNumber}</span>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">
                            DELIVERY
                          </span>
                        </div>
                        {dn.vehicleNumber && (
                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            {dn.vehicleNumber}
                          </span>
                        )}
                      </div>

                      <CardContent className="p-4 space-y-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase text-slate-400">Recipient Customer</div>
                          <h3 className="font-black text-base text-slate-900">{dn.customer?.name}</h3>
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                            <MapPin className="h-4 w-4 text-[#F26522] shrink-0 mt-0.5" />
                            <span>
                              <strong>{dn.customerSite?.siteName}</strong> &bull; {dn.customerSite?.fullAddress || "Site location"}
                            </span>
                          </div>
                        </div>

                        {/* Contact site directly */}
                        {dn.customerSite?.siteContactDetails && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">Site Supervisor Contact</div>
                              <div className="text-xs font-bold text-slate-800">
                                {dn.customerSite?.siteInCharge || "Site In-Charge"} ({dn.customerSite?.siteContactDetails})
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-xs h-8 px-3"
                            >
                              <a href={`tel:${dn.customerSite.siteContactDetails}`}>
                                <Phone className="h-3.5 w-3.5 mr-1" />
                                Call Site
                              </a>
                            </Button>
                          </div>
                        )}

                        {/* Items to unload */}
                        <div className="border-t border-slate-100 pt-2">
                          <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">
                            Equipment to Unload ({dn.items?.length || 0} items)
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {dn.items?.map((it: any) => (
                              <div key={it.id} className="bg-slate-50 px-2 py-1 rounded text-slate-700">
                                &bull; <strong className="font-mono text-slate-900">{Number(it.quantity)}</strong> &times; {it.materialVariant?.name}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action button */}
                        <Button
                          onClick={() => openDeliveryModal(dn)}
                          className="w-full bg-[#F26522] hover:bg-[#EA580C] text-white font-bold h-11 flex items-center justify-center gap-2 shadow"
                        >
                          <Camera className="h-4 w-4" />
                          Capture Proof & Complete Delivery
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* 3. COMPLETED TODAY SECTION */}
            {activeTab === "COMPLETED" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Runs Completed Today ({completedDeliveries.length + completedPickups.length})
                </h2>

                {completedDeliveries.length === 0 && completedPickups.length === 0 ? (
                  <Card className="p-6 text-center text-slate-500 border-slate-200">
                    <p className="font-semibold text-sm">No tasks completed yet today.</p>
                  </Card>
                ) : (
                  <>
                    {completedDeliveries.map((dn: any) => (
                      <Card key={dn.id} className="p-4 border-slate-200 bg-white shadow-sm flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{dn.dnNumber}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              DELIVERED
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-800 mt-0.5">{dn.customer?.name}</div>
                          <div className="text-[11px] text-slate-500">{dn.customerSite?.siteName}</div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      </Card>
                    ))}

                    {completedPickups.map((mrn: any) => (
                      <Card key={mrn.id} className="p-4 border-slate-200 bg-white shadow-sm flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{mrn.mrnNumber}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                              RETURNED
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-800 mt-0.5">{mrn.customer?.name}</div>
                          <div className="text-[11px] text-slate-500">
                            From {mrn.customerSite?.siteName} &rarr; {mrn.receivingWarehouse?.name || "Yard"}
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      </Card>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* DELIVERY PROOF & ACKNOWLEDGEMENT MODAL (DN) */}
      <Dialog open={isDeliverModalOpen} onOpenChange={setIsDeliverModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="h-5 w-5 text-[#F26522]" />
              Site Delivery Proof – {selectedDN?.dnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm material handover at {selectedDN?.customerSite?.siteName}. GPS location and receiver signature required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCompleteDelivery} className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-semibold" required>Receiver Full Name *</Label>
              <Input
                value={deliveryProofForm.receiverName}
                maxLength={100}
                error={!!deliverErrors.receiverName}
                onChange={(e) => {
                  setDeliveryProofForm({ ...deliveryProofForm, receiverName: e.target.value.slice(0, 100) });
                  if (deliverErrors.receiverName) {
                    setDeliverErrors((prev) => {
                      const cp = { ...prev };
                      delete cp.receiverName;
                      return cp;
                    });
                  }
                }}
                placeholder="Receiver name (max 100 characters)"
                required
              />
              <FormFieldError error={deliverErrors.receiverName} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold" required>Receiver Mobile Phone *</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {deliveryProofForm.receiverPhone.length}/10 digits
                </span>
              </div>
              <Input
                type="tel"
                value={deliveryProofForm.receiverPhone}
                maxLength={10}
                error={!!deliverErrors.receiverPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setDeliveryProofForm({ ...deliveryProofForm, receiverPhone: val });
                  if (deliverErrors.receiverPhone) {
                    setDeliverErrors((prev) => {
                      const cp = { ...prev };
                      delete cp.receiverPhone;
                      return cp;
                    });
                  }
                }}
                placeholder="10-digit Indian mobile (e.g. 9876543210)"
                required
              />
              <FormFieldError error={deliverErrors.receiverPhone} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">GPS Coordinates</Label>
                <button
                  type="button"
                  onClick={handleCaptureDeliveryGPS}
                  className="text-[11px] text-[#F26522] font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className={`h-3 w-3 ${deliveryProofForm.gpsFetching ? "animate-spin" : ""}`} />
                  Refresh GPS
                </button>
              </div>
              <Input
                disabled
                value={`${deliveryProofForm.gpsLatitude}, ${deliveryProofForm.gpsLongitude} (Acc: ±${deliveryProofForm.gpsAccuracy}m)`}
                className="bg-slate-100 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold block mb-1">Site Delivery Proof Photo *</Label>
              <input
                ref={deliveryCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDeliveryPhotoCapture}
                className="hidden"
              />

              {deliveryPhotoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 mb-1">
                  <img
                    src={deliveryPhotoPreview}
                    alt="Delivery proof with GPS watermark"
                    className="w-full max-h-56 object-contain bg-slate-900"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 font-medium bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                      <CheckCircle2 className="h-3 w-3" />
                      {uploadingDeliveryPhoto ? "Uploading..." : "GPS Watermarked"}
                    </span>
                    <button
                      type="button"
                      onClick={() => deliveryCameraInputRef.current?.click()}
                      className="bg-black/70 hover:bg-black/90 text-white text-[10px] px-2.5 py-0.5 rounded-full font-medium shadow-sm cursor-pointer"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => deliveryCameraInputRef.current?.click()}
                  disabled={uploadingDeliveryPhoto}
                  className="w-full border-2 border-dashed border-[#F26522]/40 hover:border-[#F26522] bg-orange-50/50 hover:bg-orange-50/80 rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-[#F26522]/10 flex items-center justify-center text-[#F26522]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {uploadingDeliveryPhoto ? "Uploading Photo..." : "Tap to Open Camera & Take Site Photo"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Snap photo of unloaded centering materials at site
                    </span>
                  </div>
                </button>
              )}
              <FormFieldError error={deliverErrors.photo} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">Notes / Handover Remarks</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(deliveryProofForm.remarks || "").length}/500
                </span>
              </div>
              <Input
                value={deliveryProofForm.remarks}
                maxLength={500}
                placeholder="e.g. Materials verified against checklist and delivered."
                onChange={(e) => setDeliveryProofForm({ ...deliveryProofForm, remarks: e.target.value.slice(0, 500) })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDeliverModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingDelivery || uploadingDeliveryPhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {submittingDelivery ? "Confirming Handover..." : "Confirm Handover"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PICKUP PROOF & RETURN MODAL (MRN) */}
      <Dialog open={isPickupModalOpen} onOpenChange={setIsPickupModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Confirm Material Pickup & Return – {selectedMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm material return pickup from {selectedMRN?.customerSite?.siteName}. Capture GPS photo evidence and sign-off.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCompletePickup} className="space-y-3 pt-1">
            {/* Destination Selector (Yard vs Site Transfer) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <Label className="text-xs font-bold text-slate-800">Return Haulage Destination</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPickupProofForm({ ...pickupProofForm, destinationType: "YARD" })}
                  className={`py-2 px-3 rounded-lg border text-left font-semibold flex items-center gap-1.5 transition ${
                    pickupProofForm.destinationType === "YARD"
                      ? "bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <Warehouse className="w-4 h-4 shrink-0" />
                  <span>Return to Yard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPickupProofForm({ ...pickupProofForm, destinationType: "SITE_TRANSFER" })}
                  className={`py-2 px-3 rounded-lg border text-left font-semibold flex items-center gap-1.5 transition ${
                    pickupProofForm.destinationType === "SITE_TRANSFER"
                      ? "bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <Building className="w-4 h-4 shrink-0" />
                  <span>Site Transfer</span>
                </button>
              </div>

              {pickupProofForm.destinationType === "SITE_TRANSFER" ? (
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Transfer Destination Site Name</Label>
                  <Input
                    value={pickupProofForm.destinationSiteName}
                    onChange={(e) => setPickupProofForm({ ...pickupProofForm, destinationSiteName: e.target.value })}
                    placeholder="e.g. Mandaveli Apartments (Site 2)"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              ) : (
                <div className="text-[11px] text-slate-600">
                  Destination: <strong>{selectedMRN?.receivingWarehouse?.name || "Main Centering Yard"}</strong>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold" required>Site Handover Person / Supervisor Name *</Label>
              <Input
                value={pickupProofForm.receiverName}
                maxLength={100}
                error={!!pickupErrors.receiverName}
                onChange={(e) => {
                  setPickupProofForm({ ...pickupProofForm, receiverName: e.target.value.slice(0, 100) });
                  if (pickupErrors.receiverName) {
                    setPickupErrors((prev) => {
                      const cp = { ...prev };
                      delete cp.receiverName;
                      return cp;
                    });
                  }
                }}
                placeholder="Name of person handing over materials at site"
                required
              />
              <FormFieldError error={pickupErrors.receiverName} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold" required>Handover Person Contact Mobile *</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {pickupProofForm.receiverPhone.length}/10 digits
                </span>
              </div>
              <Input
                type="tel"
                value={pickupProofForm.receiverPhone}
                maxLength={10}
                error={!!pickupErrors.receiverPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPickupProofForm({ ...pickupProofForm, receiverPhone: val });
                  if (pickupErrors.receiverPhone) {
                    setPickupErrors((prev) => {
                      const cp = { ...prev };
                      delete cp.receiverPhone;
                      return cp;
                    });
                  }
                }}
                placeholder="10-digit mobile (e.g. 9876543210)"
                required
              />
              <FormFieldError error={pickupErrors.receiverPhone} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">GPS Handover Coordinates</Label>
                <button
                  type="button"
                  onClick={handleCapturePickupGPS}
                  className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className={`h-3 w-3 ${pickupProofForm.gpsFetching ? "animate-spin" : ""}`} />
                  Refresh GPS
                </button>
              </div>
              <Input
                disabled
                value={`${pickupProofForm.gpsLatitude}, ${pickupProofForm.gpsLongitude} (Acc: ±${pickupProofForm.gpsAccuracy}m)`}
                className="bg-slate-100 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold block mb-1">Loaded Return Materials Photo Proof *</Label>
              <input
                ref={pickupCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePickupPhotoCapture}
                className="hidden"
              />

              {pickupPhotoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 mb-1">
                  <img
                    src={pickupPhotoPreview}
                    alt="Pickup proof with GPS watermark"
                    className="w-full max-h-56 object-contain bg-slate-900"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 font-medium bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                      <CheckCircle2 className="h-3 w-3" />
                      {uploadingPickupPhoto ? "Uploading..." : "GPS Watermarked"}
                    </span>
                    <button
                      type="button"
                      onClick={() => pickupCameraInputRef.current?.click()}
                      className="bg-black/70 hover:bg-black/90 text-white text-[10px] px-2.5 py-0.5 rounded-full font-medium shadow-sm cursor-pointer"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pickupCameraInputRef.current?.click()}
                  disabled={uploadingPickupPhoto}
                  className="w-full border-2 border-dashed border-amber-400 hover:border-amber-600 bg-amber-50/50 hover:bg-amber-50/80 rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {uploadingPickupPhoto ? "Uploading Photo..." : "Tap to Open Camera & Take Site Pickup Photo"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Snap photo of returned centering materials loaded onto vehicle
                    </span>
                  </div>
                </button>
              )}
              <FormFieldError error={pickupErrors.photo} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">Pickup Remarks / Vehicle Notes</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(pickupProofForm.remarks || "").length}/500
                </span>
              </div>
              <Input
                value={pickupProofForm.remarks}
                maxLength={500}
                placeholder="e.g. 50 props loaded in good condition."
                onChange={(e) => setPickupProofForm({ ...pickupProofForm, remarks: e.target.value.slice(0, 500) })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPickupModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingPickup || uploadingPickupPhoto}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white font-bold"
              >
                {submittingPickup ? "Confirming Return..." : "Confirm Pickup & Yard Return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
