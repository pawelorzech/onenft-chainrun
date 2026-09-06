import { mintPage } from "./mint-page.ts";
import { runnerFor } from "./runners.ts";
import { nowSeconds, dayOfTime, dayByNumber, secondsToStart } from "./chain.ts";
import { chainState, chainStatus, contractEnabled, readNow, startClaimScan, CONTRACT, CHAIN_ID, type ChainState } from "./contract.ts";
import { homePage, dayPage, howPage, notFound, chainDown, beforeStart, feedXml, goTarget } from "./site.ts";
import { explorePage, traitsPage, holderPage, yoursPage, assetsPage, embedPage, wordmarkSvg, PREVIEW_DAYS } from "./pages.ts";
import { dayJson, daysJson, holderJson, summaryJson, specJson, calendarIcs } from "./api.ts";
import { dayPng, squarePng } from "./image.ts";
import { ensNames, resolveHolder, resolveFailed } from "./ens.ts";
import { startAutoclaim } from "./autoclaim.ts";
import type { Hex } from "viem";

const PORT = Number(process.env.PORT ?? 3000);
const BOOT_AT = Date.now();

const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const svg = (s: string, immutable: boolean) =>
  new Response(s, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
const png = (b: Uint8Array, immutable: boolean) =>
  new Response(b as Uint8Array<ArrayBuffer>, { headers: { "content-type": "image/png", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300", "access-control-allow-origin": "*" } });
const json = (o: unknown, maxAge = 30, status = 200) =>
  new Response(JSON.stringify(o, null, 1), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? `public, max-age=${maxAge}` : "no-store", "access-control-allow-origin": "*" } });
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });

/**
 * Headers every response carries. The embed page is meant for iframes on any
 * site; every other page may sit in a frame on this origin only.
 */
export function withHeaders(res: Response, path: string): Response {
  const h = res.headers;
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  if (path !== "/embed") h.set("x-frame-options", "SAMEORIGIN");
  return res;
}

/** Old Polish paths from the first hours of the site. */
const LEGACY: Record<string, string> = {};


/** ENS names for the owners a page will show. Never throws, never blocks on more than a few lookups. */
async function namesFor(chain: ChainState | null, only?: Iterable<string>) {
  if (!chain) return new Map<string, string>();
  return ensNames([...(only ?? chain.owners.values())]);
}
/** Owners the home page shows: today and the sixty days before it. */
function recentOwners(chain: ChainState, today: number): string[] {
  const out: string[] = [];
  for (let n = today; n >= Math.max(1, today - 60); n--) {
    const o = chain.owners.get(n);
    if (o) out.push(o);
  }
  return out;
}

export async function handle(req: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return new Response("bad request", { status: 400, headers: { "content-type": "text/plain" } });
  }
  try {
    return withHeaders(await route(url), url.pathname);
  } catch (e) {
    // A page that throws must not take the connection down with a stack trace in the body.
    console.error(`route ${url.pathname}:`, (e as Error).message);
    return withHeaders(url.pathname.startsWith("/api/") ? json({ error: "internal error" }, 0, 500) : new Response("internal error", { status: 500, headers: { "content-type": "text/plain" } }), url.pathname);
  }
}

async function route(url: URL): Promise<Response> {
  const path = url.pathname;
  if (LEGACY[path]) return redirect(LEGACY[path]);
  const legacyDay = path.match(/^\/doba\/(\d{1,6})(\.svg)?$/);
  if (legacyDay) return redirect(`/day/${legacyDay[1]}${legacyDay[2] ?? ""}`);

  const now = nowSeconds();
  // The day comes from the clock, the same arithmetic the contract runs on
  // block.timestamp. A chain read can be cached or, when the RPC is down, hours
  // old; the clock cannot.
  const today = dayOfTime(now);

  // ---- everything that needs no chain answers before any chain read
  if (path === "/spec.json") return json(specJson(), 3600);
  if (path === "/calendar.ics") return new Response(calendarIcs(dayByNumber(1)!), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=86400" } });
  // Liveness: the process is up. Never depends on the RPC, so a dead RPC never restarts the site.
  if (path === "/health") return new Response(`ok, ${today ? `day ${today.n}` : "before day one"}, ${now}, up ${Math.floor((Date.now() - BOOT_AT) / 1000)} s`);
  // Readiness and dependency status, for people and monitors. 503 only when a contract is configured and nothing was ever read.
  if (path === "/ready") {
    const s = chainStatus();
    return json({ ok: !s.configured || s.known, day: today?.n ?? 0, now: Number(now), chain: s }, 0, !s.configured || s.known ? 200 : 503);
  }

  if (!today) {
    const dayOne = dayByNumber(1)!;
    if (path === "/how") return html(howPage(dayOne));
    if (path === "/today.svg") return svg(runnerFor(dayOne.epoch).svg, false);
    if (path === "/today.png") return png(dayPng(dayOne, false), false);
    return html(beforeStart(secondsToStart(now), dayOne));
  }

  if (path === "/today.png") return png(dayPng(today, false), false);
  if (path === "/today.svg") return svg(runnerFor(today.epoch).svg, false);
  if (path === "/how") return html(howPage(today));
  if (path === "/wordmark.svg") return svg(wordmarkSvg(runnerFor(today.epoch)), false);
  if (path === "/go") return redirect(goTarget(url.searchParams.get("who")), 302);
  const img = path.match(/^\/day\/(\d{1,6})(\.svg|\.png|-1024\.png)$/);
  if (img) {
    const n = Number(img[1]);
    const d = dayByNumber(n);
    if (!d || n > today.n) return html(notFound(today), 404);
    const past = n < today.n;
    if (img[2] === ".svg") return svg(runnerFor(d.epoch).svg, past);
    if (img[2] === ".png") return png(dayPng(d, past), past);
    return png(squarePng(d, past), past);
  }
  // Future days, computed with the current renderer. Short cache: the renderer can still change.
  const pv = path.match(/^\/preview\/(\d{1,6})\.svg$/);
  if (pv) {
    const n = Number(pv[1]);
    const d = dayByNumber(n);
    if (!d || n <= today.n || n > today.n + PREVIEW_DAYS) return html(notFound(today), 404);
    return svg(runnerFor(d.epoch).svg, false);
  }

  // ---- from here on pages show chain state: the last good read, at once; a wait only before the first read
  const chain = await chainState();
  const status = chainStatus();

  if (path === "/") return html(homePage(today, now, chain, await namesFor(chain, chain ? recentOwners(chain, today.n) : undefined), status));
  if (path === "/feed.xml") return new Response(feedXml(today, chain), { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
  if (path === "/explore") return html(explorePage(today, chain, status));
  if (path === "/traits") return html(traitsPage(today, chain));
  if (path === "/assets") return html(assetsPage(today, chain));
  if (path === "/yours") return html(yoursPage(today, chain, status, url.searchParams.get("bad")));
  if (path === "/embed") return html(embedPage(today, chain, await namesFor(chain, chain?.owners.get(today.n) ? [chain.owners.get(today.n)!] : [])));
  if (path === "/api/mints") {
    if (!chain || status.stale) return json({ error: "chain unavailable" }, 0, 503);
    const page = mintPage(chain, [...chain.owners.keys()], url.searchParams, (id) => dayJson(dayByNumber(id)!, today, chain, undefined, status));
    return json(page, 0, "error" in page ? 400 : 200);
  }
  if (path === "/api/today") return json(dayJson(today, today, chain, await namesFor(chain, chain?.owners.get(today.n) ? [chain.owners.get(today.n)!] : []), status));
  if (path === "/api/summary") return json(summaryJson(today, chain, status), 15);
  if (path === "/api/days") return json(daysJson(today, chain, await namesFor(chain), status));

  const m = path.match(/^\/day\/(\d{1,6})$/);
  if (m) {
    const n = Number(m[1]);
    const d = dayByNumber(n);
    if (!d || n > today.n) return html(notFound(today), 404);
    const o = chain?.owners.get(n), c = chain?.claims.get(n);
    return html(dayPage(d, today, chain, await namesFor(chain, [o, c?.to].filter(Boolean) as string[]), status));
  }
  const api = path.match(/^\/api\/day\/(\d{1,6})$/);
  if (api) {
    const d = dayByNumber(Number(api[1]));
    if (!d || d.n > today.n) return json({ error: "no such day", today: today.n }, 0, 404);
    const o = chain?.owners.get(d.n);
    return json(dayJson(d, today, chain, await namesFor(chain, o ? [o] : []), status));
  }
  // Holder pages: /0x... or /name.eth, and their JSON.
  const holder = path.match(/^\/(api\/holder\/)?(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i);
  if (holder) {
    if (!contractEnabled()) return holder[1] ? json({ error: "no contract configured" }, 0, 404) : html(notFound(today), 404);
    if (!chain) return holder[1] ? json({ error: "the chain did not answer", chain: status }, 0, 503) : html(chainDown(today), 503);
    const who = await resolveHolder(holder[2]);
    if (!who) {
      const failed = resolveFailed(holder[2]);
      if (holder[1]) return json({ error: failed ? "ENS did not answer" : "no such name" }, 0, failed ? 503 : 404);
      return html(failed ? chainDown(today, "ENS did not answer. Try the name again in a minute, or use the address.") : notFound(today, `No wallet answers to ${holder[2]}.`), failed ? 503 : 404);
    }
    const names = await namesFor(chain, [who]);
    if (holder[1]) return json(holderJson(who, today, chain, names, status));
    return html(holderPage(who, holder[2], today, chain, names, status));
  }
  if (path.startsWith("/api/")) return json({ error: "no such endpoint" }, 0, 404);
  return html(notFound(today), 404);
}

if (import.meta.main) {
  if (contractEnabled()) {
    // A dead RPC at boot must not take the site down with it: the clock and the
    // images need no chain, and every request survives a failed read.
    readNow()
      .then((st) => console.log(`contract ${CONTRACT} on chain ${CHAIN_ID}, startEpoch ${st.startEpoch}, day ${st.day}, renderer ${st.renderer}`))
      .catch((e) => console.error("contract state unavailable at boot, serving without it:", (e as Error).message));
    startClaimScan();
    if (process.env.DEPLOYER_KEY) startAutoclaim(process.env.DEPLOYER_KEY as Hex);
  }
  Bun.serve({ port: PORT, fetch: handle });
  console.log(`chainrun.onenft.click on :${PORT}`);
}
