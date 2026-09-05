import { runnerFor } from "./runners.ts";
import { nowSeconds, dayOfTime, dayByNumber, secondsToStart, setStartEpoch } from "./chain.ts";
import { chainState, contractEnabled, startClaimScan, CONTRACT, CHAIN_ID } from "./contract.ts";
import { homePage, dayPage, howPage, notFound, beforeStart, feedXml } from "./site.ts";
import { explorePage, traitsPage, holderPage, assetsPage, embedPage, wordmarkSvg, PREVIEW_DAYS } from "./pages.ts";
import { dayJson, daysJson, holderJson, specJson, calendarIcs } from "./api.ts";
import { dayPng } from "./image.ts";
import { ensNames, resolveHolder } from "./ens.ts";
import { startAutoclaim } from "./autoclaim.ts";
import type { Hex } from "viem";

const PORT = Number(process.env.PORT ?? 3000);

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
  new Response(b, { headers: { "content-type": "image/png", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300" } });
const json = (o: unknown, maxAge = 30) =>
  new Response(JSON.stringify(o, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" } });
const redirect = (to: string) => new Response(null, { status: 301, headers: { location: to } });

const LEGACY: Record<string, string> = {};

if (contractEnabled()) {
  const st = await chainState();
  if (st) {
    setStartEpoch(st.startEpoch);
    console.log(`contract ${CONTRACT} on chain ${CHAIN_ID}, startEpoch ${st.startEpoch}, day ${st.day}, renderer ${st.renderer}`);
  }
  startClaimScan();
  if (process.env.DEPLOYER_KEY) startAutoclaim(process.env.DEPLOYER_KEY as Hex);
}

/** ENS names for every owner the page will show; empty map on any failure. */
async function namesFor(chain: Awaited<ReturnType<typeof chainState>>) {
  if (!chain) return new Map<string, string>();
  try {
    return await ensNames([...chain.owners.values()]);
  } catch {
    return new Map<string, string>();
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (LEGACY[path]) return redirect(LEGACY[path]);
    const legacyDay = path.match(/^\/doba\/(\d{1,6})(\.svg)?$/);
    if (legacyDay) return redirect(`/day/${legacyDay[1]}${legacyDay[2] ?? ""}`);

    const now = nowSeconds();
    let chain = null as Awaited<ReturnType<typeof chainState>>;
    try {
      chain = await chainState();
    } catch (e) {
      console.error("contract state unavailable:", (e as Error).message);
    }
    const today = chain ? (chain.day > 0 ? dayByNumber(chain.day) : null) : dayOfTime(now);

    if (path === "/spec.json") return json(specJson(), 3600);
    if (path === "/calendar.ics") return new Response(calendarIcs(dayByNumber(1)!), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=86400" } });

    if (!today) {
      const dayOne = dayByNumber(1)!;
      if (path === "/health") return new Response(`ok, before day one, ${now}`);
      if (path === "/how") return html(howPage(dayOne));
      if (path === "/today.svg") return svg(runnerFor(dayOne.epoch).svg, false);
      if (path === "/today.png") return png(dayPng(dayOne, false), false);
      return html(beforeStart(secondsToStart(now), dayOne));
    }

    if (path === "/") return html(homePage(today, now, chain, await namesFor(chain)));
    if (path === "/feed.xml") return new Response(feedXml(today, chain), { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
    if (path === "/today.png") return png(dayPng(today, false), false);
    if (path === "/today.svg") return svg(runnerFor(today.epoch).svg, false);
    if (path === "/how") return html(howPage(today));
    if (path === "/explore") return html(explorePage(today, chain));
    if (path === "/traits") return html(traitsPage(today, chain));
    if (path === "/assets") return html(assetsPage(today, chain));
    if (path === "/embed") return html(embedPage(today, chain, await namesFor(chain)));
    if (path === "/wordmark.svg") return svg(wordmarkSvg(runnerFor(today.epoch)), false);
    if (path === "/api/today") return json(dayJson(today, today, chain, await namesFor(chain)));
    if (path === "/api/days") return json(daysJson(today, chain, await namesFor(chain)));
    if (path === "/health") return new Response(`ok, day ${today.n}, ${now}${chain ? `, contract ${chain.address}, claims scanned ${chain.claims.size}` : ""}`);

    const m = path.match(/^\/day\/(\d{1,6})(\.svg|\.png)?$/);
    if (m) {
      const n = Number(m[1]);
      const d = dayByNumber(n);
      if (!d || n > today.n) return html(notFound(today), 404);
      if (m[2] === ".svg") return svg(runnerFor(d.epoch).svg, n < today.n);
      if (m[2] === ".png") return png(dayPng(d, n < today.n), n < today.n);
      return html(dayPage(d, today, chain, await namesFor(chain)));
    }
    const api = path.match(/^\/api\/day\/(\d{1,6})$/);
    if (api) {
      const d = dayByNumber(Number(api[1]));
      if (!d || d.n > today.n) return json({ error: "no such day", today: today.n }, 0);
      return json(dayJson(d, today, chain, await namesFor(chain)));
    }
    // Future days, computed with the current renderer. Short cache: the renderer can still change.
    const pv = path.match(/^\/preview\/(\d{1,6})\.svg$/);
    if (pv) {
      const n = Number(pv[1]);
      const d = dayByNumber(n);
      if (!d || n <= today.n || n > today.n + PREVIEW_DAYS) return html(notFound(today), 404);
      return svg(runnerFor(d.epoch).svg, false);
    }
    // Holder pages: /0x... or /name.eth, and their JSON.
    const holder = path.match(/^\/(api\/holder\/)?(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i);
    if (holder && chain) {
      const who = await resolveHolder(holder[2]);
      if (!who) return html(notFound(today), 404);
      const names = await namesFor(chain);
      if (holder[1]) return json(holderJson(who, today, chain, names));
      return html(holderPage(who, holder[2], today, chain, names));
    }
    return html(notFound(today), 404);
  },
});

console.log(`chainrun.onenft.click on :${PORT}`);
