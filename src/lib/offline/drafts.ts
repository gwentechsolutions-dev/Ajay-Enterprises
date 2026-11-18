/**
 * INVENTRA Mobile Offline Draft & Synchronization Engine
 * Supports local draft persistence for delivery personnel and warehouse staff
 * when network connectivity is lost at construction sites or remote yards.
 */

export interface OfflineDraft<T = any> {
  idempotencyKey: string; // Client-generated UUIDv7 or timestamped token
  documentType: "DELIVERY_NOTE" | "RETURN_NOTE" | "EVIDENCE";
  title: string;
  payload: T;
  userId?: string; // Driver / user isolation
  capturedAt?: string; // Physical capture time at site
  createdAt: string;
  updatedAt: string;
  syncStatus: "draft" | "pending_sync" | "syncing" | "synced" | "failed";
  status?: "draft" | "pending_sync" | "syncing" | "synced" | "failed"; // Alias for UI ergonomics
  lastSyncAttempt?: string;
  syncError?: string;
  serverDocumentId?: string;
  serverDocumentNumber?: string;
}

const STORAGE_KEY = "inventra_offline_drafts_v1";

/**
 * Retrieves offline drafts saved in browser local storage, optionally scoped to the authenticated user
 */
export function getOfflineDrafts(userId?: string): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const drafts: OfflineDraft[] = raw ? JSON.parse(raw) : [];
    if (userId) {
      return drafts.filter((d) => !d.userId || d.userId === userId);
    }
    return drafts;
  } catch (e) {
    console.error("Failed to read offline drafts from storage", e);
    return [];
  }
}

/**
 * Alias for getOfflineDrafts returning items with .status for convenience
 */
export function getOfflineQueue(userId?: string): OfflineDraft[] {
  const drafts = getOfflineDrafts(userId);
  return drafts.map((d) => ({
    ...d,
    status: d.syncStatus,
  }));
}

/**
 * Saves or updates an offline draft
 */
export function saveOfflineDraft(draft: OfflineDraft): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEY);
  const drafts: OfflineDraft[] = raw ? JSON.parse(raw) : [];
  const existingIdx = drafts.findIndex((d) => d.idempotencyKey === draft.idempotencyKey);

  if (existingIdx >= 0) {
    drafts[existingIdx] = { ...draft, updatedAt: new Date().toISOString() };
  } else {
    drafts.push({
      ...draft,
      createdAt: draft.createdAt || new Date().toISOString(),
      capturedAt: draft.capturedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

/**
 * Queues an offline operation to be synchronized when connection resumes
 */
export function queueOfflineDraft<T = any>(params: {
  documentType: OfflineDraft["documentType"];
  title?: string;
  payload: T;
  userId?: string;
}): string {
  const idempotencyKey = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  const draft: OfflineDraft<T> = {
    idempotencyKey,
    documentType: params.documentType,
    title: params.title || `${params.documentType} Offline Handover`,
    payload: params.payload,
    userId: params.userId,
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending_sync",
    status: "pending_sync",
  };
  saveOfflineDraft(draft);
  return idempotencyKey;
}

/**
 * Removes a synced or discarded draft
 */
export function removeOfflineDraft(idempotencyKey: string): void {
  if (typeof window === "undefined") return;
  const drafts = getOfflineDrafts().filter((d) => d.idempotencyKey !== idempotencyKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

/**
 * Updates draft sync status safely
 */
export function setDraftSyncStatus(
  idempotencyKey: string,
  status: OfflineDraft["syncStatus"],
  error?: string,
  serverData?: { id: string; number: string }
): void {
  if (typeof window === "undefined") return;
  const drafts = getOfflineDrafts();
  const draft = drafts.find((d) => d.idempotencyKey === idempotencyKey);
  if (draft) {
    draft.syncStatus = status;
    draft.status = status;
    draft.lastSyncAttempt = new Date().toISOString();
    if (error) draft.syncError = error;
    if (serverData) {
      draft.serverDocumentId = serverData.id;
      draft.serverDocumentNumber = serverData.number;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }
}

/**
 * Synchronizes all pending drafts using the provided dispatch callback
 */
export async function syncPendingDrafts(
  syncFn: (draft: OfflineDraft) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined") return { synced: 0, failed: 0 };
  const drafts = getOfflineDrafts();
  const pending = drafts.filter((d) => d.syncStatus === "pending_sync" || d.syncStatus === "failed");

  let synced = 0;
  let failed = 0;

  for (const draft of pending) {
    setDraftSyncStatus(draft.idempotencyKey, "syncing");
    try {
      const success = await syncFn(draft);
      if (success) {
        removeOfflineDraft(draft.idempotencyKey);
        synced++;
      } else {
        setDraftSyncStatus(draft.idempotencyKey, "failed", "Sync handler returned false");
        failed++;
      }
    } catch (err: any) {
      setDraftSyncStatus(draft.idempotencyKey, "failed", err.message || "Network exception during sync");
      failed++;
    }
  }

  return { synced, failed };
}
