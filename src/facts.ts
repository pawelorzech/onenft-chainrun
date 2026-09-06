/**
 * What the chain says about one wallet's days, as tiles: a figure and a line
 * under it. Every fact is a count or a day number read from ownership and
 * claim logs; none of them is worth anything, and there is nothing to unlock.
 * A wallet with no days has no facts.
 */
import { runnerFor } from "./runners.ts";
import { odds } from "./odds.ts";
import { dayByNumber, type Day } from "./chain.ts";
import type { ChainState } from "./contract.ts";
import { isAuthorDay } from "./autoclaim.ts";
import type { Address } from "viem";

export type Fact = {
  kind: string;
  /** The big figure of the tile, e.g. "2 of 16". */
  figure: string;
  /** The line under the figure. */
  label: string;
  /** The same fact as one plain sentence, for JSON and screen readers. */
  text: string;
  /** The days the fact points at, ascending. */
  days: number[];
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function afterMidnightShort(s: number): string {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

/** The facts every daily collection shares: they come from ownership and claims alone. */
function chainFacts(who: Address, chain: ChainState, mine: number[], firstLabel: string): Fact[] {
  const me = who.toLowerCase();
  const facts: Fact[] = [];
  const author = chain.author.toLowerCase() === me;

  if (mine.includes(1)) facts.push({ kind: "first", figure: "Day 1", label: firstLabel, text: `Holds day 1, ${firstLabel}.`, days: [1] });

  let best: [number, number] = [mine[0], mine[0]], cur: [number, number] = [mine[0], mine[0]];
  for (const n of mine.slice(1)) {
    cur = n === cur[1] + 1 ? [cur[0], n] : [n, n];
    if (cur[1] - cur[0] > best[1] - best[0]) best = cur;
  }
  const len = best[1] - best[0] + 1;
  if (len >= 2) facts.push({ kind: "run", figure: String(len), label: `days in a row, the longest run, day ${best[0]} to ${best[1]}`, text: `Longest run: ${len} days in a row, day ${best[0]} to ${best[1]}.`, days: Array.from({ length: len }, (_, i) => best[0] + i) });

  // Only days the log scan has reached count.
  const known = mine.filter((n) => chain.claims.has(n));
  const claimed = known.filter((n) => chain.claims.get(n)!.to.toLowerCase() === me);
  const later = known.filter((n) => chain.claims.get(n)!.to.toLowerCase() !== me);
  if (claimed.length) facts.push({ kind: "claimed", figure: String(claimed.length), label: "claimed at the source", text: `Claimed ${claimed.length} ${plural(claimed.length, "day", "days")} at the source.`, days: claimed });
  if (later.length) facts.push({ kind: "later", figure: String(later.length), label: "from earlier holders", text: `Took ${later.length} ${plural(later.length, "day", "days")} from earlier holders.`, days: later });

  if (claimed.length) {
    let fast = claimed[0], fastS = Infinity;
    for (const n of claimed) {
      const s = chain.claims.get(n)!.at - Number(dayByNumber(n)!.startsAt);
      if (s < fastS) { fastS = s; fast = n; }
    }
    facts.push({ kind: "fastest", figure: afterMidnightShort(fastS), label: `after midnight UTC, the fastest claim, day ${fast}`, text: `Fastest claim: ${afterMidnightShort(fastS)} after midnight UTC, day ${fast}.`, days: [fast] });
  }

  if (!author) {
    const ad = mine.filter(isAuthorDay);
    if (ad.length) facts.push({ kind: "author-days", figure: String(ad.length), label: `author ${plural(ad.length, "day", "days")}, passed on by the author`, text: `Holds ${ad.length === 1 ? `author day ${ad[0]}` : `${ad.length} author days`}, passed on by the author.`, days: ad });
  }
  return facts;
}

/** An item this rare or rarer counts as rare. */
const RARE = 0.01;

export function holderFacts(who: Address, today: Day, chain: ChainState): Fact[] {
  const me = who.toLowerCase();
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === me).map(([n]) => n).sort((a, b) => a - b);
  if (!mine.length) return [];
  const facts = chainFacts(who, chain, mine, "the first runner");
  const runners = mine.map((n) => [n, runnerFor(dayByNumber(n)!.epoch)] as const);

  if (mine.length >= 2) {
    const races = [...new Set(runners.map(([, r]) => r.race))];
    facts.push({ kind: "races", figure: String(races.length), label: `${plural(races.length, "race", "races")}: ${races.join(", ")}`, text: `${races.length} ${plural(races.length, "race", "races")}: ${races.join(", ")}.`, days: mine });
  }

  // The fullest runner: how many of the thirteen slots it wears.
  let full = runners[0];
  for (const r of runners) if (r[1].layers.length > full[1].layers.length) full = r;
  facts.push({ kind: "slots", figure: `${full[1].layers.length} of 13`, label: `slots worn on day ${full[0]}, the fullest`, text: `${full[1].layers.length} of 13 slots worn on day ${full[0]}, the fullest.`, days: [full[0]] });

  // Rare items, at most four named.
  const hits: { n: number; text: string }[] = [];
  for (const [n, r] of runners) for (const { slot, layer } of r.layers) if (odds(slot, layer.item) <= RARE) hits.push({ n, text: `${layer.name} on day ${n}` });
  if (hits.length) {
    const shown = hits.slice(0, 4);
    const rest = hits.length - shown.length;
    const list = `${shown.map((h) => h.text).join(", ")}${rest ? ` and ${rest} more` : ""}`;
    facts.push({ kind: "rare", figure: String(hits.length), label: `rare ${plural(hits.length, "item", "items")}: ${list}`, text: `Rare items: ${list}.`, days: [...new Set(hits.map((h) => h.n))] });
  }

  return facts;
}
