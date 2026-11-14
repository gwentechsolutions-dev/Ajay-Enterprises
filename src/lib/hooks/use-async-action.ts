"use client";

import * as React from "react";
import { toast } from "sonner";

export interface AsyncActionOptions<TResult> {
  successMessage?: string | ((data: TResult) => string);
  errorMessage?: string | ((error: any) => string);
  onSuccess?: (data: TResult) => void;
  onError?: (error: any) => void;
}

/**
 * useAsyncAction is a robust, reusable hook for executing asynchronous tasks
 * with immediate visual loading state, duplicate submission prevention, and
 * Sonner toast notification handling.
 */
export function useAsyncAction<TArgs extends any[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: AsyncActionOptions<TResult>
) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<any | null>(null);
  const [data, setData] = React.useState<TResult | null>(null);

  const execute = React.useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (isLoading) return; // Prevent double submission
      setIsLoading(true);
      setError(null);

      try {
        const result = await action(...args);
        setData(result);

        if (options?.successMessage) {
          const msg =
            typeof options.successMessage === "function"
              ? options.successMessage(result)
              : options.successMessage;
          toast.success(msg);
        }

        options?.onSuccess?.(result);
        return result;
      } catch (err: any) {
        setError(err);
        const errMsg =
          typeof options?.errorMessage === "function"
            ? options.errorMessage(err)
            : options?.errorMessage || err?.message || "Operation failed";
        toast.error(errMsg);
        options?.onError?.(err);
      } finally {
        setIsLoading(false);
      }
    },
    [action, isLoading, options]
  );

  return {
    execute,
    isLoading,
    error,
    data,
    setIsLoading,
  };
}
