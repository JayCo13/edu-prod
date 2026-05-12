/**
 * Tenant Context Utilities
 * ========================
 * Parses subdomain from the request host header to determine
 * which tenant (teacher's school) is being accessed.
 *
 * Architecture:
 *   - Root domain (ticoclass.com): Platform marketplace
 *   - Subdomain (thaynam.ticoclass.com): Teacher's school
 *
 * Ignored subdomains: www, app, api, admin, mail
 */

const IGNORED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "localhost",
]);

/** Root domain — configure via env or fallback */
const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

/**
 * Extract tenant slug from hostname.
 * Returns null if on root domain or ignored subdomain.
 *
 * Examples:
 *   "thaynam.ticoclass.com"   → "thaynam"
 *   "thaynam.localhost:3000"  → "thaynam"
 *   "ticoclass.com"           → null
 *   "www.ticoclass.com"       → null
 *   "localhost:3000"          → null
 */
export function getTenantSlug(host: string | null): string | null {
  if (!host) return null;

  // Remove port for comparison
  const hostWithoutPort = host.split(":")[0];
  const rootWithoutPort = ROOT_DOMAIN.split(":")[0];

  // Direct match = root domain
  if (hostWithoutPort === rootWithoutPort) return null;

  // Check if it's a subdomain of root
  const suffix = `.${rootWithoutPort}`;
  if (!hostWithoutPort.endsWith(suffix)) return null;

  // Extract subdomain part
  const subdomain = hostWithoutPort.slice(0, -suffix.length);

  // Ignore system subdomains
  if (IGNORED_SUBDOMAINS.has(subdomain)) return null;

  // Validate: only lowercase alphanumeric and hyphens
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain) && subdomain.length < 2) {
    return null;
  }

  return subdomain;
}

/**
 * Build the full subdomain URL for a given tenant slug.
 * Used for CTA redirect buttons (e.g., "Register with teacher X").
 */
export function buildTenantUrl(slug: string, path = "/"): string {
  const protocol = ROOT_DOMAIN.includes("localhost") ? "http" : "https";
  const rootWithoutPort = ROOT_DOMAIN.split(":")[0];
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";

  return `${protocol}://${slug}.${rootWithoutPort}${port}${path}`;
}

/**
 * Custom header name used to pass tenant slug from middleware
 * to downstream Server Components and Server Actions.
 */
export const TENANT_HEADER = "x-tenant-slug";
