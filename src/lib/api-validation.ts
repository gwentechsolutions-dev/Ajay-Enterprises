import { NextResponse } from "next/server";
import { z } from "zod";
import { formatFieldLabel, normalizeFieldPath } from "./forms/validation-mapper";

/**
 * Converts Zod validation issues into a human-friendly single message.
 * e.g. "Receiver Mobile Phone: Must be a valid 10-digit Indian mobile number"
 */
export function formatZodErrorMessage(issues: z.ZodIssue[]): string {
  if (!issues || issues.length === 0) return "Validation failed";
  const first = issues[0];
  const fieldPath = normalizeFieldPath(first.path);
  const label = fieldPath ? formatFieldLabel(fieldPath) : "Field";
  const remaining = issues.length - 1;
  const suffix = remaining > 0 ? ` (+${remaining} more issue${remaining > 1 ? "s" : ""})` : "";
  return `${label}: ${first.message}${suffix}`;
}

/**
 * Standard HTTP 422 validation error response builder for INVENTRA API routes.
 * Ensures the `message` property contains the specific offending field and requirement,
 * rather than a vague "Validation failed".
 */
export function validationErrorResponse(error: z.ZodError | { issues: z.ZodIssue[] }) {
  const issues = "issues" in error ? error.issues : [];
  const message = formatZodErrorMessage(issues);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message,
        details: issues,
      },
    },
    { status: 422 }
  );
}
