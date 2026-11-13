"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function ForgotPasswordPage() {
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [resetTokenInfo, setResetTokenInfo] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setIsLoading(true);
    setServerError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error?.message || "Failed to process request");
        return;
      }

      setSuccessMsg(data.message);
      if (data.data?.resetUrl) {
        setResetTokenInfo(data.data.resetUrl);
      }
      toast.success("Instructions processed");
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
          Password Recovery
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Enter your registered email to reset your INVENTRA password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-6">
          {successMsg && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <div className="ml-2">
                <p className="font-semibold text-emerald-950">Request Submitted</p>
                <AlertDescription className="text-emerald-800 mt-1">
                  {successMsg}
                </AlertDescription>
                {resetTokenInfo && (
                  <div className="mt-3 p-3 bg-white border border-emerald-300 rounded-lg text-xs">
                    <p className="font-semibold text-slate-900 mb-1">Dev Test Reset Link:</p>
                    <Link
                      href={resetTokenInfo}
                      className="text-accent-600 underline font-mono break-all hover:text-accent-700"
                    >
                      {resetTokenInfo}
                    </Link>
                  </div>
                )}
              </div>
            </Alert>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {!successMsg && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  Registered Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@ajayenterprises.com"
                    className="pl-9"
                    error={!!errors.email}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full bg-primary-900 hover:bg-primary-800 text-white font-semibold h-11"
              >
                Send Recovery Link
              </Button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

