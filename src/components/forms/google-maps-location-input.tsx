"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/ui/form-field-error";
import {
  extractCoordinatesFromUrlString,
  isAllowlistedGoogleMapsUrl,
  isValidCoordinatePair,
} from "@/lib/geo/google-maps";
import {
  MapPin,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

export interface GoogleMapsLocationInputProps {
  id?: string;
  value?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  onChange: (data: { latitude: number | null; longitude: number | null; mapsUrl: string }) => void;
  error?: string;
  onErrorClear?: () => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function GoogleMapsLocationInput({
  id = "siteMapsUrl",
  value = "",
  latitude,
  longitude,
  onChange,
  error: externalError,
  onErrorClear,
  disabled = false,
  required = false,
  className = "",
}: GoogleMapsLocationInputProps) {
  const [inputUrl, setInputUrl] = React.useState(value || "");
  const [isLoading, setIsLoading] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string | null>(null);
  const [isReplacing, setIsReplacing] = React.useState(false);

  // Sync value if prop changes
  React.useEffect(() => {
    if (value !== undefined && value !== inputUrl && !isReplacing) {
      setInputUrl(value);
    }
  }, [value, isReplacing, inputUrl]);

  const hasCoordinates =
    latitude !== null &&
    latitude !== undefined &&
    latitude !== "" &&
    longitude !== null &&
    longitude !== undefined &&
    longitude !== "" &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const numLat = hasCoordinates ? Number(latitude) : null;
  const numLng = hasCoordinates ? Number(longitude) : null;

  const currentError = externalError || internalError;

  const handleClear = () => {
    setInputUrl("");
    setInternalError(null);
    onErrorClear?.();
    setIsReplacing(false);
    onChange({ latitude: null, longitude: null, mapsUrl: "" });
  };

  const processUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setInternalError(null);
      onErrorClear?.();
      return;
    }

    setInternalError(null);
    onErrorClear?.();

    // Check allowlisted domain first
    if (!isAllowlistedGoogleMapsUrl(trimmed)) {
      setInternalError(
        "Invalid Google Maps link. Please paste a valid link (e.g. https://maps.app.goo.gl/... or https://maps.google.com/...)"
      );
      return;
    }

    // 1. Fast client-side extraction if coordinates are directly in the URL
    const clientCoords = extractCoordinatesFromUrlString(trimmed);
    if (clientCoords && isValidCoordinatePair(clientCoords.latitude, clientCoords.longitude)) {
      onChange({
        latitude: clientCoords.latitude,
        longitude: clientCoords.longitude,
        mapsUrl: trimmed,
      });
      setIsReplacing(false);
      return;
    }

    // 2. Server-side redirect resolution for shortened or indirect URLs
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/geo/resolve-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg =
          json.error?.message ||
          "Could not detect GPS coordinates from this link. Please ensure the link points to a specific pinned location.";
        setInternalError(msg);
        return;
      }

      const { latitude: resolvedLat, longitude: resolvedLng } = json.data;
      if (isValidCoordinatePair(resolvedLat, resolvedLng)) {
        onChange({
          latitude: resolvedLat,
          longitude: resolvedLng,
          mapsUrl: trimmed,
        });
        setIsReplacing(false);
      } else {
        setInternalError("Detected coordinates are outside valid geographic range (-90 to 90, -180 to 180).");
      }
    } catch (err: any) {
      setInternalError(err.message || "Failed to resolve Google Maps link. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    if (internalError) setInternalError(null);
    onErrorClear?.();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      setInputUrl(pasted);
      processUrl(pasted);
    }
  };

  const handleBlur = () => {
    if (inputUrl && !hasCoordinates) {
      processUrl(inputUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processUrl(inputUrl);
    }
  };

  // If coordinates exist and not currently editing/replacing the link, display the preview card
  if (hasCoordinates && !isReplacing) {
    return (
      <div className={`space-y-1.5 ${className}`} data-field="mapsUrl" data-field-container="gpsCoordinates">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#F26522]" />
            Site Location (Google Maps GPS)
            {required && <span className="text-red-500">*</span>}
          </Label>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Location successfully detected</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-950 flex items-center gap-2">
              <span className="bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                Lat: {numLat?.toFixed(6)}
              </span>
              <span className="bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                Lng: {numLng?.toFixed(6)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-200">
            {numLat && numLng && (
              <a
                href={`https://www.google.com/maps?q=${numLat},${numLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded transition-colors"
                title="Preview location on Google Maps in a new tab"
              >
                <span>View on Maps</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setIsReplacing(true);
              }}
              className="h-7 text-[11px] bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Replace Link
            </Button>
          </div>
        </div>

        {/* Hidden inputs to guarantee presence in traditional DOM serialization if needed */}
        <input type="hidden" name="gpsLatitude" value={numLat || ""} />
        <input type="hidden" name="gpsLongitude" value={numLng || ""} />
      </div>
    );
  }

  // Active Input Mode (No coordinates yet or user clicked "Replace Link")
  return (
    <div className={`space-y-1.5 ${className}`} data-field="mapsUrl" data-field-container="gpsCoordinates">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} required={required} className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-[#F26522]" />
          Google Maps Location Link
        </Label>
        {isReplacing && hasCoordinates && (
          <button
            type="button"
            onClick={() => {
              setIsReplacing(false);
              setInternalError(null);
            }}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline flex items-center gap-1"
          >
            Cancel and keep detected location
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          id={id}
          name="mapsUrl"
          type="url"
          placeholder="Paste Google Maps sharing link here"
          value={inputUrl}
          disabled={disabled || isLoading}
          error={!!currentError}
          aria-invalid={!!currentError}
          aria-describedby={currentError ? `${id}-error` : `${id}-helper`}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="pr-20"
        />

        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputUrl && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Clear link"
              aria-label="Clear link"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || isLoading || !inputUrl.trim()}
            onClick={() => processUrl(inputUrl)}
            className="h-7 px-2 text-xs text-[#0B1E36] hover:bg-slate-100"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F26522]" />
            ) : (
              "Extract"
            )}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-1.5 text-[11px] text-[#F26522] animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Resolving Google Maps location & extracting GPS coordinates...</span>
        </div>
      )}

      {currentError ? (
        <FormFieldError id={`${id}-error`} error={currentError} />
      ) : (
        <p id={`${id}-helper`} className="text-[11px] text-slate-500 leading-tight">
          Open the location in Google Maps → Share → Copy link → Paste it here.
        </p>
      )}

      {/* Hidden inputs to guarantee presence in traditional DOM serialization if needed */}
      <input type="hidden" name="gpsLatitude" value={numLat || ""} />
      <input type="hidden" name="gpsLongitude" value={numLng || ""} />
    </div>
  );
}
