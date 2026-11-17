import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isExecutiveRole, getDefaultPortalForRole } from "@/lib/portal-routing";
import { OwnerDashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Non-executive operational roles (Delivery Personnel, Warehouse Staff, Labour Supervisor)
  // are strictly redirected to their dedicated operational portals.
  if (!isExecutiveRole(session.role)) {
    redirect(getDefaultPortalForRole(session.role));
  }

  return <OwnerDashboardClient />;
}
