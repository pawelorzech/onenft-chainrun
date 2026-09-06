/**
 * Share of days a slot item gets in the long run: its weight across the three
 * race tables, weighted by how often each race comes up. Used by the traits
 * page and by the holder facts.
 */
import { WEIGHTS } from "./layers.ts";

export function odds(slot: number, item: number): number {
  const raceTable = WEIGHTS[0][1];
  const raceShare = [0, 0, 0];
  raceTable.forEach((w, i) => { raceShare[i === 1 ? 2 : i > 11 ? 1 : 0] += w / 10000; });
  return raceShare.reduce((sum, share, race) => sum + share * ((WEIGHTS[race][slot][item] ?? 0) / 10000), 0);
}
