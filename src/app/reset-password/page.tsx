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
import { Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Toaster, toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

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
    if (token) setValue("token", token);
  }, [token, setValue]);

  const onSubmit = async (values: ResetPasswordInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error?.message || "Failed to reset password");
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Missing password reset token. Please request a new recovery link.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-6">
      {success ? (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-semibold text-emerald-950">Password Updated</p>
            <AlertDescription className="text-emerald-800 mt-1">
              Your password has been securely reset. Redirecting to sign in...
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
            isLoading={isLoading}
            className="w-full bg-primary-900 hover:bg-primary-800 text-white font-semibold h-11"
          >
            Update Password & Sign In
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
          <div className="h-12 w-12 rounded-xl bg-[#0B1E36] p-1.5 flex items-center justify-center">
            <Image
              src="/assets/inventra-logo.png"
              alt="INVENTRA Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-slate-900 tracking-tight">
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

