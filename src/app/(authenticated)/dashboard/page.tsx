import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  GitBranch,
  Warehouse,
  Users,
  FileDigit,
  History,
  ArrowRight,
  ShieldAlert,
  Boxes,
  Truck,
  Receipt,
  BookOpen,
  HardHat,
  Lock,
  Sparkles,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();

  const [
    userCount,
    branchCount,
    warehouseCount,
    seriesCount,
    auditCount,
    company,
  ] = await Promise.all([
    db.user.count(),
    db.branch.count(),
    db.warehouse.count(),
    db.documentSeries.count({ where: { isActive: true } }),
    db.auditEvent.count(),
    db.companyProfile.findFirst(),
  ]);

  const isOnboardingIncomplete = !company?.isOnboardingComplete || !company.primaryMobile;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Executive Overview
            </h1>
            <Badge variant="outline" className="text-xs bg-primary-50 text-primary-900 border-primary-200 font-semibold">
              Phase 1 Platform
            </Badge>
          </div>
          <p className="text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-800">{session?.name}</span> ({session?.role}). Managing <span className="font-semibold text-slate-800">AJAY ENTERPRISES</span> centering material rental operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/company">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" /> Company Profile
            </Button>
          </Link>
          <Link href="/users">
            <Button size="sm" className="gap-1.5 text-xs bg-primary-900 hover:bg-primary-800">
              <Users className="h-3.5 w-3.5" /> Manage Users
            </Button>
          </Link>
        </div>
      </div>

      {/* Onboarding Notice Banner */}
      {isOnboardingIncomplete && (
        <Alert variant="warning" className="border-amber-200 bg-amber-50/80">
          <ShieldAlert className="h-4 w-4 text-amber-700" />
          <div className="flex-1 ml-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-amber-950 text-sm">Action Required: Complete Company Profile</p>
              <AlertDescription className="text-amber-800 text-xs">
                AJAY ENTERPRISES profile has not been fully completed. Please configure registered addresses, GSTIN, and bank accounts for official documents.
              </AlertDescription>
            </div>
            <Link href="/company">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs">
                Complete Profile <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* Core Platform Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Users */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Users & Roles
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-slate-900">{userCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Configured accounts</p>
          </CardContent>
        </Card>

        {/* Branches */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Branches
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <GitBranch className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-slate-900">{branchCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Active business branches</p>
          </CardContent>
        </Card>

        {/* Warehouses / Yards */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Yards & Storage
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-50 text-accent-600 flex items-center justify-center">
              <Warehouse className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-slate-900">{warehouseCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Material storage yards</p>
          </CardContent>
        </Card>

        {/* Document Series */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Doc Series
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <FileDigit className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-slate-900">{seriesCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Sequential counters</p>
          </CardContent>
        </Card>

        {/* Audit Log Events */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Audit Events
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <History className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-slate-900">{auditCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Append-only log entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Administrative Control Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Platform Modules */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Platform Foundation Services</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company Profile Link */}
            <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-lg bg-primary-50 text-primary-900">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">AJAY ENTERPRISES Profile</h3>
                    <p className="text-xs text-slate-500">Legal, Tax & Bank Setup</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Manage GST registrations, registered offices, multiple bank accounts, UPI IDs, authorized signatories, and stamp images.
                </p>
              </div>
              <Link href="/company">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Configure Company <ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
              </Link>
            </Card>

            {/* Branches & Yards */}
            <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Branches & Yards</h3>
                    <p className="text-xs text-slate-500">Operating Locations</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Define central business branches and warehouse yards with contact persons, mobile numbers, and GPS coordinates for dispatch points.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/branches" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Branches
                  </Button>
                </Link>
                <Link href="/warehouses" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Warehouses
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Users & RBAC */}
            <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Users & RBAC</h3>
                    <p className="text-xs text-slate-500">Granular Access Control</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Manage internal users across 9 roles (Owner, Accountant, Warehouse Staff, Drivers) with record-level scope boundaries.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/users" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Users
                  </Button>
                </Link>
                <Link href="/roles" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Permission Matrix
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Document Series & Audits */}
            <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-800">
                    <FileDigit className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Document Series</h3>
                    <p className="text-xs text-slate-500">Atomic Numbering & Logs</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Configure sequential numbering prefixes (DN, MRN, Invoices, Vouchers) and inspect tamper-evident system audit events.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/document-settings" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Doc Settings
                  </Button>
                </Link>
                <Link href="/audit-logs" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Audit Logs
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Right 1 Col: Development Roadmap & Upcoming Phases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Development Roadmap</h2>
            <Badge variant="secondary" className="text-[10px] text-slate-500">
              Dependency Order
            </Badge>
          </div>

          <Card className="p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">Phase 0: Architecture & Foundation</p>
                  <p className="text-slate-500">20 Permanent Rules, PostGIS Schema, AGENTS.md</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="h-7 w-7 rounded-full bg-primary-900 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-primary-950">Phase 1: Core Platform</p>
                    <Badge variant="default" className="text-[9px] bg-primary-900 py-0">Active</Badge>
                  </div>
                  <p className="text-slate-500">Auth, RBAC, Company Profile, Document Series, Auditing</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-slate-100 opacity-60">
                <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-xs">
                  <Lock className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-700">Phase 2: Master Data & Stock Ledger</p>
                  <p className="text-slate-500">Customer Multi-Sites, DN/MRN Movements, Mobile PWA</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-slate-100 opacity-60">
                <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-xs">
                  <Lock className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-700">Phase 3: Rental Billing Engine</p>
                  <p className="text-slate-500">Daily Accruals, Independent Date Rules, Monthly Bills</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-slate-100 opacity-60">
                <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-xs">
                  <Lock className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-700">Phase 4: Double-Entry General Ledger</p>
                  <p className="text-slate-500">Chart of Accounts, Trial Balance, P&L, GST Returns</p>
                </div>
              </div>

              <div className="flex items-start gap-3 opacity-60">
                <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-xs">
                  <Lock className="h-3 w-3" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-700">Phase 5–7: Integrations & Heatmap</p>
                  <p className="text-slate-500">FYN E-Way Bill, WhatsApp, GPS Heatmap, Cutover</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

