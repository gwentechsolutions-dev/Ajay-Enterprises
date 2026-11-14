"use client";

import * as React from "react";
import { z } from "zod";
import {
  parseApiValidationErrors,
  validateWithZod,
  ParsedValidationErrors,
} from "./validation-mapper";
import { scrollToFirstInvalidField } from "./auto-scroll";

export interface UseFormValidationOptions {
  containerRef?: React.RefObject<HTMLElement | null>;
  onValidationError?: (errors: ParsedValidationErrors) => void;
}

/**
 * Universal hook for form validation, field highlighting, error summaries, and auto-scrolling.
 * Works seamlessly with both standard React state forms and React Hook Form.
 */
export function useFormValidation(options: UseFormValidationOptions = {}) {
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  const containerRef = options.containerRef;

  const clearFieldError = React.useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  const setFieldError = React.useCallback((fieldName: string, message: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: message,
    }));
  }, []);

  const clearErrors = React.useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  /**
   * Evaluates API responses (status 400, 422, etc.).
   * Extracts field errors, sets them into state, and automatically scrolls to the first invalid field.
   * Returns `true` if response was successful, `false` if errors were found.
   */
  const handleApiResponse = React.useCallback(
    (
      res: { ok: boolean; status?: number },
      data: any,
      overrideContainer?: HTMLElement | null
    ): boolean => {
      if (res.ok && data?.success !== false) {
        clearErrors();
        return true;
      }

      const parsed = parseApiValidationErrors(data);
      setFieldErrors(parsed.fieldErrors);
      setGeneralError(parsed.generalError || null);

      if (options.onValidationError) {
        options.onValidationError(parsed);
      }

      const activeContainer =
        overrideContainer || containerRef?.current || null;

      // Auto-scroll to the first invalid field
      if (Object.keys(parsed.fieldErrors).length > 0) {
        scrollToFirstInvalidField(parsed.fieldErrors, {
          container: activeContainer,
          focus: true,
        });
      }

      return false;
    },
    [clearErrors, containerRef, options]
  );

  /**
   * Performs client-side schema validation using Zod.
   * If invalid, updates state and scrolls to the first invalid field.
   * Returns `true` if valid, `false` otherwise.
   */
  const validateClientSide = React.useCallback(
    <T>(
      schema: z.ZodSchema<T>,
      data: unknown,
      overrideContainer?: HTMLElement | null
    ): boolean => {
      const result = validateWithZod(schema, data);

      if (result.isValid) {
        clearErrors();
        return true;
      }

      setFieldErrors(result.fieldErrors);
      setGeneralError(result.generalError || null);

      const activeContainer =
        overrideContainer || containerRef?.current || null;

      if (Object.keys(result.fieldErrors).length > 0) {
        scrollToFirstInvalidField(result.fieldErrors, {
          container: activeContainer,
          focus: true,
        });
      }

      return false;
    },
    [clearErrors, containerRef]
  );

  /**
   * Helper that produces standard props for an Input or Combobox.
   */
  const getFieldProps = React.useCallback(
    (fieldName: string) => {
      const errorMsg = fieldErrors[fieldName];
      const hasError = Boolean(errorMsg);

      return {
        id: fieldName,
        name: fieldName,
        error: hasError,
        "aria-invalid": hasError ? (true as const) : undefined,
        "aria-describedby": hasError ? `${fieldName}-error` : undefined,
      };
    },
    [fieldErrors]
  );

  /**
   * Scrolls to and focuses a specific field by name.
   */
  const scrollToField = React.useCallback(
    (fieldName: string, overrideContainer?: HTMLElement | null) => {
      scrollToFirstInvalidField([fieldName], {
        container: overrideContainer || containerRef?.current || null,
        focus: true,
      });
    },
    [containerRef]
  );

  const errorCount =
    Object.keys(fieldErrors).length + (generalError ? 1 : 0);

  return {
    fieldErrors,
    generalError,
    errorCount,
    hasErrors: errorCount > 0,
    setFieldError,
    clearFieldError,
    clearErrors,
    handleApiResponse,
    validateClientSide,
    getFieldProps,
    scrollToField,
  };
}
