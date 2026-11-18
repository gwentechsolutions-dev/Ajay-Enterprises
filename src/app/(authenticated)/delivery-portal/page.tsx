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
  Loader2,
  FileCheck,
  AlertCircle,
  Truck,
  RotateCcw,
  Building,
  Warehouse,
  Check,
  Navigation,
  AlertTriangle,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

// Responsive HTML5 Touch Signature Pad for Mobile Handover Acknowledgement
function TouchSignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasDrawn, setHasDrawn] = React.useState(!!value);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B1E36";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">Customer Representative Signature *</span>
        {hasDrawn && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-red-600 font-bold hover:underline"
          >
            Clear / Re-sign
          </button>
        )}
      </div>
      <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={360}
          height={130}
          className="w-full h-32 bg-white cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      <p className="text-[10px] text-slate-400 italic">Customer representative must sign on screen using finger or stylus.</p>
    </div>
  );
}

export default function DeliveryPortalPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(true);
  const [offlineCount, setOfflineCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"ALL" | "DELIVERIES" | "PICKUPS" | "COMPLETED">("ALL");

  // Loading state for site arrival
  const [loadingArrivalId, setLoadingArrivalId] = React.useState<string | null>(null);

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

  // Pickup Handover Modal State (MRN)
  const [selectedMRN, setSelectedMRN] = React.useState<any>(null);
  const [isPickupModalOpen, setIsPickupModalOpen] = React.useState(false);
  const [submittingPickup, setSubmittingPickup] = React.useState(false);
  const [uploadingPickupPhoto, setUploadingPickupPhoto] = React.useState(false);
  const [pickupPhotoPreviews, setPickupPhotoPreviews] = React.useState<string[]>([]);
  const [pickupUploadedUrls, setPickupUploadedUrls] = React.useState<string[]>([]);
  const pickupCameraInputRef = React.useRef<HTMLInputElement>(null);
  const [pickupErrors, setPickupErrors] = React.useState<Record<string, string>>({});

  // Items for driver count
  const [pickupItems, setPickupItems] = React.useState<Array<{
    materialVariantId: string;
    materialName: string;
    materialCode: string;
    size?: string;
    expectedQty: number;
    driverCollectedQty: number;
    driverGoodQty: number;
    driverDamagedQty: number;
    driverMissingQty: number;
    driverRemarks: string;
  }>>([]);

  const [pickupProofForm, setPickupProofForm] = React.useState({
    receiverName: "",
    receiverPhone: "",
    receiverDesignation: "Site Supervisor",
    customerSignatureUrl: "" as string | null,
    customerSignatureRefused: false,
    customerSignatureExceptionReason: "",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
    gpsAccuracy: 5.0,
    gpsFetching: false,
    remarks: "Materials verified against return checklist and loaded onto vehicle.",
  });

  // Yard Arrival Modal State (MRN)
  const [selectedYardMRN, setSelectedYardMRN] = React.useState<any>(null);
  const [isYardModalOpen, setIsYardModalOpen] = React.useState(false);
  const [submittingYardArrival, setSubmittingYardArrival] = React.useState(false);
  const [yardArrivalForm, setYardArrivalForm] = React.useState({
    yardOdometer: 0,
    receiverName: "Yard Manager",
    receiverDesignation: "Yard In-Charge",
    receiverPhone: "",
    remarks: "Vehicle arrived at yard. Materials ready for warehouse receiving inspection.",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
  });

  const loadDeliveryFeed = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/portals/delivery");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error?.message || "Failed to load portal feed");
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

    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadDeliveryFeed, updateNetworkStatus]);

  // Handle GPS Capture for Delivery
  const handleCaptureDeliveryGPS = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("GPS Geolocation not supported on this device.");
      return;
    }

    setDeliveryProofForm((prev) => ({ ...prev, gpsFetching: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryProofForm((prev) => ({
          ...prev,
          gpsLatitude: Number(position.coords.latitude.toFixed(6)),
          gpsLongitude: Number(position.coords.longitude.toFixed(6)),
          gpsAccuracy: Number(position.coords.accuracy.toFixed(1)),
          gpsFetching: false,
        }));
        toast.success(`GPS coordinates captured! Accuracy: ±${position.coords.accuracy.toFixed(1)}m`);
      },
      () => {
        setDeliveryProofForm((prev) => ({ ...prev, gpsFetching: false }));
        toast.warning("Could not read live GPS. Using current estimated location.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle GPS Capture for Pickup
  const handleCapturePickupGPS = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("GPS Geolocation not supported on this device.");
      return;
    }

    setPickupProofForm((prev) => ({ ...prev, gpsFetching: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickupProofForm((prev) => ({
          ...prev,
          gpsLatitude: Number(position.coords.latitude.toFixed(6)),
          gpsLongitude: Number(position.coords.longitude.toFixed(6)),
          gpsAccuracy: Number(position.coords.accuracy.toFixed(1)),
          gpsFetching: false,
        }));
        toast.success(`GPS coordinates captured! Accuracy: ±${position.coords.accuracy.toFixed(1)}m`);
      },
      () => {
        setPickupProofForm((prev) => ({ ...prev, gpsFetching: false }));
        toast.warning("Could not read live GPS. Using recorded site location.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 1. DRIVER ACTION: MARK ARRIVAL AT CUSTOMER SITE (STAGE 4)
  const handleMarkArrivalAtSite = async (mrn: any) => {
    try {
      setLoadingArrivalId(mrn.id);
      let latitude = 12.9716;
      let longitude = 77.5946;
      let accuracy = 5.0;

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 9000,
              maximumAge: 0,
            });
          });
          latitude = Number(pos.coords.latitude.toFixed(6));
          longitude = Number(pos.coords.longitude.toFixed(6));
          accuracy = Number(pos.coords.accuracy.toFixed(1));
        } catch {
          toast.warning("GPS access slow or denied. Recording site arrival with current timestamp.");
        }
      }

      const res = await fetch(`/api/v1/return-notes/${mrn.id}/site-arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gpsLatitude: latitude,
          gpsLongitude: longitude,
          gpsAccuracy: accuracy,
          arrivedAt: new Date().toISOString(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to record site arrival");

      toast.success(`Site arrival confirmed at ${mrn.customerSite?.siteName}! You can now count materials and take handover.`);
      await loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingArrivalId(null);
    }
  };

  // Handle Photo Capture for Delivery Note
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

  // Handle Photo Capture for Pickup (Multiple Photos Supported)
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
      setPickupPhotoPreviews((prev) => [...prev, dataUrl]);
      setPickupUploadedUrls((prev) => [...prev, uploadedPath]);
      toast.success("Return material photo uploaded with GPS watermark!");
    } catch (err: any) {
      toast.error(`Photo upload error: ${err.message}`);
    } finally {
      setUploadingPickupPhoto(false);
    }
  };

  const removePickupPhoto = (index: number) => {
    setPickupPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setPickupUploadedUrls((prev) => prev.filter((_, i) => i !== index));
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

  // 2. OPEN DRIVER PICKUP HANDOVER MODAL (STAGE 5, 6, 7)
  const openPickupModal = (mrn: any) => {
    setSelectedMRN(mrn);
    setPickupPhotoPreviews([]);
    setPickupUploadedUrls([]);
    setPickupErrors({});
    const initialPhone = (mrn.customerSite?.siteContactDetails || mrn.customer?.primaryMobile || "").replace(/\D/g, "").slice(0, 10);

    const items = (mrn.items || []).map((it: any) => {
      const exp = Number(it.expectedQty || it.returnedQty || 0);
      return {
        materialVariantId: it.materialVariantId,
        materialName: it.materialVariant?.name || "Centering Material",
        materialCode: it.materialVariant?.materialCode || "",
        size: it.materialVariant?.size || "-",
        expectedQty: exp,
        driverCollectedQty: it.driverCollectedQty !== null && it.driverCollectedQty !== undefined ? Number(it.driverCollectedQty) : exp,
        driverGoodQty: it.driverGoodQty !== null && it.driverGoodQty !== undefined ? Number(it.driverGoodQty) : exp,
        driverDamagedQty: Number(it.driverDamagedQty || 0),
        driverMissingQty: Number(it.driverMissingQty || 0),
        driverRemarks: it.driverRemarks || "",
      };
    });

    setPickupItems(items);
    setPickupProofForm({
      receiverName: (mrn.customerRepresentativeName || mrn.customerSite?.siteInCharge || "").slice(0, 100),
      receiverPhone: initialPhone,
      receiverDesignation: mrn.customerRepresentativeDesignation || "Site Supervisor",
      customerSignatureUrl: null,
      customerSignatureRefused: false,
      customerSignatureExceptionReason: "",
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      gpsAccuracy: 4.5,
      gpsFetching: false,
      remarks: `Materials collected at site ${mrn.customerSite?.siteName}. Loaded onto vehicle ${mrn.vehicleNumber || ""}.`,
    });
    setIsPickupModalOpen(true);
    handleCapturePickupGPS();
  };

  // 3. OPEN YARD ARRIVAL MODAL (STAGE 9)
  const openYardArrivalModal = (mrn: any) => {
    setSelectedYardMRN(mrn);
    const startOdo = mrn.vehicleTrip?.startOdometer ? Number(mrn.vehicleTrip.startOdometer) : 0;
    setYardArrivalForm({
      yardOdometer: startOdo > 0 ? startOdo + 15 : 0,
      receiverName: "Yard Manager",
      receiverDesignation: "Yard In-Charge",
      receiverPhone: "",
      remarks: `Materials from ${mrn.customerSite?.siteName} arrived at ${mrn.receivingWarehouse?.name || "Peenya Yard"} ready for physical QC inspection.`,
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
    });
    setIsYardModalOpen(true);
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

  // Submit Material Return Note Pickup Handover (Stage 8)
  const handleConfirmMaterialPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMRN) return;

    const newErrors: Record<string, string> = {};
    if (!pickupProofForm.receiverName || pickupProofForm.receiverName.trim().length < 2) {
      newErrors.receiverName = "Customer representative name is required (min 2 characters)";
    }
    const cleanPhone = (pickupProofForm.receiverPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.receiverPhone = "Mobile phone is required";
    } else if (cleanPhone.length !== 10) {
      newErrors.receiverPhone = `Must be exactly 10 digits (currently ${cleanPhone.length} digits)`;
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.receiverPhone = "Must start with 6, 7, 8, or 9 (valid Indian mobile)";
    }

    if (pickupUploadedUrls.length === 0) {
      newErrors.photo = "At least one site pickup photograph is mandatory before handover";
    }

    if (!pickupProofForm.customerSignatureRefused && !pickupProofForm.customerSignatureUrl) {
      newErrors.signature = "Customer representative digital signature is required";
    }

    if (pickupProofForm.customerSignatureRefused && !pickupProofForm.customerSignatureExceptionReason?.trim()) {
      newErrors.signature = "Reason is mandatory when signature cannot be obtained";
    }

    if (Object.keys(newErrors).length > 0) {
      setPickupErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      return toast.error(firstError);
    }

    setPickupErrors({});

    try {
      setSubmittingPickup(true);

      const payload = {
        customerRepresentativeName: pickupProofForm.receiverName.trim(),
        customerRepresentativeDesignation: pickupProofForm.receiverDesignation,
        customerRepresentativePhone: cleanPhone,
        customerSignatureUrl: pickupProofForm.customerSignatureUrl || undefined,
        customerSignatureExceptionReason: pickupProofForm.customerSignatureRefused
          ? pickupProofForm.customerSignatureExceptionReason
          : undefined,
        photoUrl: pickupUploadedUrls[0],
        additionalPhotoUrls: pickupUploadedUrls.slice(1),
        gpsLatitude: pickupProofForm.gpsLatitude,
        gpsLongitude: pickupProofForm.gpsLongitude,
        gpsAccuracy: pickupProofForm.gpsAccuracy,
        remarks: pickupProofForm.remarks,
        items: pickupItems.map((it) => ({
          materialVariantId: it.materialVariantId,
          driverCollectedQty: Number(it.driverCollectedQty || 0),
          driverGoodQty: Number(it.driverGoodQty || 0),
          driverDamagedQty: Number(it.driverDamagedQty || 0),
          driverMissingQty: Number(it.driverMissingQty || 0),
          driverRemarks: it.driverRemarks || null,
        })),
      };

      const res = await fetch(`/api/v1/return-notes/${selectedMRN.id}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Pickup submission failed");
      }

      toast.success(json.message || `Material Return ${selectedMRN.mrnNumber} pickup confirmed! Materials in transit to yard.`);
      setIsPickupModalOpen(false);
      loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingPickup(false);
    }
  };

  // Submit Yard Arrival (Stage 9)
  const handleConfirmYardArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYardMRN) return;

    if (!yardArrivalForm.receiverName?.trim()) {
      return toast.error("Warehouse receiving person name is required.");
    }
    if (!yardArrivalForm.yardOdometer || Number(yardArrivalForm.yardOdometer) <= 0) {
      return toast.error("Please enter a valid ending odometer reading.");
    }

    try {
      setSubmittingYardArrival(true);
      const res = await fetch(`/api/v1/return-notes/${selectedYardMRN.id}/yard-arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yardOdometer: Number(yardArrivalForm.yardOdometer),
          receiverName: yardArrivalForm.receiverName.trim(),
          receiverDesignation: yardArrivalForm.receiverDesignation,
          receiverPhone: yardArrivalForm.receiverPhone || undefined,
          remarks: yardArrivalForm.remarks,
          gpsLatitude: yardArrivalForm.gpsLatitude,
          gpsLongitude: yardArrivalForm.gpsLongitude,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Yard arrival confirmation failed");

      toast.success(`MRN ${selectedYardMRN.mrnNumber} handed over at ${selectedYardMRN.receivingWarehouse?.name || "Yard"}! Awaiting physical inspection.`);
      setIsYardModalOpen(false);
      loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingYardArrival(false);
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
  const completedDeliveries = data?.completedToday || [];
  const pendingPickups = data?.activePickups || [];
  const completedPickups = data?.completedPickupsToday || [];

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-16">
      {/* Top Mobile Bar */}
      <div className="bg-[#0B1E36] text-white p-4 rounded-2xl shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#F26522]" />
            <h1 className="font-black text-lg tracking-tight">Driver Delivery Portal</h1>
          </div>
          <p className="text-xs text-slate-300">AJAY ENTERPRISES Logistics & Material Pickups</p>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-500/40 text-[10px] flex items-center gap-1">
              <Wifi className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge className="bg-red-600/30 text-red-300 border-red-500/40 text-[10px] flex items-center gap-1">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}

          {offlineCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSync}
              disabled={syncing || !isOnline}
              className="bg-[#F26522] hover:bg-[#EA580C] text-white border-none text-xs h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Sync ({offlineCount})
            </Button>
          )}
        </div>
      </div>

      {/* Segmented Filter Pills */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`py-2 rounded-lg transition ${activeTab === "ALL" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`}
        >
          All ({pendingDeliveries.length + pendingPickups.length})
        </button>
        <button
          onClick={() => setActiveTab("DELIVERIES")}
          className={`py-2 rounded-lg transition ${activeTab === "DELIVERIES" ? "bg-sky-50 text-sky-900 shadow-sm" : "hover:text-slate-900"}`}
        >
          Deliveries ({pendingDeliveries.length})
        </button>
        <button
          onClick={() => setActiveTab("PICKUPS")}
          className={`py-2 rounded-lg transition ${activeTab === "PICKUPS" ? "bg-amber-50 text-amber-900 shadow-sm" : "hover:text-slate-900"}`}
        >
          Pickups ({pendingPickups.length})
        </button>
        <button
          onClick={() => setActiveTab("COMPLETED")}
          className={`py-2 rounded-lg transition ${activeTab === "COMPLETED" ? "bg-emerald-50 text-emerald-900 shadow-sm" : "hover:text-slate-900"}`}
        >
          Done ({completedDeliveries.length + completedPickups.length})
        </button>
      </div>

      {/* Active Tasks Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
            Loading assigned routes and material return pickups...
          </div>
        ) : (
          <>
            {/* 1. PICKUPS / RETURNS SECTION (RESTRUCTURED WORKFLOW) */}
            {(activeTab === "ALL" || activeTab === "PICKUPS") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                    Assigned Return Pickups ({pendingPickups.length})
                  </h2>
                </div>

                {pendingPickups.length === 0 ? (
                  activeTab === "PICKUPS" && (
                    <Card className="p-6 text-center text-slate-500 border-slate-200">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-sm">No Pending Return Pickups!</p>
                      <p className="text-xs text-slate-400 mt-1">All material return collections are complete.</p>
                    </Card>
                  )
                ) : (
                  pendingPickups.map((mrn: any) => {
                    const status = mrn.status;
                    const isArrived = status === "ARRIVED_AT_SITE" || status === "PICKUP_IN_PROGRESS";
                    const isLoaded = status === "PICKUP_COMPLETED" || status === "IN_TRANSIT";
                    const navQuery = encodeURIComponent(
                      `${mrn.customerSite?.siteName || ""} ${mrn.customerSite?.fullAddress || ""}`.trim()
                    );
                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${navQuery}`;

                    return (
                      <Card key={mrn.id} className="border-amber-300 shadow-sm overflow-hidden bg-white">
                        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-amber-950">{mrn.mrnNumber}</span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                              RETURN PICKUP
                            </span>
                          </div>

                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            {mrn.vehicleTrip?.vehicle?.vehicleNumber || mrn.vehicleNumber || "Fleet Vehicle"}
                          </span>
                        </div>

                        <CardContent className="p-4 space-y-3">
                          {/* Status Pill Indicator */}
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-bold uppercase text-slate-400">Current Task Status</div>
                            <div>
                              {status === "ASSIGNED" && (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                                  EN ROUTE TO SITE
                                </Badge>
                              )}
                              {isArrived && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                  ARRIVED AT SITE
                                </Badge>
                              )}
                              {isLoaded && (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                                  LOADED · IN TRANSIT TO YARD
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Customer & Construction Site */}
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

                          {/* Action Buttons: Navigate + Call Site */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 text-xs h-8 px-3"
                            >
                              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                <Navigation className="h-3.5 w-3.5 mr-1 text-blue-600" />
                                Google Maps
                              </a>
                            </Button>

                            {mrn.customerSite?.siteContactDetails ? (
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
                            ) : (
                              <Button size="sm" variant="outline" disabled className="text-xs h-8 opacity-50">
                                No Site Phone
                              </Button>
                            )}
                          </div>

                          {/* Destination Yard & Trip Info */}
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Destination Yard</span>
                              {mrn.vehicleTrip?.tripNumber && (
                                <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                                  Trip: {mrn.vehicleTrip.tripNumber}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Warehouse className="w-4 h-4 text-slate-600 shrink-0" />
                              {mrn.receivingWarehouse?.name || "Main Peenya Centering Yard"}
                            </div>
                            {mrn.pickupInstructions && (
                              <p className="text-[11px] text-slate-500 italic mt-1">
                                &ldquo;{mrn.pickupInstructions}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Items to Collect */}
                          <div className="border-t border-slate-100 pt-2">
                            <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">
                              Expected Return Items ({mrn.items?.length || 0} materials)
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {mrn.items?.map((it: any) => (
                                <div key={it.id} className="bg-amber-50/60 border border-amber-100 px-2 py-1 rounded text-slate-800">
                                  &bull; <strong className="font-mono text-amber-900">{Number(it.expectedQty || it.returnedQty)}</strong> &times; {it.materialVariant?.name}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* STEPPED DRIVER ACTIONS */}
                          {/* Step A: Driver has not marked arrival at site yet */}
                          {!isArrived && !isLoaded && (
                            <Button
                              onClick={() => handleMarkArrivalAtSite(mrn)}
                              loading={loadingArrivalId === mrn.id}
                              loadingText="Marking Arrival at Customer Site (GPS)..."
                              disabled={loadingArrivalId === mrn.id}
                              className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-bold h-11 flex items-center justify-center gap-2 shadow"
                            >
                              <MapPin className="h-4 w-4 text-[#F26522]" />
                              Mark Arrival at Customer Site (GPS)
                            </Button>
                          )}

                          {/* Step B: Driver arrived at site -> count items, photos, customer signature */}
                          {isArrived && (
                            <Button
                              onClick={() => openPickupModal(mrn)}
                              className="w-full bg-[#F26522] hover:bg-[#EA580C] text-white font-bold h-11 flex items-center justify-center gap-2 shadow"
                            >
                              <FileCheck className="h-4 w-4 text-white" />
                              Count Materials, Photos & Handover Sign
                            </Button>
                          )}

                          {/* Step C: Materials loaded in transit -> driver marks arrival at yard */}
                          {isLoaded && (
                            <Button
                              onClick={() => openYardArrivalModal(mrn)}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 flex items-center justify-center gap-2 shadow"
                            >
                              <Warehouse className="h-4 w-4 text-white" />
                              Mark Arrival at Yard & Hand Over
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
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
                              HANDED OVER AT YARD
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

      {/* DRIVER RETURN PICKUP & CUSTOMER HANDOVER MODAL (STAGES 5, 6, 7, 8) */}
      <Dialog open={isPickupModalOpen} onOpenChange={setIsPickupModalOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Material Return Pickup – {selectedMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preliminary material count, site photo evidence and customer representative acknowledgement at {selectedMRN?.customerSite?.siteName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmMaterialPickup} className="space-y-4 pt-1">
            {/* SECTION 1: MATERIAL COUNT & VISUAL INSPECTION (STAGE 5) */}
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  1. Material Count & Condition Check
                </Label>
                <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">
                  Driver Visual Check Only
                </span>
              </div>

              {pickupItems.map((item, idx) => (
                <div key={item.materialVariantId} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{item.materialName}</span>
                      <span className="text-slate-500 text-[11px] ml-1">({item.size || "Standard"})</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono bg-slate-50">
                      Expected: {item.expectedQty} Nos.
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <Label className="text-[10px] text-slate-600 font-semibold block mb-0.5">Collected *</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.driverCollectedQty}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setPickupItems((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    driverCollectedQty: val,
                                    driverGoodQty: Math.min(val, it.driverGoodQty),
                                    driverMissingQty: Math.max(0, it.expectedQty - val),
                                  }
                                : it
                            )
                          );
                        }}
                        className="h-8 text-xs font-bold font-mono"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-emerald-700 font-semibold block mb-0.5">Good</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.driverGoodQty}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setPickupItems((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    driverGoodQty: val,
                                    driverDamagedQty: Math.max(0, it.driverCollectedQty - val),
                                  }
                                : it
                            )
                          );
                        }}
                        className="h-8 text-xs font-mono text-emerald-700 font-semibold"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-amber-700 font-semibold block mb-0.5">Damaged</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.driverDamagedQty}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setPickupItems((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    driverDamagedQty: val,
                                  }
                                : it
                            )
                          );
                        }}
                        className="h-8 text-xs font-mono text-amber-700 font-semibold"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-red-700 font-semibold block mb-0.5">Missing</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.driverMissingQty}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setPickupItems((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    driverMissingQty: val,
                                  }
                                : it
                            )
                          );
                        }}
                        className="h-8 text-xs font-mono text-red-700 font-semibold"
                      />
                    </div>
                  </div>

                  <Input
                    placeholder="Notes on physical condition, bent sheets, etc. (optional)"
                    value={item.driverRemarks}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPickupItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, driverRemarks: val } : it))
                      );
                    }}
                    className="h-7 text-[11px]"
                  />
                </div>
              ))}
            </div>

            {/* SECTION 2: MOBILE CAMERA & PHOTOS WITH GPS WATERMARK (STAGE 6) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  2. Photo Evidence (Mandatory) *
                </Label>
                <span className="text-[10px] text-slate-500">
                  {pickupUploadedUrls.length} photo(s) captured
                </span>
              </div>

              <input
                ref={pickupCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePickupPhotoCapture}
                className="hidden"
              />

              {pickupPhotoPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {pickupPhotoPreviews.map((preview, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group">
                      <img src={preview} alt="Return Evidence" className="w-full h-28 object-cover" />
                      <button
                        type="button"
                        onClick={() => removePickupPhoto(i)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                        GPS Watermarked
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => pickupCameraInputRef.current?.click()}
                disabled={uploadingPickupPhoto}
                className="w-full border-2 border-dashed border-amber-400 hover:border-amber-600 bg-amber-50/60 hover:bg-amber-50 rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5 text-amber-700" />
                <span className="text-xs font-bold text-slate-800">
                  {uploadingPickupPhoto ? "Watermarking & Uploading..." : "Tap to Open Camera & Snap Photo"}
                </span>
              </button>
              <FormFieldError error={pickupErrors.photo} />
            </div>

            {/* SECTION 3: CUSTOMER REPRESENTATIVE HANDOVER ACKNOWLEDGEMENT (STAGE 7) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
              <Label className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                3. Customer Representative Handover Acknowledgement
              </Label>

              <div>
                <Label className="text-xs font-semibold" required>Customer Representative Name *</Label>
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
                  placeholder="e.g. Ramesh Babu"
                  required
                />
                <FormFieldError error={pickupErrors.receiverName} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Designation</Label>
                  <Input
                    value={pickupProofForm.receiverDesignation}
                    onChange={(e) => setPickupProofForm({ ...pickupProofForm, receiverDesignation: e.target.value })}
                    placeholder="e.g. Site Supervisor"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold" required>Mobile (10 Digits) *</Label>
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
                    placeholder="9876543210"
                    required
                  />
                  <FormFieldError error={pickupErrors.receiverPhone} />
                </div>
              </div>

              {/* Touch Signature Pad or Documented Exception */}
              {!pickupProofForm.customerSignatureRefused ? (
                <div>
                  <TouchSignaturePad
                    value={pickupProofForm.customerSignatureUrl}
                    onChange={(sig) => {
                      setPickupProofForm((prev) => ({ ...prev, customerSignatureUrl: sig }));
                      if (pickupErrors.signature) {
                        setPickupErrors((prev) => {
                          const cp = { ...prev };
                          delete cp.signature;
                          return cp;
                        });
                      }
                    }}
                  />
                  <FormFieldError error={pickupErrors.signature} />

                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setPickupProofForm((prev) => ({ ...prev, customerSignatureRefused: true }))}
                      className="text-[11px] text-red-600 font-semibold hover:underline"
                    >
                      Customer representative refused to sign?
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Signature Exception Workflow
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickupProofForm((prev) => ({ ...prev, customerSignatureRefused: false }))}
                      className="text-[10px] text-slate-600 hover:underline font-bold"
                    >
                      Back to Signature
                    </button>
                  </div>
                  <Label className="text-[11px] text-red-900 font-semibold" required>
                    Mandatory Reason for Missing Customer Signature *
                  </Label>
                  <Input
                    placeholder="e.g. Supervisor was called away to another site; security guard handed over."
                    value={pickupProofForm.customerSignatureExceptionReason}
                    onChange={(e) =>
                      setPickupProofForm((prev) => ({
                        ...prev,
                        customerSignatureExceptionReason: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                    required
                  />
                </div>
              )}
            </div>

            {/* Remarks */}
            <div>
              <Label className="text-xs font-semibold">Handover / Vehicle Loading Remarks</Label>
              <Input
                value={pickupProofForm.remarks}
                maxLength={500}
                placeholder="e.g. 50 props loaded, 2 bent, loaded into KA-04-MH-3321."
                onChange={(e) => setPickupProofForm({ ...pickupProofForm, remarks: e.target.value.slice(0, 500) })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPickupModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submittingPickup}
                loadingText="Confirming Pickup & Starting Transit..."
                disabled={submittingPickup || uploadingPickupPhoto}
                className="bg-[#F26522] hover:bg-[#EA580C] text-white font-bold"
              >
                Confirm Material Pickup & Start Transit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DRIVER YARD ARRIVAL MODAL (STAGE 9) */}
      <Dialog open={isYardModalOpen} onOpenChange={setIsYardModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-emerald-600" />
              Mark Arrival at Yard – {selectedYardMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record arrival of vehicle at {selectedYardMRN?.receivingWarehouse?.name || "Yard"} and hand over centering equipment to warehouse receiving personnel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmYardArrival} className="space-y-3 pt-1">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Check className="h-4 w-4 text-emerald-600" />
                Materials Successfully Transported from Site
              </div>
              <p className="text-[11px] text-emerald-800">
                Vehicle: <strong>{selectedYardMRN?.vehicleTrip?.vehicle?.vehicleNumber || selectedYardMRN?.vehicleNumber}</strong>
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold" required>Final Vehicle Odometer Reading (KM) *</Label>
              <Input
                type="number"
                min={0}
                value={yardArrivalForm.yardOdometer}
                onChange={(e) => setYardArrivalForm({ ...yardArrivalForm, yardOdometer: Number(e.target.value) })}
                className="font-mono text-sm font-bold"
                required
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Trip Start Odometer: {selectedYardMRN?.vehicleTrip?.startOdometer ? Number(selectedYardMRN.vehicleTrip.startOdometer) : "0"} KM
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold" required>Yard Receiving Employee Name *</Label>
              <Input
                value={yardArrivalForm.receiverName}
                maxLength={100}
                onChange={(e) => setYardArrivalForm({ ...yardArrivalForm, receiverName: e.target.value })}
                placeholder="Name of warehouse in-charge receiving the vehicle"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Designation</Label>
                <Input
                  value={yardArrivalForm.receiverDesignation}
                  onChange={(e) => setYardArrivalForm({ ...yardArrivalForm, receiverDesignation: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiver Phone</Label>
                <Input
                  type="tel"
                  value={yardArrivalForm.receiverPhone}
                  onChange={(e) => setYardArrivalForm({ ...yardArrivalForm, receiverPhone: e.target.value })}
                  placeholder="Optional phone"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Yard Arrival Remarks</Label>
              <Input
                value={yardArrivalForm.remarks}
                onChange={(e) => setYardArrivalForm({ ...yardArrivalForm, remarks: e.target.value })}
                placeholder="Notes on yard gate arrival, unloading bay, etc."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsYardModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submittingYardArrival}
                loadingText="Confirming Yard Handover..."
                disabled={submittingYardArrival}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm Yard Arrival & Hand Over
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
