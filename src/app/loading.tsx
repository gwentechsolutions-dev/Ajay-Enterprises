import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#F26522]" />
        <span className="text-sm font-medium text-slate-600">Loading INVENTRA ERP...</span>
      </div>
    </div>
  );
}
