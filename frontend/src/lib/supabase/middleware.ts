import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeGetUser } from "./safe-auth";

/**
 * Combined Middleware
 * ===================
 * Runs before every matched request to:
 *   1. Detect tenant from subdomain → set x-tenant-slug header
 *   2. Rewrite subdomain routes to /t/[slug]/... for Next.js routing
 *   3. Refresh Supabase auth session (with cross-domain cookies)
 *   4. Protect /dashboard routes
 *
 * Cross-domain SSO:
 *   Cookies are scoped to `.ticoclass.com` so a session created at
 *   root domain works on all subdomains (thaynam.ticoclass.com, etc.)
 */

// ── Cookie Domain (inlined for Edge compatibility) ─────────────────────────

function getCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const host = rootDomain.split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return undefined;
  return host.startsWith(".") ? host : `.${host}`;
}

// ── Tenant Detection (inlined for Edge compatibility) ──────────────────────

const TENANT_HEADER = "x-tenant-slug";

const IGNORED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "mail", "localhost",
]);

function getTenantSlug(host: string | null): string | null {
  if (!host) return null;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const hostWithoutPort = host.split(":")[0];
  const rootWithoutPort = rootDomain.split(":")[0];

  if (hostWithoutPort === rootWithoutPort) return null;

  const suffix = `.${rootWithoutPort}`;
  if (!hostWithoutPort.endsWith(suffix)) return null;

  const subdomain = hostWithoutPort.slice(0, -suffix.length);

  if (IGNORED_SUBDOMAINS.has(subdomain)) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) return null;

  return subdomain;
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if Supabase not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  // ── Tenant Detection ──────────────────────────────────────
  const host = request.headers.get("host");
  const tenantSlug = getTenantSlug(host);
  const cookieDomain = getCookieDomain();

  // ── Build initial response ────────────────────────────────
  let response: NextResponse;

  if (tenantSlug) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${tenantSlug}${pathname}`;
    response = NextResponse.rewrite(url, { request });
    response.headers.set(TENANT_HEADER, tenantSlug);
    request.headers.set(TENANT_HEADER, tenantSlug);
  } else {
    response = NextResponse.next({ request });
  }

  // ── Supabase Session Refresh (cross-domain cookies) ───────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          if (tenantSlug) {
            const url = request.nextUrl.clone();
            url.pathname = `/t/${tenantSlug}${pathname}`;
            response = NextResponse.rewrite(url, { request });
            response.headers.set(TENANT_HEADER, tenantSlug);
          } else {
            response = NextResponse.next({ request });
          }

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              // Cross-subdomain SSO: scope cookies to root domain
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            }),
          );
        },
      },
    },
  );

  const user = await safeGetUser(supabase);

  // ── Route Protection (root domain only) ───────────────────
  if (!tenantSlug) {
    // Dev affordance: skip the dashboard auth redirect in development so
    // the UI is reviewable without a working Supabase. Production strictly
    // redirects unauthenticated visitors to /login.
    if (
      !user &&
      pathname.startsWith("/dashboard") &&
      process.env.NODE_ENV !== "development"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }

    if (
      user &&
      (pathname === "/login" || pathname === "/register")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
