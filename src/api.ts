/**
 * JSON for other people's code, the spec, and the calendar feed.
 * Everything here is derived; nothing is stored.
 */
import { runnerFor, TRAIT_TYPES } from "./runners.ts";
import { LAYERS, WEIGHTS } from "./layers.ts";
import { dayByNumber, dateOf, type Day } from "./chain.ts";
import type { ChainState } from "./contract.ts";
import { SITE, isAuthor, opensea, explorer, type Names, NO_NAMES } from "./site.ts";
import type { Address } from "viem";

export function dayJson(d: Day, today: Day, chain: ChainState | null, names: Names = NO_NAMES) {
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
    state: !chain ? null : owner ? (isAuthor(chain, owner) ? "author" : "taken") : d.n < today.n ? "gap" : "free",
    owner: owner ?? null,
    ownerName: owner ? names.get(owner.toLowerCase()) ?? null : null,
    claim: claim ? { tx: claim.tx, block: Number(claim.block), at: claim.at, secondsAfterMidnight: claim.at - Number(d.startsAt), explorer: `${explorer(chain!.chainId)}/tx/${claim.tx}` } : null,
    image: `https://${SITE}/day/${d.n}.svg`,
    card: `https://${SITE}/day/${d.n}.png`,
    url: `https://${SITE}/day/${d.n}`,
    opensea: chain && owner ? opensea(chain, d.n) : null,
    bytes: k.svg.length,
  };
}

export function daysJson(today: Day, chain: ChainState | null, names: Names = NO_NAMES) {
  const days = [];
  for (let n = 1; n <= today.n; n++) {
    const j = dayJson(dayByNumber(n)!, today, chain, names);
    days.push({ day: j.day, date: j.date, renderer: j.renderer, traits: j.traits, state: j.state, owner: j.owner, ownerName: j.ownerName, tx: j.claim?.tx ?? null, image: j.image });
  }
  return { site: SITE, today: today.n, contract: chain ? { address: chain.address, chainId: chain.chainId, renderer: chain.renderer } : null, days };
}

export function holderJson(who: Address, today: Day, chain: ChainState, names: Names = NO_NAMES) {
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([n]) => n).sort((a, b) => a - b);
  return { address: who, name: names.get(who.toLowerCase()) ?? null, author: isAuthor(chain, who), days: mine.map((n) => dayJson(dayByNumber(n)!, today, chain, names)) };
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
    `DESCRIPTION:The contract drew today's runner at midnight UTC. Claim it, free, gas only: https://${SITE}/`,
    `URL:https://${SITE}/`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

