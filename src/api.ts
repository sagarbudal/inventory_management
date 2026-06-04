/** Backend API base URL. Empty string = same origin (Vite dev proxy). */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}
