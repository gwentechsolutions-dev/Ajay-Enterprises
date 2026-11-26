import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getDefaultPortalForRole, isRouteAllowedForRole } from "@/lib/portal-routing";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  if (pathname && !isRouteAllowedForRole(session.role, pathname)) {
    redirect(getDefaultPortalForRole(session.role));
  }

  return <AppShell user={session}>{children}</AppShell>;
}
