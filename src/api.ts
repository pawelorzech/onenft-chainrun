/**
 * JSON for other people's code, the spec, and the calendar feed.
 * Everything here is derived; nothing is stored.
 */
import { runnerFor, TRAIT_TYPES } from "./runners.ts";
import { LAYERS, WEIGHTS } from "./layers.ts";
import { dayByNumber, dateOf, type Day } from "./chain.ts";
import type { ChainState, ChainStatus } from "./contract.ts";
import { SITE, isAuthor, opensea, explorer, dayState, type Names, NO_NAMES } from "./site.ts";
import type { Address } from "viem";

/**
 * How old the ownership data in an answer is. `known` false means no chain
 * read ever succeeded, so every state below reads "unknown", never "gap".
 */
export function chainBlock(status: ChainStatus | null) {
  if (!status?.configured) return { configured: false, known: false, stale: false, readAt: null, ageSeconds: null, error: null };
  return { configured: true, known: status.known, stale: status.stale, readAt: status.readAt === null ? null : new Date(status.readAt).toISOString(), ageSeconds: status.ageSeconds, error: status.error };
}

export function dayJson(d: Day, today: Day, chain: ChainState | null, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const k = runnerFor(d.epoch);
  const owner = chain?.owners.get(d.n);
  const claim = chain?.claims.get(d.n);
  return {
    day: d.n,
    epoch: Number(d.epoch),
    date: new Date(Number(d.startsAt) * 1000).toISOString().slice(0, 10),
    startsAt: Number(d.startsAt),
    isToday: d.n === today.n,
    authorDay: d.n % 10 === 0 && d.n <= 1000,
    renderer: k.version,
    dna: k.dna,
    colors: k.palette.colors,
    traits: k.traitMap,
    layers: k.layers.map((l) => ({ slot: l.slot, type: TRAIT_TYPES[l.slot], item: l.layer.item, name: l.layer.name })),
    state: stateWord(d.n, today.n, chain, status),
    owner: owner ?? null,
    ownerName: owner ? names.get(owner.toLowerCase()) ?? null : null,
    claim: claim ? { tx: claim.tx, block: Number(claim.block), at: claim.at, secondsAfterMidnight: claim.at - Number(d.startsAt), explorer: `${explorer(chain!.chainId)}/tx/${claim.tx}` } : null,
    image: `https://${SITE}/day/${d.n}.svg`,
    card: `https://${SITE}/day/${d.n}.png`,
    url: `https://${SITE}/day/${d.n}`,
    opensea: chain && owner ? opensea(chain, d.n) : null,
    bytes: k.svg.length,
    chain: chainBlock(status),
  };
}

/** The API's word for a day's state. "taken" and "free" stay for readers of the first version; "unknown" is new and means the chain did not answer. */
export function stateWord(n: number, today: number, chain: ChainState | null, status: ChainStatus | null): "author" | "taken" | "gap" | "free" | "unknown" | null {
  if (!chain && !status?.configured) return null;
  const s = dayState(n, today, chain, status);
  return s === "claimed" ? "taken" : s === "available" ? "free" : s;
}

export function daysJson(today: Day, chain: ChainState | null, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const days = [];
  for (let n = 1; n <= today.n; n++) {
    const j = dayJson(dayByNumber(n)!, today, chain, names, status);
    days.push({ day: j.day, date: j.date, renderer: j.renderer, traits: j.traits, state: j.state, owner: j.owner, ownerName: j.ownerName, tx: j.claim?.tx ?? null, image: j.image });
  }
  return { site: SITE, today: today.n, contract: chain ? { address: chain.address, chainId: chain.chainId, renderer: chain.renderer } : null, chain: chainBlock(status), days };
}

/** Counts over every day before today. Null when the chain never answered: an unknown count is not zero. */
export function tallyOf(today: Day, chain: ChainState | null): { taken: number; gaps: number; author: number } | null {
  if (!chain) return null;
  let taken = 0, gaps = 0, author = 0;
  for (let n = 1; n <= today.n; n++) {
    const o = chain.owners.get(n);
    if (o) { taken++; if (isAuthor(chain, o)) author++; }
    else if (n < today.n) gaps++;
  }
  return { taken, gaps, author };
}

/** The short form for the hub: today, the counts and the palette in one small answer, instead of every day. */
export function summaryJson(today: Day, chain: ChainState | null, status: ChainStatus | null = null) {
  const k = runnerFor(today.epoch);
  return {
    site: SITE,
    kind: "daily",
    today: dayJson(today, today, chain, NO_NAMES, status),
    tally: tallyOf(today, chain),
    palette: k.palette,
    contract: chain ? { address: chain.address, chainId: chain.chainId, renderer: chain.renderer } : null,
    chain: chainBlock(status),
  };
}

export function holderJson(who: Address, today: Day, chain: ChainState, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([n]) => n).sort((a, b) => a - b);
  return { address: who, name: names.get(who.toLowerCase()) ?? null, author: isAuthor(chain, who), chain: chainBlock(status), days: mine.map((n) => dayJson(dayByNumber(n)!, today, chain, names, status)) };
}

export function specJson() {
  return {
    site: SITE,
    version: 1,
    license: "CC0-1.0 (art and images), MIT (code)",
    source: "The 338 Chain Runners layers and weight tables from Ethereum contract 0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc (ChainRunnersBaseRenderer, getLayer), read 2026-09-05. Art released CC0.",
    clock: "epoch = block.timestamp / 86400; day = epoch - startEpoch + 1; startEpoch = 20701 (2026-09-05 UTC)",
    dna: "seed = mix64(day); dna[i] = mix64(seed + i) mod 10000 for i in 0..12",
    mix64: "x += 0x9e3779b97f4a7c15; x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9; x = (x ^ (x >> 27)) * 0x94d049bb133111eb; return x ^ (x >> 31)",
    selection: "Race from dna[1] through WEIGHTS[0][1]: item 1 is bot, items above 11 are skull, the rest human or alien. For each slot i, walk WEIGHTS[race][i] with dna[i]; the item whose range holds the draw is worn, a range past the art means none. Rules from the original: face and mouth accessory only without mask and face accessory; face accessory and eye accessory only without mask; head above only when dna[0] is odd; head below skipped when both head layers exist and dna[0] is odd.",
    layer: "416 bytes: 8 RGBA colors, then 1024 pixels at 3 bits, 8 pixels per 3 bytes, row by row.",
    blend: "Top layer down: skip alpha 0, return alpha 255, else blend once with the first layer below that has alpha above 0: (a + 1) * fg + (256 - a) * bg, shifted right 8.",
    image: "32 by 32 SVG, shape-rendering crispEdges, one rect per horizontal run of one color.",
    traitTypes: TRAIT_TYPES,
    weights: WEIGHTS,
    layers: LAYERS.map((l) => ({ slot: l.layer, item: l.item, name: l.name })),
  };
}

/** One daily event at midnight UTC, forever. Subscribe once. */
export function calendarIcs(dayOne: Day): string {
  const stamp = new Date(Number(dayOne.startsAt) * 1000).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE}//one runner a day//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${SITE}`,
    "X-WR-CALDESC:One Chain Runner a day. Claim it before midnight UTC.",
    "BEGIN:VEVENT",
    `UID:daily@${SITE}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${stamp}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:A new runner at chainrun.onenft.click",
    `DESCRIPTION:A new day, a new runner. Claim it before midnight UTC. 0 ETH mint fee, network gas only: https://${SITE}/`,
    `URL:https://${SITE}/`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

