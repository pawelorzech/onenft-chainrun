/**
 * The inner pages: calendar, traits, holder, assets, embed. Same copy rules
 * as site.ts: plain words, active voice, no adverbs, no em dashes.
 */
import { runnerFor, renderDay, summary, SLOTS, TRAIT_TYPES, type Runner } from "./runners.ts";
import { WEIGHTS } from "./layers.ts";
import { dayByNumber, dateOf, type Day } from "./chain.ts";
import type { ChainState } from "./contract.ts";
import { SITE, REPO, PARENT, RUNNERS, RUNNERS_RENDERER, layout, topBar, label, shortAddr, isAuthor, explorer, opensea, openseaCollection, chainName, num, plural, stripSize, esc, type Names, NO_NAMES } from "./site.ts";
import type { Address } from "viem";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Days after today that the calendar previews with the current renderer. */
export const PREVIEW_DAYS = 7;

function utcDate(epoch: bigint): Date {
  return new Date(Number(epoch) * 86400 * 1000);
}

/** One month as a 7-column grid. Days before day 1 and after the preview window are blank. */
function monthGrid(year: number, month: number, today: Day, chain: ChainState | null, dayOne: Day): string {
  const first = new Date(Date.UTC(year, month, 1));
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: string[] = DOW.map((d) => `<div class="dow">${d}</div>`);
  for (let i = 0; i < lead; i++) cells.push(`<div class="blank"></div>`);
  for (let dom = 1; dom <= daysIn; dom++) {
    const epoch = BigInt(Date.UTC(year, month, dom) / 1000 / 86400);
    const n = Number(epoch - dayOne.epoch) + 1;
    if (n < 1 || n > today.n + PREVIEW_DAYS) {
      cells.push(`<div class="blank"></div>`);
      continue;
    }
    if (n > today.n) {
      cells.push(`<div class="later"><span>${dom}</span></div>`);
      continue;
    }
    const gap = chain && n < today.n && !chain.owners.has(n);
    const title = gap ? `Day ${n}, nobody came` : `Day ${n}`;
    cells.push(gap
      ? `<a class="hole" href="/day/${n}" title="${title}"><span>${dom}</span></a>`
      : `<a href="/day/${n}" title="${title}"><img src="/day/${n}.svg" alt="" loading="lazy"><span>${dom}</span></a>`);
  }
  while ((cells.length - 7) % 7 !== 0) cells.push(`<div class="blank"></div>`);
  return `<section><h3 class="syne">${MONTHS[month]} ${year}</h3><div class="cal">${cells.join("")}</div></section>`;
}

export function explorePage(today: Day, chain: ChainState | null = null): string {
  const k = runnerFor(today.epoch);
  const dayOne = dayByNumber(1)!;
  const start = utcDate(dayOne.epoch), end = utcDate(today.epoch + BigInt(PREVIEW_DAYS));
  const months: string[] = [];
  for (let y = end.getUTCFullYear(), m = end.getUTCMonth(); y > start.getUTCFullYear() || (y === start.getUTCFullYear() && m >= start.getUTCMonth()); m--) {
    if (m < 0) { m = 11; y--; }
    months.push(monthGrid(y, m, today, chain, dayOne));
  }
  const taken = chain ? chain.owners.size : 0;
  const gaps = chain ? Math.max(0, today.n - 1 - [...chain.owners.keys()].filter((n) => n < today.n).length) : 0;
  const preview: string[] = [];
  for (let n = today.n + 1; n <= today.n + PREVIEW_DAYS; n++) {
    const d = dayByNumber(n)!;
    const kk = renderDay(n, d.epoch);
    preview.push(`<a href="/preview/${n}.svg"><img src="/preview/${n}.svg" alt="" loading="lazy"><div class="cap">day ${n}, ${esc(summary(kk))}</div></a>`);
  }
  const body = `<main class="wide">
${topBar()}
<div><h2 class="syne">Every day so far</h2><p class="lead" style="margin-top:8px">${today.n} ${plural(today.n, "day", "days")} run${chain ? `, ${taken} taken, ${gaps} ${plural(gaps, "gap", "gaps")}` : ""}. Hatched days are gaps: nobody came, and the number stays empty forever. Dimmed days have not happened yet.</p></div>
${months.join("\n")}
<section><h3 class="syne">The next ${PREVIEW_DAYS} days</h3><p class="small" style="margin:6px 0 14px">The draw exists before anyone sees it. One caveat: the drawing rules can still change for days nobody has claimed yet, so a preview is a promise only once its day arrives.</p><div class="strip">${preview.join("")}</div></section>
</main>`;
  return layout(`Explore | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/explore");
}

// ---- traits ----

type Seen = { days: number[]; taken: number };

/** Share of days a slot item gets in the long run: its weight across the three race tables, weighted by how often each race comes up. */
function odds(slot: number, item: number): number {
  const raceTable = WEIGHTS[0][1];
  const raceShare = [0, 0, 0];
  raceTable.forEach((w, i) => { raceShare[i === 1 ? 2 : i > 11 ? 1 : 0] += w / 10000; });
  return raceShare.reduce((sum, share, race) => sum + share * ((WEIGHTS[race][slot][item] ?? 0) / 10000), 0);
}

export function traitsPage(today: Day, chain: ChainState | null = null): string {
  const k = runnerFor(today.epoch);
  const seen = new Map<string, Seen>();
  const empty = new Map<number, Seen>();
  for (let n = 1; n <= today.n; n++) {
    const kk = renderDay(n, dayByNumber(n)!.epoch);
    const taken = !chain || chain.owners.has(n);
    const wornSlots = new Set(kk.layers.map((l) => l.slot));
    for (const { slot, layer } of kk.layers) {
      const s = seen.get(`${slot}/${layer.item}`) ?? { days: [], taken: 0 };
      s.days.push(n);
      if (taken) s.taken++;
      seen.set(`${slot}/${layer.item}`, s);
    }
    for (let slot = 0; slot < TRAIT_TYPES.length; slot++) {
      if (wornSlots.has(slot)) continue;
      const s = empty.get(slot) ?? { days: [], taken: 0 };
      s.days.push(n);
      if (taken) s.taken++;
      empty.set(slot, s);
    }
  }
  const sections = TRAIT_TYPES.map((type, slot) => {
    const items = SLOTS[slot].map((layer, item) => layer ? { item, name: layer.name } : null).filter((x): x is { item: number; name: string } => x !== null);
    const rows = items.map(({ item, name }) => {
      const s = seen.get(`${slot}/${item}`);
      const days = s?.days ?? [];
      const links = days.slice(0, 4).map((n) => `<a href="/day/${n}">${n}</a>`).join(", ") + (days.length > 4 ? `, ${days.length - 4} more` : "");
      return `<tr id="s${slot}-${item}"><td>${esc(name)}</td><td class="n">${Math.round(odds(slot, item) * 1000) / 10}%</td><td class="n">${days.length}</td>${chain ? `<td class="n">${s?.taken ?? 0}</td>` : ""}<td class="small">${links}</td></tr>`;
    });
    const e = empty.get(slot);
    const emptyRow = slot < 2 ? "" : `<tr><td class="small">none</td><td class="n"></td><td class="n">${e?.days.length ?? 0}</td>${chain ? `<td class="n">${e?.taken ?? 0}</td>` : ""}<td></td></tr>`;
    return `<section id="s${slot}"><h3 class="syne">${type}</h3><table class="tr"><thead><tr><th>layer</th><th style="text-align:right">odds</th><th style="text-align:right">so far</th>${chain ? `<th style="text-align:right">taken</th>` : ""}<th>days</th></tr></thead><tbody>${rows.join("")}${emptyRow}</tbody></table></section>`;
  });
  const body = `<main class="wide">
${topBar()}
<div><h2 class="syne">Traits</h2><p class="lead" style="margin-top:8px">Thirteen slots, 338 layers, the weight tables of the Ethereum original. Odds are the long-run share of days a layer gets, across the three race tables. So far counts the ${today.n} ${plural(today.n, "day", "days")} run to date${chain ? ", taken counts only claimed days" : ""}. Rules can hide a drawn layer (a mask hides the face, a hat above the hair shows only on odd draws), so a slot's odds add up to less than its table says.</p></div>
${sections.join("\n")}
<p class="small">Tables from <a href="/spec.json">spec.json</a>. <a href="/how">How the machine works</a>.</p>
</main>`;
  return layout(`Traits | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/traits");
}

// ---- holder ----

export function holderPage(who: Address, handle: string, today: Day, chain: ChainState, names: Names = NO_NAMES): string {
  const k = runnerFor(today.epoch);
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([n]) => n).sort((a, b) => b - a);
  const name = label(who, names);
  const author = isAuthor(chain, who);
  const cards = mine.map((n) => {
    const kk = runnerFor(dayByNumber(n)!.epoch);
    return `<a href="/day/${n}"><img src="/day/${n}.svg" alt="" loading="lazy"><div class="cap">day ${n}, ${esc(summary(kk))}</div></a>`;
  });
  const body = `<main class="wide">
${topBar()}
<div><h2 class="syne">${esc(name)}</h2><p class="lead" style="margin-top:8px">${author ? "The author. Every tenth day up to day 1000 lands here." : `${mine.length} ${plural(mine.length, "day", "days")} of ${today.n}.`}${handle.toLowerCase() !== who.toLowerCase() ? ` <span class="small">${shortAddr(who)}</span>` : ""}</p></div>
${cards.length ? `<div class="strip">${cards.join("")}</div>` : `<p>No days here yet. <a href="/">Today's runner</a> may still be free.</p>`}
<nav class="nav small"><a href="${explorer(chain.chainId)}/address/${who}">Basescan</a><a href="${chain.chainId === 8453 ? `https://opensea.io/${who}` : `https://testnets.opensea.io/${who}`}">OpenSea</a><a href="/api/holder/${who}">JSON</a></nav>
</main>`;
  return layout(`${name} | ${SITE}`, k.palette, body, `/day/${today.n}.png`, `/${handle}`);
}

// ---- assets ----

export function assetsPage(today: Day, chain: ChainState | null = null): string {
  const k = runnerFor(today.epoch);
  const iframe = esc(`<iframe src="https://${SITE}/embed" width="320" height="380" style="border:0" title="Today's runner from chainrun.onenft.click" loading="lazy"></iframe>`);
  const img = esc(`<img src="https://${SITE}/today.svg" width="256" height="256" alt="Today's runner from chainrun.onenft.click" style="image-rendering:pixelated">`);
  const body = `<main class="prose">
${topBar()}
<h2 class="syne">Take it. It is yours.</h2>
<p>Everything here is <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>: every runner, the contracts, the wordmark, this site. The layers were released CC0 by Chain Runners in 2021, and this project only exists because they were. This site is not Chain Runners and is not affiliated with it. No credit needed, no permission to ask. Print it, remix it, mint it elsewhere. Owning a day gives you the token; the image belongs to everyone.</p>
<h2 class="syne">Images</h2>
<p>Any day as SVG at <code>/day/N.svg</code> and as a 1200 by 630 card at <code>/day/N.png</code>. Today: <a href="/today.svg" download="chainrun-today.svg">SVG</a>, <a href="/today.png">card</a>. The SVG is the same file the contract holds. Render it with <code>image-rendering: pixelated</code> so the pixels stay square.</p>
<h2 class="syne">Wordmark</h2>
<p>The domain is the wordmark, set in Syne 800. <a href="/wordmark.svg" download="chainrun-wordmark.svg">wordmark.svg</a> in today's colors.</p>
<h2 class="syne">Put today's runner on your page</h2>
<p>An image that changes every midnight UTC:</p>
<pre class="snip">${img}</pre>
<p>Or a small frame with the day number and a link:</p>
<pre class="snip">${iframe}</pre>
<h2 class="syne">Data</h2>
<p><a href="/api/today">/api/today</a> and <code>/api/day/N</code> return one day: number, date, the thirteen draws, the worn layers, traits, owner, claim transaction, image links. <a href="/api/days">/api/days</a> lists every day so far. <code>/api/holder/ADDRESS</code> lists one wallet's days. All JSON, open to any origin.</p>
<p><a href="/spec.json">/spec.json</a> holds the draw, the selection rules, the weight tables and the 338 layer names, so you can port the generator. <a href="/feed.xml">RSS</a> carries one item a day. <a href="/calendar.ics">calendar.ics</a> is a daily event at midnight UTC you can subscribe to, so you never miss a day.</p>
<h2 class="syne">Code and contract</h2>
<p>The generator in TypeScript and Solidity, the site and the contracts: <a href="${REPO}">${REPO.replace("https://", "")}</a>.${chain ? ` Token contract <a href="${explorer(chain.chainId)}/address/${chain.address}">${chain.address}</a> on ${chainName(chain.chainId)}. <a href="${openseaCollection(chain)}">Collection on OpenSea</a>.` : ""} The layers: Chain Runners renderer <a href="https://etherscan.io/address/${RUNNERS_RENDERER}">${RUNNERS_RENDERER}</a> and token <a href="https://etherscan.io/address/${RUNNERS}">${RUNNERS}</a> on Ethereum. Every daily collection, including the knot: <a href="https://${PARENT}">${PARENT}</a>.</p>
<p class="small"><a href="/">Back to today</a></p>
</main>`;
  return layout(`Assets | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/assets");
}

/** A small page for iframes: today's runner, the day number, a link back. */
export function embedPage(today: Day, chain: ChainState | null = null, names: Names = NO_NAMES): string {
  const k = runnerFor(today.epoch);
  const o = chain?.owners.get(today.n);
  const state = !chain ? "" : o ? (isAuthor(chain, o) ? "the author's" : `taken by ${label(o, names)}`) : "still nobody's";
  const body = `<main style="padding:12px;display:flex;flex-direction:column;gap:8px;max-width:320px">
<a href="https://${SITE}/day/${today.n}" target="_top" style="display:block;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)" class="knot">${stripSize(k.svg)}</a>
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span class="syne" style="font-weight:800;font-size:22px">Day ${today.n}</span><span class="small">${state}</span></div>
<a class="small" href="https://${SITE}/" target="_top">${SITE}, one runner a day</a>
</main>`;
  return layout(`Day ${today.n} | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/embed");
}

/** The domain as an SVG wordmark in a palette's colors. */
export function wordmarkSvg(k: Runner): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="160" viewBox="0 0 800 160"><rect width="800" height="160" fill="${k.palette.bg}"/><text x="40" y="104" font-family="Syne, system-ui, sans-serif" font-weight="800" font-size="60" letter-spacing="-2" fill="${k.palette.cord}">${SITE}</text></svg>`;
}
