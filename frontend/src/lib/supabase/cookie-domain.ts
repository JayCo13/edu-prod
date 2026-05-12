/**
 * Cookie Domain Utility
 * =====================
 * Resolves the correct cookie domain for cross-subdomain SSO.
 *
 * In production:
 *   NEXT_PUBLIC_ROOT_DOMAIN = "ticoclass.com"
 *   → cookie domain = ".ticoclass.com" (leading dot = all subdomains)
 *   → User logs in at root → cookie works at thaynam.ticoclass.com too
 *
 * In development:
 *   NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000"
 *   → cookie domain = undefined (localhost doesn't support subdomain cookies)
 */

export function getCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const host = rootDomain.split(":")[0]; // strip port

  // localhost doesn't support domain-scoped cookies
  if (host === "localhost" || host === "127.0.0.1") {
    return undefined;
  }

  // Ensure leading dot for subdomain coverage
  return host.startsWith(".") ? host : `.${host}`;
}
