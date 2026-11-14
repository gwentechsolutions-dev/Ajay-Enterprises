"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TableSkeleton renders stable <tr> and <td> rows with animated skeletons.
 * Prevents layout shift during client-side or server-side data fetching.
 */
export function TableSkeleton({
  columns = 6,
  rows = 5,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-1/3", "w-3/5"];

  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={rIdx}
          className={cn("animate-pulse border-b border-slate-100", className)}
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <Skeleton
                className={cn(
                  "h-4 rounded",
                  widths[(rIdx + cIdx) % widths.length]
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * KPICardSkeleton renders a grid of metrics/KPI cards with placeholder blocks.
 */
export function KPICardSkeleton({
  count = 4,
  columnsClassName = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
}: {
  count?: number;
  columnsClassName?: string;
}) {
  return (
    <div className={cn("grid gap-4", columnsClassName)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="mt-3">
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * PageSkeleton renders a comprehensive page placeholder with header,
 * KPI summary cards, filter toolbar, and table structure.
 */
export function PageSkeleton({
  title = "Loading...",
  subtitle = "Retrieving operational data...",
  showCards = true,
  cardCount = 4,
  tableColumns = 6,
  tableRows = 6,
}: {
  title?: string;
  subtitle?: string;
  showCards?: boolean;
  cardCount?: number;
  tableColumns?: number;
  tableRows?: number;
}) {
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-8 w-56 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-4 w-72 mt-1 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      {showCards && <KPICardSkeleton count={cardCount} />}

      {/* Filter Toolbar Skeleton */}
      <Card className="border-slate-200 shadow-none bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      </Card>

      {/* Table Skeleton */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold">
              <tr>
                {Array.from({ length: tableColumns }).map((_, i) => (
                  <th key={i} className="py-3 px-4">
                    <Skeleton className="h-3.5 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <TableSkeleton columns={tableColumns} rows={tableRows} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/**
 * InlineLoader renders a compact spinner and label for tabs, drawers, and modal panels.
 */
export function InlineLoader({
  label = "Loading...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-slate-400 gap-2",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-[#F26522]" />
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

/**
 * FormSkeleton renders placeholder inputs for modals and drawers.
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 py-2">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
