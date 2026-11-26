import { cache } from "react";
import { createClient as createServerSupabaseClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { db } from "./db";

const USER_CACHE_TTL_MS = 15_000;
const userProfileCache = new Map<string, { user: SessionUser; expiresAt: number }>();

export function invalidateUserSessionCache(supabaseIdOrEmail?: string): void {
  if (!supabaseIdOrEmail) {
    userProfileCache.clear();
    return;
  }
  userProfileCache.delete(supabaseIdOrEmail);
}

export interface SessionUser {
  id: string;
  supabaseId?: string | null;
  userCode: string;
  name: string;
  email: string;
  mobile?: string | null;
  role: string;
  scope: string;
  preferredLanguage?: string;
  branchId?: string | null;
  warehouseId?: string | null;
}

export const SESSION_COOKIE_NAME = "inventra_session";

/**
 * Retrieves the currently authenticated user from the active Supabase Auth session
 * and joins with the INVENTRA database user profile and role permissions.
 */
const getSessionInternal = cache(async (): Promise<SessionUser | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

  if (!isConfigured) {
    // Development / fallback mode: query first active owner or session header if available
    try {
      const user = await db.user.findFirst({
        where: { isActive: true },
        select: {
          id: true,
          supabaseId: true,
          userCode: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          scope: true,
          preferredLanguage: true,
          branchId: true,
          warehouseId: true,
          isActive: true,
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        supabaseId: user.supabaseId,
        userCode: user.userCode,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        scope: user.scope,
        preferredLanguage: user.preferredLanguage || "en",
        branchId: user.branchId,
        warehouseId: user.warehouseId,
      };
    } catch {
      return null;
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return null;
    }

    const cacheKey = authUser.id;
    const cached = userProfileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    // Join with INVENTRA application User record
    const user = await db.user.findFirst({
      where: {
        OR: [
          { supabaseId: authUser.id },
          { email: authUser.email?.toLowerCase().trim() },
        ],
      },
      select: {
        id: true,
        supabaseId: true,
        userCode: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        scope: true,
        preferredLanguage: true,
        branchId: true,
        warehouseId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      userProfileCache.delete(cacheKey);
      return null;
    }

    // If supabaseId wasn't previously linked, link it asynchronously
    if (!user.supabaseId && authUser.id) {
      db.user.update({
        where: { id: user.id },
        data: { supabaseId: authUser.id },
      }).catch(() => {});
    }

    const sessionUser: SessionUser = {
      id: user.id,
      supabaseId: authUser.id,
      userCode: user.userCode,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      scope: user.scope,
      preferredLanguage: user.preferredLanguage || "en",
      branchId: user.branchId,
      warehouseId: user.warehouseId,
    };

    userProfileCache.set(cacheKey, {
      user: sessionUser,
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });

    return sessionUser;
  } catch (err) {
    console.error("getSession error:", err);
    return null;
  }
});

export async function getSession(): Promise<SessionUser | null> {
  return getSessionInternal();
}
