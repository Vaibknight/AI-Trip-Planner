/**
 * Express API origin (no trailing slash). Used by Next.js route proxies.
 * Match Backend `.env` PORT (default 8000 in this project).
 */
export function getBackendOrigin(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://ai-trip-planner-production-5505.up.railway.app/api";
  return raw.replace(/\/$/, "");
}
