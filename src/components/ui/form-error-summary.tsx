"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFieldLabel } from "@/lib/forms/validation-mapper";
import { scrollToFirstInvalidField } from "@/lib/forms/auto-scroll";

export interface FormErrorSummaryProps {
  errors?: Record<string, string> | Array<{ field: string; message: string; label?: string }>;
  generalError?: string | null;
  title?: string;
  onFieldClick?: (fieldName: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Compact, interactive validation error summary box displayed at the top of forms.
 * Clicking any error smoothly scrolls to and focuses the invalid field.
 */
export function FormErrorSummary({
  errors = {},
  generalError,
  title,
  onFieldClick,
  className,
  containerRef,
}: FormErrorSummaryProps) {
  // Normalize errors into a uniform array
  const errorItems = React.useMemo(() => {
    if (Array.isArray(errors)) {
      return errors.map((item) => ({
        field: item.field,
        message: item.message,
        label: item.label || formatFieldLabel(item.field),
      }));
    }

    return Object.entries(errors)
      .filter(([_, msg]) => Boolean(msg))
      .map(([field, message]) => ({
        field,
        message,
        label: formatFieldLabel(field),
      }));
  }, [errors]);

  const totalErrors = errorItems.length + (generalError ? 1 : 0);

  if (totalErrors === 0) return null;

  const handleItemClick = (field: string) => {
    if (onFieldClick) {
      onFieldClick(field);
    } else {
      scrollToFirstInvalidField([field], {
        container: containerRef?.current || null,
        focus: true,
      });
    }
  };

  const defaultTitle =
    totalErrors === 1
      ? "Please correct the following error:"
      : `Please correct the following ${totalErrors} errors:`;

  return (
    <div
      role="alert"
      aria-live="polite"
      tabIndex={-1}
      className={cn(
        "rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm animate-in fade-in-50 duration-200 text-slate-900",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-1 text-red-600 shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-semibold text-red-950 tracking-tight">
            {title || defaultTitle}
          </h4>

          {generalError && (
            <div className="text-xs text-red-800 bg-red-100/70 rounded-md px-2.5 py-1.5 font-medium flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>{generalError}</span>
            </div>
          )}

          {errorItems.length > 0 && (
            <ul className="space-y-1.5 text-xs">
              {errorItems.map(({ field, message, label }) => (
                <li key={field} className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => handleItemClick(field)}
                    className="text-left group text-red-900 hover:text-red-700 focus:outline-none focus:underline font-normal transition-colors"
                  >
                    <span className="font-semibold text-red-950 group-hover:underline">
                      {label}:
                    </span>{" "}
                    <span>{message}</span>
                    <span className="inline-flex items-center ml-1 text-red-500 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                      <ArrowRight className="h-3 w-3 inline" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
