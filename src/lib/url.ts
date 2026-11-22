/**
 * Only plain web links are allowed. javascript:, data:, file:, chrome: and
 * everything else is rejected.
 */
export function normalizeUrl(input: string): { url: string; domain: string } | null {
  const raw = input.trim();
  if (!raw || raw.length > 4096) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  u.hostname = u.hostname.toLowerCase();
  return { url: u.href, domain: u.hostname.replace(/^www\./, "") };
}

/** Comparison key for "do I already have this link?" (ignores trailing slash and #hash). */
export function urlKey(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    let s = u.href;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Small raster favicons embedded in Chrome exports. SVG and other types are dropped. */
export function safeIconDataUri(icon: string | undefined | null) {
  if (!icon || icon.length > 16_000) return null;
  return /^data:image\/(png|x-icon|vnd\.microsoft\.icon|gif|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(icon)
    ? icon
    : null;
}
