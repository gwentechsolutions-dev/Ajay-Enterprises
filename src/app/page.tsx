import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

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

    redirect("/dashboard");
  } catch (err: any) {
    // If it's a Next.js redirect exception, rethrow it so navigation succeeds
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login");
  }
}
