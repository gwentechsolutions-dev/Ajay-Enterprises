import { PageSkeleton } from "@/components/ui/loading-states";

export default function AuthenticatedLoading() {
  return (
    <div className="animate-in fade-in duration-100">
      <PageSkeleton />
    </div>
  );
}
