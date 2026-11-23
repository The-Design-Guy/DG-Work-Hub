import "server-only";
import { lookup as dnsLookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent, fetch as ufetch } from "undici";

/**
 * Fetching arbitrary URLs from the server, safely:
 * - only http/https on default ports
 * - every DNS answer is checked AT CONNECT TIME (also after redirects),
 *   so private, loopback, link-local and other internal addresses are refused
 *   (no SSRF, no DNS-rebinding)
 * - manual redirects (max 4), timeouts, and hard size limits
 */

function isPublic(address: string) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress()) ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}

const agent = new Agent({
  connect: {
    timeout: 5000,
    lookup(hostname, options, cb) {
      dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return cb(err, "", 4);
        const list = (addresses as unknown as { address: string; family: number }[]) ?? [];
        const ok = list.filter((a) => isPublic(a.address));
        if (!ok.length || ok.length !== list.length) return cb(new Error("Blocked address"), "", 4);
        if ((options as { all?: boolean }).all) return (cb as unknown as (e: null, a: typeof ok) => void)(null, ok);
        cb(null, ok[0].address, ok[0].family);
      });
    },
  },
  headersTimeout: 6000,
  bodyTimeout: 6000,
});

function checkUrl(raw: string | URL) {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only web links are allowed.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Unusual ports are not allowed.");
  if (u.username || u.password) throw new Error("Links with credentials are not allowed.");
  // Literal IPs must be public too (DNS lookup is skipped for them).
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && !isPublic(host)) throw new Error("Blocked address.");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("Blocked address.");
  return u;
}

export async function safeFetch(url: string, opts: { maxBytes: number; accept?: string }) {
  let current = checkUrl(url);
  for (let hop = 0; hop < 5; hop++) {
    const res = await ufetch(current, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DGWorkHub/1.0; +https://dg-work-hub.vercel.app)",
        accept: opts.accept ?? "*/*",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new Error("Bad redirect.");
      current = checkUrl(new URL(loc, current));
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`HTTP ${res.status}`);
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > opts.maxBytes) {
      await res.body?.cancel();
      throw new Error("Too large.");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > opts.maxBytes) throw new Error("Too large.");
      chunks.push(chunk);
    }
    return { url: current, type: (res.headers.get("content-type") ?? "").toLowerCase(), body: Buffer.concat(chunks) };
  }
  throw new Error("Too many redirects.");
}
