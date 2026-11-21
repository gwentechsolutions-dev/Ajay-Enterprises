import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-extrabold text-[#0B1E36]">404</h1>
        <h2 className="text-2xl font-bold text-slate-800 mt-4">Page Not Found</h2>
        <p className="text-slate-600 mt-2 text-sm">
          The requested page could not be found or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0B1E36] hover:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F26522]"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
