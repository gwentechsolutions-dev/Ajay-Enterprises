/**
 * Statutory E-Way Bill Provider Factory
 * Operating Business: AJAY ENTERPRISES
 */

import { EWayBillProvider, EwbProviderName } from "./types";
import { WhiteBooksProvider } from "./providers/whitebooks";
import { FynProviderAdapter } from "./providers/fyn/adapter";
import { getSystemEwbConfig } from "./config";
import { db } from "@/lib/db";

// Singleton provider instances
let whiteBooksInstance: WhiteBooksProvider | null = null;
let fynInstance: FynProviderAdapter | null = null;

export function getProvider(name?: EwbProviderName): EWayBillProvider {
  const targetProvider = name || getSystemEwbConfig().activeProvider;

  if (targetProvider === "FYN") {
    if (!fynInstance) {
      fynInstance = new FynProviderAdapter();
    }
    return fynInstance;
  }

  // Default to WhiteBooks (Primary GSP)
  if (!whiteBooksInstance) {
    whiteBooksInstance = new WhiteBooksProvider();
  }
  return whiteBooksInstance;
}

/**
 * Resolves the appropriate provider based on an existing E-Way Bill record.
 * Guarantees that records generated through WhiteBooks never accidentally route to FYN, and vice versa.
 */
export async function getProviderForEwbNumber(ewbNumber: string): Promise<EWayBillProvider> {
  const ewb = await db.eWayBill.findUnique({
    where: { ewbNumber },
    select: { provider: true, fynReferenceId: true },
  });

  if (!ewb) {
    // If not found in DB, default to active system provider
    return getProvider();
  }

  // If explicitly tagged as FYN or has fynReferenceId without WHITEBOOKS provider tag
  if (ewb.provider === "FYN" || (ewb.fynReferenceId && ewb.provider !== "WHITEBOOKS")) {
    return getProvider("FYN");
  }

  return getProvider("WHITEBOOKS");
}
