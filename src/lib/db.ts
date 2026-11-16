import { PrismaClient } from "@prisma/client";

function getResolvedDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  let url = rawUrl;
  // If connection points to Supabase pooler on port 5432 (session mode),
  // automatically route to port 6543 (transaction mode) to avoid EMAXCONNSSESSION in serverless
  if (url.includes("pooler.supabase.com:5432")) {
    url = url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
  }

  // Ensure pgbouncer=true is present when using the 6543 transaction pooler
  if (url.includes(":6543") && !url.includes("pgbouncer=true")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}pgbouncer=true`;
  }

  // In production / serverless environments, allow up to 5 concurrent connections per container
  // to prevent Promise.all queries from queuing sequentially on a single socket.
  if (process.env.NODE_ENV === "production" && !url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=5`;
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const resolvedUrl = getResolvedDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always store on globalThis so serverless containers and dev hot-reloads reuse the instance
globalForPrisma.prisma = db;


