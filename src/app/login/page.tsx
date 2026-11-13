"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [needSetup, setNeedSetup] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      loginIdentifier: "",
      password: "",
    },
  });

  // Check on mount if system requires setup
  React.useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginIdentifier: "__check__", password: "__check__" }),
        });
        const data = await res.json();
        if (data.needSetup) {
          setNeedSetup(true);
        }
      } catch {
        // Ignore check error
      }
    }
    checkSetup();
  }, []);

  const onSubmit = async (values: LoginInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needSetup) {
          setNeedSetup(true);
          router.push("/setup");
          return;
        }
        setServerError(data.error?.message || "Invalid login credentials");
        return;
      }

      toast.success("Welcome back! Redirecting to dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <Toaster position="top-right" richColors />

      {/* Left Branding Showcase (Navy) */}
      <div className="flex-1 bg-[#0B1E36] text-white p-8 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative background graphic */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center gap-3 z-10">
          <div className="h-11 w-11 rounded-xl bg-white/10 p-1.5 flex items-center justify-center border border-white/10 shadow-sm">
            <Image
              src="/assets/inventra-logo.png"
              alt="INVENTRA Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">INVENTRA</h1>
            <p className="text-xs font-semibold text-accent-400 tracking-wider uppercase">
              AJAY ENTERPRISES
            </p>
          </div>
        </div>

        {/* Hero Narrative */}
        <div className="my-12 md:my-0 z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-500/15 border border-accent-500/30 px-3 py-1 text-xs font-medium text-accent-400 mb-6">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Enterprise Centering & Rental ERP</span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Construction material custody, rental accruals & double-entry financial control.
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Built specifically for AJAY ENTERPRISES. Manage telescopic props, scaffolding sheets, and beam sapan across active builder sites with auditable GPS delivery proof.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              <p className="text-white font-semibold">Strict Double-Entry GL</p>
              <p>Automated journal sync with inventory</p>
            </div>
            <div>
              <p className="text-white font-semibold">GPS Camera Proof</p>
              <p>Indisputable site custody verification</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500 z-10">
          &copy; {new Date().getFullYear()} AJAY ENTERPRISES. All rights reserved.
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign In to INVENTRA
            </h2>
            <p className="text-sm text-slate-500">
              Enter your corporate credentials to access your assigned portal
            </p>
          </div>

          {/* Setup Callout if Needed */}
          {needSetup && (
            <Alert variant="warning" className="border-accent-200 bg-accent-50/70">
              <AlertCircle className="h-4 w-4 text-accent-600" />
              <div className="ml-2">
                <p className="font-semibold text-accent-900">Initial Setup Required</p>
                <AlertDescription className="text-accent-800 mt-1">
                  The system has no configured owner account yet.
                </AlertDescription>
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-600 hover:text-accent-700 mt-2 underline underline-offset-2"
                >
                  Complete Owner Account Setup <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Alert>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Login Identifier */}
            <div className="space-y-1.5">
              <Label htmlFor="loginIdentifier" required>
                Email or Username
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="loginIdentifier"
                  type="text"
                  placeholder="admin@ajayenterprises.com or username"
                  className="pl-9"
                  error={!!errors.loginIdentifier}
                  {...register("loginIdentifier")}
                />
              </div>
              {errors.loginIdentifier && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.loginIdentifier.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  className="pl-9"
                  error={!!errors.password}
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full bg-primary-900 hover:bg-primary-800 text-white font-semibold h-11"
            >
              Sign In to INVENTRA
            </Button>
          </form>

          {/* Security Notice */}
          <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            Protected by role-based record scoping and append-only audit logging.
          </div>
        </div>
      </div>
    </div>
  );
}

