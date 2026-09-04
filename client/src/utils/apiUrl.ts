/**
 * Dynamic API URL resolver for ResearcherGPT client.
 * Handles:
 * - Localhost dev (port 3000 -> port 5000)
 * - LAN IP dev (e.g. 192.168.x.x:3000 -> 192.168.x.x:5000)
 * - Cloud deployments (Vercel, Render, Railway, custom domains) where port 5000
 *   must NEVER be appended to public hostnames.
 */
export const getApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateIp = /^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./.test(hostname);

    // If explicit remote backend URL is provided via environment, always respect it
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }

    // Localhost or private LAN access: talk directly to port 5000
    if (isLocalhost || isPrivateIp) {
      return `${protocol}//${hostname}:5000`;
    }

    // Fallback on deployed domain when no remote backend URL is provided:
    // Return empty string so requests hit the relative path (e.g. /api/...)
    // and can be handled via Next.js rewrites or a reverse proxy.
    // NEVER attach :5000 to a public domain hostname!
    return '';
  }

  // Server-side rendering / build time fallback
  return (envUrl || 'http://localhost:5000').replace(/\/+$/, '');
};
