"use client";

import * as React from "react";
import { Camera, Upload, Sparkles, CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OdometerScanResult {
  odometerKm: number;
  fileUrl?: string | null;
  confidence?: number;
  warnings?: string[];
}

export interface OdometerInputWithScanProps {
  id?: string;
  value: number | string;
  onChange: (value: string) => void;
  vehicleId?: string;
  min?: number;
  max?: number;
  step?: number | string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
  className?: string;
  scanButtonLabel?: string;
  onScanSuccess?: (result: OdometerScanResult) => void;
}

export function OdometerInputWithScan({
  id,
  value,
  onChange,
  vehicleId,
  min = 0,
  max,
  step = "any",
  required = false,
  disabled = false,
  placeholder = "e.g. 45850",
  inputClassName,
  className,
  scanButtonLabel = "Scan Odo",
  onScanSuccess,
}: OdometerInputWithScanProps) {
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [extractedKm, setExtractedKm] = React.useState<number | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scanWarnings, setScanWarnings] = React.useState<string[]>([]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleClearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtractedKm(null);
    setScanError(null);
    setScanWarnings([]);
  };

  const handleScanFile = async (file: File) => {
    if (!file || isScanning || disabled) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsScanning(true);
    setScanError(null);
    setScanWarnings([]);
    setExtractedKm(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scanType", "odometer");
      if (vehicleId) {
        formData.append("vehicleId", vehicleId);
      }

      const res = await fetch("/api/v1/fleet/scan", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to scan odometer image.");
      }

      const data = json.data || {};
      const fields = data.fields || {};
      const warnings: string[] = Array.isArray(data.warnings) ? data.warnings : [];
      setScanWarnings(warnings);

      const rawKm = fields.odometerKm;
      if (rawKm === null || rawKm === undefined || Number.isNaN(Number(rawKm))) {
        const msg =
          warnings[0] ||
          "Could not detect a clear total odometer reading. Please try a closer photo or enter manually.";
        setScanError(msg);
        toast.warning(msg);
        return;
      }

      const numericKm = Math.round(Number(rawKm));
      setExtractedKm(numericKm);
      onChange(String(numericKm));

      const uploadedUrl =
        data.fileUrl || data.odometerFileUrl || data.receiptFileUrl || data.file?.url || null;
      const confidence =
        data.fieldConfidence?.odometerKm != null ? Number(data.fieldConfidence.odometerKm) : undefined;

      onScanSuccess?.({
        odometerKm: numericKm,
        fileUrl: uploadedUrl,
        confidence,
        warnings,
      });

      toast.success(`Odometer reading extracted: ${numericKm.toLocaleString("en-IN")} km`);
    } catch (err: any) {
      const message =
        err?.message || "Could not analyze odometer photo. Please try again or enter manually.";
      setScanError(message);
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleScanFile(file);
    }
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Hidden inputs: rear camera capture on mobile + gallery/file picker */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isScanning}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isScanning}
      />

      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn("font-mono font-bold flex-1 min-w-0", inputClassName)}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isScanning}
          onClick={() => cameraInputRef.current?.click()}
          title="Take photo of odometer and extract reading with DeepSeek AI"
          className="h-9 sm:h-10 px-2.5 shrink-0 border-orange-200 bg-orange-50 text-[#F26522] hover:bg-orange-100 hover:text-[#EA580C] font-semibold text-xs gap-1.5"
        >
          {isScanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          <span className="hidden xs:inline sm:inline">{isScanning ? "Scanning..." : scanButtonLabel}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isScanning}
          onClick={() => fileInputRef.current?.click()}
          title="Attach odometer photo from device"
          className="h-9 sm:h-10 px-2.5 shrink-0 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="sr-only">Attach odometer photo</span>
        </Button>
      </div>

      {/* Scanning / Extracted / Error Feedback Strip */}
      {(isScanning || previewUrl || scanError) && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]",
            isScanning
              ? "border-orange-200 bg-orange-50/70 text-[#B45309]"
              : scanError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50/70 text-emerald-800"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Odometer scan"
                className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              {isScanning ? (
                <div className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-[#F26522] shrink-0 animate-pulse" />
                  <span className="truncate">DeepSeek AI reading odometer...</span>
                </div>
              ) : scanError ? (
                <div className="flex items-start gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                  <span className="break-words">{scanError}</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      AI Extracted:{" "}
                      <strong className="font-mono">
                        {extractedKm != null ? `${extractedKm.toLocaleString("en-IN")} km` : "Verified"}
                      </strong>
                    </span>
                  </div>
                  {scanWarnings.length > 0 && (
                    <div className="text-[10px] text-amber-700 leading-tight">
                      {scanWarnings[0]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isScanning && (
            <button
              type="button"
              onClick={handleClearPreview}
              className="p-0.5 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600 shrink-0"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
