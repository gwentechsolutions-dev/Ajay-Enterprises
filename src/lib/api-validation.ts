import { NextResponse } from "next/server";
import { z } from "zod";
import { formatFieldLabel, normalizeFieldPath } from "./forms/validation-mapper";

/**
 * Converts Zod validation issues into a human-friendly single message.
 * e.g. "Receiver Mobile Phone: Must be a valid 10-digit Indian mobile number"
 */
export function formatZodErrorMessage(issues: z.ZodIssue[]): string {
  if (!issues || issues.length === 0) return "Please review the form requirements and provide all necessary information.";
  const messages = issues.slice(0, 3).map((issue) => {
    const fieldPath = normalizeFieldPath(issue.path);
    const label = fieldPath ? formatFieldLabel(fieldPath) : "Field";
    let issueMsg = issue.message;
    if (issueMsg === "Required" || (issue.code === "invalid_type" && (issue as any).received === "undefined")) {
      issueMsg = "This field is required";
    } else if (issue.code === "invalid_type" && (issue as any).received === "nan") {
      issueMsg = "Must be a valid number";
    }
    return `${label}: ${issueMsg}`;
  });
  const remaining = issues.length - messages.length;
  const suffix = remaining > 0 ? ` (+${remaining} more issue${remaining > 1 ? "s" : ""})` : "";
  return `${messages.join(" • ")}${suffix}`;
}

/**
 * Standard HTTP 422 validation error response builder for INVENTRA API routes.
 * Ensures the `message` property contains the specific offending field and requirement,
 * rather than a vague "Validation failed".
 */
export function validationErrorResponse(error: z.ZodError | { issues: z.ZodIssue[] } | any) {
  const issues: z.ZodIssue[] = Array.isArray(error?.issues)
    ? error.issues
    : Array.isArray(error)
    ? error
    : [];
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
