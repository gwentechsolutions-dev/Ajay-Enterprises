import { db } from "@/lib/db";

export interface DemoStatusResponse {
  isLoaded: boolean;
  status: "LOADED" | "NOT_LOADED";
  activeRun: {
    id: string;
    runNumber: string;
    totalRecords: number;
    moduleCounts: Record<string, number>;
    createdAt: string;
    generatedBy?: string | null;
  } | null;
  history: Array<{
    id: string;
    runNumber: string;
    status: string;
    totalRecords: number;
    createdAt: string;
    clearedAt?: string | null;
  }>;
}

export async function getDemoDataStatus(): Promise<DemoStatusResponse> {
  const activeRun = await db.demoDataRun.findFirst({
    where: { status: "ACTIVE" },
    include: {
      generatedBy: { select: { name: true, role: true } },
    },
  });

  const history = await db.demoDataRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      runNumber: true,
      status: true,
      totalRecords: true,
      createdAt: true,
      clearedAt: true,
    },
  });

  let parsedCounts: Record<string, number> = {};
  if (activeRun?.moduleCounts) {
    try {
      parsedCounts = JSON.parse(activeRun.moduleCounts);
    } catch {
      parsedCounts = {};
    }
  }

  return {
    isLoaded: !!activeRun,
    status: activeRun ? "LOADED" : "NOT_LOADED",
    activeRun: activeRun
      ? {
          id: activeRun.id,
          runNumber: activeRun.runNumber,
          totalRecords: activeRun.totalRecords,
          moduleCounts: parsedCounts,
          createdAt: activeRun.createdAt.toISOString(),
          generatedBy: activeRun.generatedBy?.name || null,
        }
      : null,
    history: history.map((h) => ({
      id: h.id,
      runNumber: h.runNumber,
      status: h.status,
      totalRecords: h.totalRecords,
      createdAt: h.createdAt.toISOString(),
      clearedAt: h.clearedAt ? h.clearedAt.toISOString() : null,
    })),
  };
}
