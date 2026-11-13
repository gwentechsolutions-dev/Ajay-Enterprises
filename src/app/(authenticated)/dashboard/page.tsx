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
  Users2,
  Layers,
  ClipboardCheck,
  Factory,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();

  const [
    userCount,
    branchCount,
    warehouseCount,
    seriesCount,
    auditCount,
    customerCount,
    variantCount,
    movementCount,
    company,
  ] = await Promise.all([
    db.user.count(),
    db.branch.count(),
    db.warehouse.count(),
    db.documentSeries.count({ where: { isActive: true } }),
    db.auditEvent.count(),
    db.customer.count(),
    db.materialVariant.count(),
    db.inventoryMovement.count(),
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
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold">
              Phase 2 Active
            </Badge>
          </div>
          <p className="text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-800">{session?.name}</span> ({session?.role}). Managing <span className="font-semibold text-slate-800">AJAY ENTERPRISES</span> centering material rental operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory">
            <Button size="sm" className="gap-1.5 text-xs bg-[#0B1E36] hover:bg-[#071424] text-white">
              <Boxes className="h-3.5 w-3.5" /> Inventory Intelligence
            </Button>
          </Link>
          <Link href="/movements">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5" /> Movements Ledger
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

      {/* Core Platform & Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/customers" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Customers</span>
              <Users2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{customerCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Multi-site accounts</div>
          </Card>
        </Link>

        <Link href="/materials" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Materials</span>
              <Layers className="h-4 w-4 text-[#F26522]" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{variantCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Active variants</div>
          </Card>
        </Link>

        <Link href="/movements" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Movements</span>
              <Truck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{movementCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Immutable ledger entries</div>
          </Card>
        </Link>

        <Link href="/warehouses" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Yards</span>
              <Warehouse className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{warehouseCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Storage warehouses</div>
          </Card>
        </Link>

        <Link href="/users" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Users</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{userCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">RBAC profiles</div>
          </Card>
        </Link>

        <Link href="/audit-logs" className="block">
          <Card className="p-4 hover:border-slate-300 transition-colors bg-white">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Audit Logs</span>
              <History className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">{auditCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Security audit trail</div>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid: Modules & Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Phase 2 Operations & Core Platform */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phase 2 Operations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Phase 2: Master Data & Inventory Management</span>
                <Badge className="bg-emerald-600 text-[10px]">Live</Badge>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-lg bg-orange-50 text-[#F26522]">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Material Master Catalogue</h3>
                      <p className="text-xs text-slate-500">Centering Hierarchy & Rates</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Manage categories, material types (Props, Sheets, Column Boxes), sizes, variants, UOMs, and rental rate versioning history.
                  </p>
                </div>
                <Link href="/materials">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Open Catalogue <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </Link>
              </Card>

              <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Movement Ledger</h3>
                      <p className="text-xs text-slate-500">Immutable Stock History</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Record receipts, customer dispatches, returns, transfers, damage, and opening stock with mathematical derivation.
                  </p>
                </div>
                <Link href="/movements">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View Movement Ledger <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </Link>
              </Card>

              <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                      <Users2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Customers & Construction Sites</h3>
                      <p className="text-xs text-slate-500">Multi-Site Architecture</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Manage unlimited construction sites per customer, site contacts, delivery permissions, and live on-site material custody.
                  </p>
                </div>
                <Link href="/customers">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Manage Customers <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </Link>
              </Card>

              <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-800">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Stock Verification & Audits</h3>
                      <p className="text-xs text-slate-500">Physical Reconciliation</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Conduct warehouse counts, verify expected vs physical quantities, calculate variance, and post automated reconciliation entries.
                  </p>
                </div>
                <Link href="/inventory/audits">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Stock Verification <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Development Roadmap */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Roadmap Status</h2>
            <Badge variant="secondary" className="text-[10px] text-slate-500">
              Phased Execution
            </Badge>
          </div>

          <Card className="p-5 space-y-4 bg-white">
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
                <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-900">Phase 1 & 1.5: Platform & Supabase</p>
                  <p className="text-slate-500">Auth SSR, Session Pooler, RLS, Storage Bucket</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="h-7 w-7 rounded-full bg-[#0B1E36] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-slate-900">Phase 2: Master Data & Stock Ledger</p>
                    <Badge variant="default" className="text-[9px] bg-emerald-600 py-0">Completed</Badge>
                  </div>
                  <p className="text-slate-500">Catalogue, Customers, Multi-Sites, Ledger, Audits</p>
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
