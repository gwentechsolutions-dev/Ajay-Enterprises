import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // API routes verify session directly via getSession(); skip redundant remote auth roundtrip in middleware
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder")) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request: {
                headers: requestHeaders,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      });

      // Refreshes session if expired
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isAuthPage =
        pathname === "/login" ||
        pathname === "/setup" ||
        pathname === "/forgot-password" ||
        pathname === "/reset-password";

      const isPublicPage =
        isAuthPage ||
        pathname.startsWith("/slips/") ||
        (pathname.startsWith("/rentals/agreements/") && pathname.includes("/acknowledge"));

      const isPublicApi =
        pathname.startsWith("/api/v1/auth/login") ||
        pathname.startsWith("/api/v1/auth/setup") ||
        pathname.startsWith("/api/v1/auth/forgot-password") ||
        pathname.startsWith("/api/v1/auth/reset-password");

      // Redirect unauthenticated web page visits to /login preserving intended destination
      if (!user && !isPublicPage && !isPublicApi && !pathname.startsWith("/api/")) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const target = pathname + (request.nextUrl.search || "");
        if (target !== "/" && target !== "/dashboard") {
          url.searchParams.set("redirect", target);
        }
        return NextResponse.redirect(url);
      }
    } catch (e) {
      // In development or when offline, fallback gracefully
      console.warn("Middleware auth check warning:", e);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets/
     * - static image formats
     */
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

