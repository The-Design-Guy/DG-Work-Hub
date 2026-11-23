import "server-only";
import { safeFetch } from "./safe-fetch";
import { safeIconDataUri } from "./url";

export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 8) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return "image/x-icon";
  const head = buf.subarray(0, 600).toString("utf8").trimStart().toLowerCase();
  if ((head.startsWith("<svg") || head.startsWith("<?xml")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}

export function iconLinks(html: string, base: URL) {
  const out: { href: string; score: number; label: string }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !/\bicon\b|apple-touch-icon/.test(rel) || rel.includes("mask-icon")) continue;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "https:" && abs.protocol !== "http:") continue;
    const size = Number((attr(tag, "sizes") ?? "").split(/x/i)[0]) || (rel.includes("apple-touch-icon") ? 180 : 32);
    const svg = /\.svg(\?|$)/i.test(abs.pathname) || (attr(tag, "type") ?? "").includes("svg");
    out.push({ href: abs.href, score: svg ? 1000 : size, label: svg ? "Vector icon" : `${size}px` });
  }
  return out;
}


function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function metaContent(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    if (k === key) return attr(tag, "content");
  }
  return null;
}

/**
 * Title, description and a small favicon for a link, fetched server-side
 * (SSRF-safe). Every field is optional: private pages often return nothing.
 */
export async function pageMeta(url: string) {
  const out: { title: string | null; description: string | null; favicon: string | null } = {
    title: null,
    description: null,
    favicon: null,
  };
  let origin: string;
  let links: { href: string; score: number }[] = [];
  try {
    const page = await safeFetch(url, { maxBytes: 800_000, accept: "text/html" });
    origin = page.url.origin;
    if (page.type.includes("html")) {
      const html = page.body.toString("utf8");
      const title = metaContent(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
      const desc = metaContent(html, "og:description") ?? metaContent(html, "description");
      out.title = title ? decodeEntities(title).replace(/\s+/g, " ").trim().slice(0, 300) || null : null;
      out.description = desc ? decodeEntities(desc).replace(/\s+/g, " ").trim().slice(0, 500) || null : null;
      links = iconLinks(html, page.url).filter((l) => l.label !== "Vector icon");
    }
  } catch {
    origin = new URL(url).origin;
  }
  // Small raster icon, stored inline with the link.
  links.push({ href: `${origin}/favicon.ico`, score: 16 }, { href: `${origin}/apple-touch-icon.png`, score: 180 });
  const ordered = [...new Map(links.map((l) => [l.href, l])).values()].sort(
    (a, b) => Math.abs(a.score - 64) - Math.abs(b.score - 64),
  );
  const tries = await Promise.allSettled(
    ordered.slice(0, 4).map(async (l) => {
      const r = await safeFetch(l.href, { maxBytes: 12_000, accept: "image/*" });
      const mime = sniffImage(r.body);
      if (!mime || mime === "image/svg+xml") throw new Error("Not a raster icon");
      const uri = safeIconDataUri(`data:${mime};base64,${r.body.toString("base64")}`);
      if (!uri) throw new Error("Unusable icon");
      return uri;
    }),
  );
  out.favicon = tries.find((t): t is PromiseFulfilledResult<string> => t.status === "fulfilled")?.value ?? null;
  return out;
}
