/**
 * One Chain Runner a day. Source of truth for contracts/src/RunnerRenderer.sol.
 *
 * Chain Runners (Ethereum, 2021, CC0) drew 10,000 pixel avatars on chain from
 * 338 layers in 13 slots: background, race, face, mouth, nose, eyes and seven
 * kinds of accessory. Each layer is 416 bytes: eight RGBA colors, then 1024
 * pixels at three bits each. A token's DNA picks one item per slot through
 * weight tables, a few rules keep masks and hats from colliding, and the
 * layers composite with alpha blending.
 *
 * Here the DNA comes from the day number: thirteen draws of splitmix64, each
 * taken mod 10,000. The selection rules and the compositing are ported from
 * ChainRunnersBaseRenderer.sol line by line, quirks included, so a reference
 * token from Ethereum renders pixel for pixel the same (see runners.test.ts).
 *
 * All arithmetic is integer and fits in uint64 so the same run ports to
 * Solidity byte for byte. A test enforces it.
 */
import { LAYERS, WEIGHTS, TRAIT_TYPES } from "./layers.ts";
import { START_EPOCH, EPOCH_SECONDS, epochOf } from "./chain.ts";
export { EPOCH_SECONDS, epochOf, TRAIT_TYPES };

const U64 = (1n << 64n) - 1n;

/** The splitmix64 finalizer, the same mixer onenft.click uses. */
export function mix64(x: bigint): bigint {
  let z = (x + 0x9e3779b97f4a7c15n) & U64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64;
  return (z ^ (z >> 31n)) & U64;
}

export const NUM_LAYERS = 13;
export const NUM_COLORS = 8;
export const RECORD = 416;

export type Layer = { layer: number; item: number; name: string; data: Uint8Array };

function bytesOf(hexString: string): Uint8Array {
  const out = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hexString.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** layers[slot][item], undefined where the weight table has a slot with no art ("none"). */
export const SLOTS: (Layer | undefined)[][] = Array.from({ length: NUM_LAYERS }, () => []);
for (const l of LAYERS) SLOTS[l.layer][l.item] = { ...l, data: bytesOf(l.data) };

/** Thirteen numbers in 0..9999 from the day: seed = mix64(day), dna[i] = mix64(seed + i) mod 10000. */
export function dnaForDay(day: number): number[] {
  const seed = mix64(BigInt(day));
  return Array.from({ length: NUM_LAYERS }, (_, i) => Number(mix64((seed + BigInt(i)) & U64) % 10000n));
}

/** A Chain Runners DNA (uint256) split the way the Ethereum renderer does it: mod 10000, then shift 14. */
export function splitDna(dna: bigint): number[] {
  const out: number[] = [];
  let n = dna;
  for (let i = 0; i < NUM_LAYERS; i++) {
    out.push(Number(n % 10000n));
    n >>= 14n;
  }
  return out;
}

/** 0 human or alien, 1 skull, 2 bot; from the race draw through the race table. */
export function raceIndex(d: number): number {
  let lower = 0;
  const table = WEIGHTS[0][1];
  for (let i = 0; i < table.length; i++) {
    if (d >= lower && d < lower + table[i]) return i === 1 ? 2 : i > 11 ? 1 : 0;
    lower += table[i];
  }
  throw new Error("dna out of range");
}

/** Item index in a slot, or the table length when the draw lands on no item. */
export function layerIndex(d: number, slot: number, race: number): number {
  let lower = 0;
  const table = WEIGHTS[race][slot];
  for (let i = 0; i < table.length; i++) {
    if (d >= lower && d < lower + table[i]) return i;
    lower += table[i];
  }
  return table.length;
}

/**
 * The layers a DNA wears, bottom to top, with the original's rules:
 * a mask hides the face, eye and mouth accessories; a face accessory hides the
 * face and mouth accessory; head above only shows on odd first draws.
 */
export function layersFor(dna: number[]): { slot: number; layer: Layer }[] {
  const race = raceIndex(dna[1]);
  const W = WEIGHTS[race];
  const hasFaceAcc = dna[7] < 10000 - W[7][7];
  const hasMask = dna[8] < 10000 - W[8][7];
  const hasHeadBelow = dna[9] < 10000 - W[9][36];
  const hasHeadAbove = dna[11] < 10000 - W[11][48];
  const useHeadAbove = dna[0] % 2 > 0;
  const out: { slot: number; layer: Layer }[] = [];
  for (let i = 0; i < NUM_LAYERS; i++) {
    const layer = SLOTS[i][layerIndex(dna[i], i, race)];
    if (!layer) continue;
    if (((i === 2 || i === 12) && !hasMask && !hasFaceAcc) || (i === 7 && !hasMask) || (i === 10 && !hasMask) || i < 2 || (i > 2 && i < 7) || i === 8 || i === 9 || i === 11) {
      // Same precedence as the Solidity source: (A && B && C) || D.
      if ((hasHeadBelow && hasHeadAbove && i === 9 && useHeadAbove) || (i === 11 && !useHeadAbove)) continue;
      out.push({ slot: i, layer });
    }
  }
  return out;
}

/** Color index 0..7 of pixel p in a layer: three bits per pixel, eight pixels per three bytes. */
export function colorIndex(data: Uint8Array, p: number): number {
  const k = 32 + 3 * (p >> 3);
  const i = p & 7;
  const b0 = data[k], b1 = data[k + 1], b2 = data[k + 2];
  if (i === 0) return b0 >> 5;
  if (i === 1) return (b0 >> 2) % 8;
  if (i === 2) return (b0 % 4) * 2 + (b1 >> 7);
  if (i === 3) return (b1 >> 4) % 8;
  if (i === 4) return (b1 >> 1) % 8;
  if (i === 5) return (b1 % 2) * 4 + (b2 >> 6);
  if (i === 6) return (b2 >> 3) % 8;
  return b2 % 8;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
function rgba(data: Uint8Array, c: number): [number, number, number, number] {
  return [data[c * 4], data[c * 4 + 1], data[c * 4 + 2], data[c * 4 + 3]];
}
function hexOf(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** The composited color of pixel p, top layer down, the original's blend: one semi-transparent layer over the first opaque one below it. */
export function pixelColor(layers: { layer: Layer }[], p: number): string {
  for (let i = layers.length - 1; i >= 0; i--) {
    const d = layers[i].layer.data;
    const [r, g, b, a] = rgba(d, colorIndex(d, p));
    if (a === 0) continue;
    if (a === 255) return hexOf(r, g, b);
    for (let j = i - 1; j >= 0; j--) {
      const e = layers[j].layer.data;
      const [br, bg, bb, ba] = rgba(e, colorIndex(e, p));
      if (ba > 0) {
        const alpha = a + 1, inv = 256 - a;
        return hexOf((alpha * r + inv * br) >> 8, (alpha * g + inv * bg) >> 8, (alpha * b + inv * bb) >> 8);
      }
    }
    return hexOf(r, g, b);
  }
  return "#000000";
}

/** 1024 colors, row by row. */
export function grid(layers: { layer: Layer }[]): string[] {
  return Array.from({ length: 1024 }, (_, p) => pixelColor(layers, p));
}

/** The image: one rect per horizontal run of one color. Same bytes from Solidity. */
export function svgOf(g: string[]): string {
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges">`;
  for (let y = 0; y < 32; y++) {
    let x = 0;
    while (x < 32) {
      const c = g[y * 32 + x];
      let w = 1;
      while (x + w < 32 && g[y * 32 + x + w] === c) w++;
      out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  }
  return out + "</svg>";
}

export type Palette = { name: string; bg: string; cord: string; shade: string; colors: string[] };
export type Trait = { type: string; value: string };
export type Runner = {
  svg: string;
  palette: Palette;
  epoch: bigint;
  day: number;
  dna: number[];
  race: string;
  layers: { slot: number; layer: Layer }[];
  traits: Trait[];
  /** The same traits as an object keyed by type, "none" where a slot is empty. */
  traitMap: Record<string, string>;
  version: 1;
};

function luma(c: string): number {
  return (2126 * parseInt(c.slice(1, 3), 16) + 7152 * parseInt(c.slice(3, 5), 16) + 722 * parseInt(c.slice(5, 7), 16)) / 10000;
}
function mixHex(a: string, b: string, t: number): string {
  const ch = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) + (parseInt(b.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)) * t).toString(16).padStart(2, "0");
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

/** Page colors: the top-left pixel (always background) as bg, the most used color far enough from it as fg. Named after the background layer. Site only, not on chain. */
export function paletteOf(g: string[], name: string): Palette {
  const bg = g[0];
  const count = new Map<string, number>();
  for (const c of g) count.set(c, (count.get(c) ?? 0) + 1);
  const ranked = [...count].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  let cord = ranked.find((c) => Math.abs(luma(c) - luma(bg)) >= 90) ?? (luma(bg) > 128 ? "#111111" : "#f2f2f2");
  return { name, bg, cord, shade: mixHex(cord, bg, 0.5), colors: ranked.slice(0, 6) };
}

export function renderDna(dna: number[], day: number, epoch: bigint): Runner {
  const layers = layersFor(dna);
  const g = grid(layers);
  const traits = layers.map(({ slot, layer }) => ({ type: TRAIT_TYPES[slot], value: layer.name }));
  const traitMap: Record<string, string> = {};
  for (const t of TRAIT_TYPES) traitMap[t] = "none";
  for (const t of traits) traitMap[t.type] = t.value;
  const race = traitMap["Race"];
  return { svg: svgOf(g), palette: paletteOf(g, traitMap["Background"]), epoch, day, dna, race, layers, traits, traitMap, version: 1 };
}

/** One line for lists and feeds: race, then up to three worn accessories. */
export function summary(r: Runner): string {
  const rest = r.traits.filter((t) => t.type !== "Race" && t.type !== "Background").map((t) => t.value);
  return rest.length ? `${r.race}, ${rest.slice(0, 3).join(", ")}` : r.race;
}

export function renderDay(day: number, epoch: bigint): Runner {
  return renderDna(dnaForDay(day), day, epoch);
}

/** The renderer for an epoch (unix day). Every page and image goes through here. */
export function runnerFor(epoch: bigint): Runner {
  const day = Number(epoch - START_EPOCH) + 1;
  return renderDay(day < 1 ? 1 : day, epoch);
}

/** The form in which the image leaves the contract. */
export function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
