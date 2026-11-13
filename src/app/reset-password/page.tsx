"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { Toaster, toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const code = searchParams.get("code") || "";

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [isAuthorized, setIsAuthorized] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      newPassword: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        // If there is an authorization code from Supabase PKCE flow, exchange it
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && isMounted) {
            setIsAuthorized(true);
            setIsVerifying(false);
            return;
          }
        }

        // Check if token param was passed
        if (token) {
          setValue("token", token);
          if (isMounted) {
            setIsAuthorized(true);
            setIsVerifying(false);
            return;
          }
        }

        // Check if an existing session or hash fragment exists
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session && isMounted) {
          setIsAuthorized(true);
          setIsVerifying(false);
          return;
        }

        // Check for hash parameters in URL (Supabase Implicit flow)
        if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          if (isMounted) {
            setIsAuthorized(true);
            setIsVerifying(false);
            return;
          }
        }

        if (isMounted) {
          setIsVerifying(false);
        }
      } catch {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    // Subscribe to Supabase auth state change for PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (isMounted) {
          setIsAuthorized(true);
          setIsVerifying(false);
        }
      }
    });

    checkAuthSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [code, token, setValue, supabase]);

  const onSubmit = async (values: ResetPasswordInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // 1. Try updating via Supabase client directly if session exists
      const { error: clientError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      // 2. Also inform server API to update/audit log
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (clientError && !res.ok) {
        setServerError(clientError.message || data.error?.message || "Failed to reset password");
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="bg-white py-12 px-6 shadow-sm border border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#0B1E36]" />
        <p className="text-sm font-medium text-slate-600">Verifying security token...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-5">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The password reset link is invalid, expired, or has already been used. Please request a new recovery link.
          </AlertDescription>
        </Alert>
        <div className="pt-2 text-center">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-semibold h-10 rounded-lg text-sm transition-colors"
          >
            <KeyRound className="h-4 w-4" />
            Request New Recovery Link
          </Link>
          <div className="mt-4">
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-6">
      {success ? (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-semibold text-emerald-950">Password Updated Successfully</p>
            <AlertDescription className="text-emerald-800 mt-1">
              Your password has been securely updated. Redirecting to sign in...
            </AlertDescription>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 mt-3"
            >
              Sign In Now <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <input type="hidden" {...register("token")} />

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" required>
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••••••"
                className="pl-9"
                disabled={isLoading}
                error={!!errors.newPassword}
                {...register("newPassword")}
              />
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-600 mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" required>
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                className="pl-9"
                disabled={isLoading}
                error={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-semibold h-11 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Update Password & Sign In</span>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-right" richColors />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-[#0B1E36] p-2 flex items-center justify-center shadow-md">
            <Image
              src="/assets/inventra-logo.png"
              alt="INVENTRA Logo"
              width={44}
              height={44}
              className="object-contain"
              priority
            />
          </div>
        </div>
        <h2 className="text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          Set New Password
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Create a secure new password for your INVENTRA account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <React.Suspense fallback={<div className="p-8 text-center text-slate-400">Loading form...</div>}>
          <ResetPasswordForm />
        </React.Suspense>
      </div>
    </div>
  );
}
