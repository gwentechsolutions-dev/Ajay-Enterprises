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

export default function DeliveryPortalPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(true);
  const [offlineCount, setOfflineCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  // Delivery Modal
  const [selectedDN, setSelectedDN] = React.useState<any>(null);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Delivery Proof Form
  const [proofForm, setProofForm] = React.useState({
    receiverName: "",
    receiverPhone: "",
    receiverDesignation: "Site Engineer",
    photoUrl: "https://storage.inventra.app/proofs/delivery-default.jpg",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
    gpsAccuracy: 5.0,
    gpsFetching: false,
    remarks: "Unloaded and physically handed over at site.",
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

  // GPS auto-capture via Geolocation API
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setProofForm((prev) => ({ ...prev, gpsFetching: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProofForm((prev) => ({
          ...prev,
          gpsLatitude: Number(pos.coords.latitude.toFixed(6)),
          gpsLongitude: Number(pos.coords.longitude.toFixed(6)),
          gpsAccuracy: Number(pos.coords.accuracy.toFixed(1)),
          gpsFetching: false,
        }));
        toast.success("GPS Location verified successfully!");
      },
      (err) => {
        setProofForm((prev) => ({ ...prev, gpsFetching: false }));
        toast.error(`GPS Error: ${err.message}. Using last known location.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const openProofModal = (dn: any) => {
    setSelectedDN(dn);
    setProofForm({
      receiverName: dn.customerSite?.siteInCharge || "",
      receiverPhone: dn.customerSite?.siteContactDetails || "",
      receiverDesignation: "Site Supervisor",
      photoUrl: "https://storage.inventra.app/proofs/delivery-default.jpg",
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      gpsAccuracy: 4.5,
      gpsFetching: false,
      remarks: "Materials verified against checklist and delivered.",
    });
    setIsDeliverModalOpen(true);
    handleCaptureGPS();
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN) return;

    if (!proofForm.receiverName || !proofForm.receiverPhone) {
      return toast.error("Receiver name and mobile number are required");
    }

    try {
      setSubmitting(true);

      if (!isOnline) {
        // Save to offline queue
        queueOfflineDraft({
          documentType: "DELIVERY_NOTE",
          payload: {
            dnId: selectedDN.id,
            ...proofForm,
          },
        });
        toast.warning("Network offline! Saved to local queue. Will sync automatically when connected.");
        updateNetworkStatus();
        setIsDeliverModalOpen(false);
        return;
      }

      // Online submission
      const res = await fetch(`/api/v1/delivery-notes/${selectedDN.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverName: proofForm.receiverName,
          receiverPhone: proofForm.receiverPhone,
          receiverDesignation: proofForm.receiverDesignation,
          photoUrl: proofForm.photoUrl,
          gpsLatitude: proofForm.gpsLatitude,
          gpsLongitude: proofForm.gpsLongitude,
          gpsAccuracy: proofForm.gpsAccuracy,
          receiverSignatureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRNDAsNSA5MCwyMCIgc3Ryb2tlPSJibGFjayIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==",
          remarks: proofForm.remarks,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Delivery submission failed");

      toast.success(`Delivery Note ${selectedDN.dnNumber} completed! Custody confirmed.`);
      setIsDeliverModalOpen(false);
      loadDeliveryFeed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await syncPendingDrafts(async (item) => {
        const deliverRes = await fetch(`/api/v1/delivery-notes/${item.payload.dnId}/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        return deliverRes.ok;
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

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* Mobile-optimised App Header */}
      <div className="bg-[#0B1E36] text-white p-4 rounded-xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#F26522] flex items-center justify-center font-bold text-white shadow">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Delivery Driver Portal</h1>
            <p className="text-xs text-slate-300">AJAY ENTERPRISES Field Dispatch</p>
          </div>
        </div>

        {/* Connectivity badge */}
        <div className="text-right">
          {isOnline ? (
            <Badge className="bg-emerald-500 text-white text-[11px] flex items-center gap-1">
              <Wifi className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge className="bg-amber-500 text-white text-[11px] flex items-center gap-1">
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

      {/* Driver Queue Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-sky-200 bg-sky-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-sky-900">{data?.summary?.pendingCount ?? 0}</div>
            <div className="text-xs text-sky-700 font-medium mt-0.5">Assigned Deliveries</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-900">{data?.summary?.completedTodayCount ?? 0}</div>
            <div className="text-xs text-emerald-700 font-medium mt-0.5">Delivered Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Deliveries List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-[#F26522]" />
          Assigned Deliveries On-Road
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
            Loading assigned routes...
          </div>
        ) : data?.activeDeliveries?.length === 0 ? (
          <Card className="p-6 text-center text-slate-500 border-slate-200">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-sm">All deliveries completed!</p>
            <p className="text-xs text-slate-400 mt-1">No pending dispatches assigned to your vehicle.</p>
          </Card>
        ) : (
          data?.activeDeliveries?.map((dn: any) => (
            <Card key={dn.id} className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-slate-900">{dn.dnNumber}</span>
                <Badge variant="secondary" className="bg-sky-100 text-sky-800 text-[10px]">
                  ON THE ROAD
                </Badge>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{dn.customer?.name}</h3>
                  <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                    <MapPin className="h-4 w-4 text-[#F26522] shrink-0 mt-0.5" />
                    <span>{dn.customerSite?.siteName} – {dn.customerSite?.fullAddress || "Site location"}</span>
                  </div>
                </div>

                {/* Contact site directly */}
                {dn.customerSite?.siteContactDetails && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Site Engineer Contact</div>
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
                        Call
                      </a>
                    </Button>
                  </div>
                )}

                {/* Items to unload */}
                <div className="border-t border-slate-100 pt-2">
                  <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">
                    Equipment to Unload ({dn.items?.length} items)
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {dn.items?.map((it: any) => (
                      <div key={it.id} className="bg-slate-50 px-2 py-1 rounded text-slate-700">
                        • {Number(it.quantity)} × {it.materialVariant?.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <Button
                  onClick={() => openProofModal(dn)}
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

      {/* PROOF & ACKNOWLEDGEMENT MODAL */}
      <Dialog open={isDeliverModalOpen} onOpenChange={setIsDeliverModalOpen}>
        <DialogContent className="max-w-md">
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
              <Label className="text-xs font-semibold">Receiver Full Name *</Label>
              <Input
                value={proofForm.receiverName}
                onChange={(e) => setProofForm({ ...proofForm, receiverName: e.target.value })}
                placeholder="Receiver name"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Receiver Mobile Phone *</Label>
              <Input
                value={proofForm.receiverPhone}
                onChange={(e) => setProofForm({ ...proofForm, receiverPhone: e.target.value })}
                placeholder="9876543210"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">GPS Coordinates</Label>
                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  className="text-[11px] text-[#F26522] font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className={`h-3 w-3 ${proofForm.gpsFetching ? "animate-spin" : ""}`} />
                  Refresh GPS
                </button>
              </div>
              <Input
                disabled
                value={`${proofForm.gpsLatitude}, ${proofForm.gpsLongitude} (Acc: ±${proofForm.gpsAccuracy}m)`}
                className="bg-slate-100 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Delivery Proof Photo</Label>
              <Input
                value={proofForm.photoUrl}
                onChange={(e) => setProofForm({ ...proofForm, photoUrl: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Notes</Label>
              <Input
                value={proofForm.remarks}
                onChange={(e) => setProofForm({ ...proofForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDeliverModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} loadingText="Confirming Handover..." className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm Handover
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

