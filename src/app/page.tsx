import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDefaultPortalForRole } from "@/lib/portal-routing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const userCount = await db.user.count();
    if (userCount === 0) {
      redirect("/setup");
    }

    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    const destination = getDefaultPortalForRole(session.role);
    redirect(destination);
  } catch (err: any) {
    // If it's a Next.js redirect exception, rethrow it so navigation succeeds
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login");
  }
}
