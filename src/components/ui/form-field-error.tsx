"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormFieldErrorProps {
  error?: string | null | undefined;
  id?: string;
  className?: string;
}

/**
 * Reusable field-level validation error message component with icon and accessible ARIA attributes.
 */
export function FormFieldError({ error, id, className }: FormFieldErrorProps) {
  if (!error) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-1.5 text-xs font-medium text-red-600 mt-1 animate-in fade-in-50 duration-150",
        className
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" aria-hidden="true" />
      <span className="leading-snug">{error}</span>
    </p>
  );
}
