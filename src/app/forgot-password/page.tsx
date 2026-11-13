"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  SendHorizontal,
  RefreshCw,
} from "lucide-react";
import { Toaster, toast } from "sonner";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [successEmail, setSuccessEmail] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error?.message || "Failed to process request. Please try again.");
        return;
      }

      setSuccessEmail(values.email);
      setIsModalOpen(true);
      toast.success("Password recovery link dispatched successfully!");
    } catch {
      setServerError("Network connection error. Please verify your internet and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const email = successEmail || getValues("email");
    if (!email) return;
    await onSubmit({ email });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Toaster position="top-right" richColors />

      {/* SUCCESS CONFIRMATION POPUP MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center sm:items-start">
            <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 text-center sm:text-left">
              Recovery Email Dispatched
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-2 text-center sm:text-left leading-relaxed">
              We have dispatched a secure password reset link to:
              <br />
              <span className="font-semibold text-slate-900 font-mono text-xs bg-slate-100 px-2 py-1 rounded inline-block mt-1">
                {successEmail}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2 mt-2">
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Please check your inbox (and spam/junk folder) within the next few minutes.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Click the button in the email to establish your new INVENTRA password.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>The link is valid for 1 hour for security purposes.</span>
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={isLoading}
              className="w-full sm:w-auto text-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Resending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Resend Link
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full sm:w-auto bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
            >
              Back to Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          Password Recovery
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Enter your registered email to reset your INVENTRA password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl space-y-6">
          {successEmail && !isModalOpen && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-950">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Recovery Email Dispatched</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Instructions have been sent to <span className="font-mono font-semibold">{successEmail}</span>. Check your email to set a new password.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsModalOpen(true)}
                  className="h-8 text-xs border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900"
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="h-8 text-xs border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900"
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Resend
                </Button>
              </div>
            </div>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

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
                  placeholder="owner@ajayenterprises.com"
                  className="pl-9"
                  disabled={isLoading}
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
              disabled={isLoading}
              className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-semibold h-11 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Dispatching Recovery Link...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
                  <span>Send Recovery Link</span>
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
