import type { ReactNode } from "react";

/**
 * Tenant Layout
 * =============
 * Internal route group for subdomain-rewritten URLs.
 * Middleware rewrites: thaynam.localhost:3000/register → /t/thaynam/register
 * This layout is invisible to the user — they see their subdomain URL.
 */
export default function TenantLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
