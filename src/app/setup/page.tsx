"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setupOwnerSchema, SetupOwnerInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Phone, Lock, Key, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function SetupPage() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupOwnerInput>({
    resolver: zodResolver(setupOwnerSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "owner",
      mobile: "",
      password: "",
      confirmPassword: "",
      setupSecret: "INVENTRA_INIT_2026",
    },
  });

  const onSubmit = async (values: SetupOwnerInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/v1/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error?.message || "Failed to initialize owner account.");
        return;
      }

      toast.success("Initial setup complete! Welcome to INVENTRA.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <Toaster position="top-right" richColors />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Brand Header */}
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-[#0B1E36] p-2 flex items-center justify-center shadow-md">
            <Image
              src="/assets/inventra-logo.png"
              alt="INVENTRA Logo"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
        </div>
        <h2 className="text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          INVENTRA – First-Run Setup Wizard
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Initialize the primary Super Admin / Owner account for <span className="font-semibold text-slate-800">AJAY ENTERPRISES</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-2xl space-y-6">
          <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-4 text-xs text-blue-900 leading-relaxed flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950">Foundation Initialization</p>
              <p className="mt-0.5 text-blue-800">
                This setup establishes the root Owner credentials, seeds the role-based permission matrix, creates the AJAY ENTERPRISES business profile, and configures the default Indian financial year and document series.
              </p>
            </div>
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" required>
                  Owner Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    placeholder="e.g. Ajay Sharma"
                    className="pl-9"
                    error={!!errors.name}
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username">
                  Username (Optional)
                </Label>
                <Input
                  id="username"
                  placeholder="e.g. owner"
                  error={!!errors.username}
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-xs text-red-600 mt-1">{errors.username.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  Official Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="owner@ajayenterprises.com"
                    className="pl-9"
                    error={!!errors.email}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Mobile */}
              <div className="space-y-1.5">
                <Label htmlFor="mobile" required>
                  Indian Mobile Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="mobile"
                    placeholder="9876543210"
                    className="pl-9"
                    error={!!errors.mobile}
                    {...register("mobile")}
                  />
                </div>
                {errors.mobile && (
                  <p className="text-xs text-red-600 mt-1">{errors.mobile.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" required>
                  Root Password
                </Label>
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
                  <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" required>
                  Confirm Password
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
            </div>

            {/* Setup Secret Key */}
            <div className="space-y-1.5">
              <Label htmlFor="setupSecret" required>
                First-Run Setup Key
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="setupSecret"
                  placeholder="INVENTRA_INIT_2026"
                  className="pl-9 font-mono text-xs"
                  error={!!errors.setupSecret}
                  {...register("setupSecret")}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Default authorization key for initial local deployment: <code className="bg-slate-100 px-1 py-0.5 rounded">INVENTRA_INIT_2026</code>
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full bg-accent-500 hover:bg-accent-600 text-white font-semibold h-11"
              >
                Initialize Platform & Enter INVENTRA
              </Button>
            </div>
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Already set up? Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

