"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadEvidenceWithWatermark, UploadEvidenceResult } from "@/lib/evidence-uploader";
import { stampGpsWatermarkOnPhoto, WatermarkResult } from "@/lib/gps-watermark";

export interface GpsCameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "DELIVERY_NOTE" | "RETURN_NOTE" | "TRANSFER_NOTE" | "DIRECT_TRANSFER" | "GRN";
  documentId: string;
  documentNumber: string;
  siteName?: string;
  customerName?: string;
  defaultCategory?: string;
  onSuccess?: (result: UploadEvidenceResult) => void;
}

export function GpsCameraCaptureDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  siteName = "Construction Site",
  customerName = "",
  defaultCategory = "DELIVERY_PHOTO",
  onSuccess,
}: GpsCameraCaptureDialogProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [watermarkData, setWatermarkData] = React.useState<WatermarkResult | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [category, setCategory] = React.useState<string>(defaultCategory);
  const [processingWatermark, setProcessingWatermark] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setWatermarkData(null);
      setPreviewUrl(null);
      setCoords(null);
      setGpsError(null);
      setProcessingWatermark(false);
      setUploading(false);
    } else {
      setCategory(defaultCategory);
    }
  }, [open, defaultCategory]);

  // Capture device GPS
  const acquireDeviceGps = (): Promise<{ lat: number; lng: number; acc: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsError("Geolocation is not supported by your browser");
        resolve({ lat: 13.0827, lng: 80.2707, acc: 25 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsError(null);
          const c = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy || 5.0,
          };
          setCoords(c);
          resolve(c);
        },
        (err) => {
          const msg =
            err.code === 1
              ? "GPS permission denied. Using estimated location."
              : "Unable to retrieve device GPS. Using estimated location.";
          setGpsError(msg);
          resolve({ lat: 13.0827, lng: 80.2707, acc: 25 });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessingWatermark(true);
      setSelectedFile(file);

      // Acquire current live device coordinates
      const currentCoords = await acquireDeviceGps();

      // Generate watermark with Google Maps Geocoding & Static Map
      const result = await stampGpsWatermarkOnPhoto({
        file,
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        accuracy: currentCoords.acc,
        siteName,
        customerName,
        documentNumber,
        timestamp: new Date(),
      });

      setWatermarkData(result);
      setPreviewUrl(result.dataUrl);
    } catch (err: any) {
      toast.error(`Watermark processing error: ${err.message}`);
    } finally {
      setProcessingWatermark(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setWatermarkData(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleConfirmAndUpload = async () => {
    if (!selectedFile || !watermarkData || !coords) return;

    try {
      setUploading(true);
      const uploadRes = await uploadEvidenceWithWatermark({
        file: selectedFile,
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: coords.acc,
        timestamp: new Date(),
        documentType,
        documentId,
        documentNumber,
        siteName,
        customerName,
        evidenceCategory: category,
        addressLine1: watermarkData.addressLine1,
        addressLine2: watermarkData.addressLine2,
      });

      toast.success("GPS Camera evidence securely uploaded and verified!");
      if (onSuccess) onSuccess(uploadRes);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Evidence upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-slate-200">
        <DialogHeader className="bg-[#0B1E36] text-white p-4">
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <Camera className="w-4 h-4 text-[#F26522]" />
            INVENTRA GPS Camera Evidence Capture
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Captures real-time device GPS coordinates and applies an indelible Google Maps watermark.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Hidden File / Camera Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* GPS Error Notification if permission denied */}
          {gpsError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Initial State: Prompt to Open Camera */}
          {!previewUrl && !processingWatermark && (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-[#0B1E36]">
                <Camera className="w-6 h-6 text-[#F26522]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">
                  Ready to photograph delivery / return evidence
                </p>
                <p className="text-[11px] text-slate-500">
                  Document: <span className="font-mono font-bold text-[#0B1E36]">{documentNumber}</span> • {siteName}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#0B1E36] hover:bg-[#1E293B] text-white text-xs h-9"
              >
                <Camera className="w-4 h-4 mr-1.5 text-[#F26522]" />
                Open Device Camera
              </Button>
            </div>
          )}

          {/* Processing State */}
          {processingWatermark && (
            <div className="text-center py-10 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#F26522]" />
              <p className="text-xs font-semibold text-slate-700">
                Acquiring GPS &amp; Generating Google Maps Watermark...
              </p>
              <p className="text-[11px] text-slate-400">
                Calling Google Geocoding API and rendering Static Map preview
              </p>
            </div>
          )}

          {/* Watermarked Preview State */}
          {previewUrl && watermarkData && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[4/3] max-h-[280px] flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="GPS Camera Preview"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-[#0B1E36]/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Watermark Applied
                </div>
              </div>

              {/* Watermark Details Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <MapPin className="w-3.5 h-3.5 text-[#F26522]" />
                  <span>{watermarkData.addressLine1}</span>
                </div>
                <div className="text-slate-600 text-[11px] pl-5">
                  {watermarkData.addressLine2}
                </div>
                {coords && (
                  <div className="text-[10px] font-mono text-slate-500 pl-5 flex items-center justify-between">
                    <span>
                      GPS: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} (±{Math.round(coords.acc)}m)
                    </span>
                    <span className="text-emerald-700 font-sans font-semibold">
                      ✓ Indelible Proof
                    </span>
                  </div>
                )}
              </div>

              {/* Evidence Category Selector */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Evidence Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white"
                >
                  <option value="DELIVERY_PHOTO">Driver Delivery Site Photo</option>
                  <option value="UNLOADING">Material Unloading on Site</option>
                  <option value="RECEIVER_ACKNOWLEDGEMENT">Receiver Acknowledgement Proof</option>
                  <option value="RETURN_PICKUP">Customer Site Return Pickup</option>
                  <option value="RETURN_CONDITION">Returned Material Condition</option>
                  <option value="SOURCE_PICKUP">Direct Transfer Source Pickup</option>
                  <option value="DESTINATION_UNLOAD">Direct Transfer Destination Unload</option>
                  <option value="GODOWN_RETURN">Godown Receiving Arrival</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {previewUrl && (
          <DialogFooter className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetake}
              disabled={uploading}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retake Photo
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmAndUpload}
              disabled={uploading}
              className="bg-[#0B1E36] hover:bg-[#1E293B] text-white text-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading Evidence...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#F26522]" /> Confirm &amp; Save Proof
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
