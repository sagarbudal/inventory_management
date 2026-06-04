/**
 * Centralized API configuration.
 *
 * Production (Vercel): set VITE_API_URL to your Render backend origin, e.g.
 *   https://your-service.onrender.com
 * Vite bakes this into the bundle at build time — redeploy after changing it.
 *
 * Local dev: leave VITE_API_URL empty; Vite proxies /api → VITE_API_PROXY_TARGET.
 */

/** Backend origin without trailing slash. Empty = same-origin / Vite dev proxy. */
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, "") ?? "";

/** Production build deployed without VITE_API_URL (requests would hit the frontend host). */
export function isMisconfiguredProductionApi(): boolean {
  return import.meta.env.PROD && !API_BASE_URL;
}

/**
 * Resolve a path to a full API URL: `${VITE_API_URL}/api/...`
 * Accepts `/login`, `login`, or `/api/login`.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const apiPath = normalized.startsWith("/api") ? normalized : `/api${normalized}`;

  if (!API_BASE_URL) {
    return apiPath;
  }

  return `${API_BASE_URL}${apiPath}`;
}
