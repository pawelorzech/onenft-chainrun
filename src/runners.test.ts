import { expect, test } from "bun:test";
import { dnaForDay, splitDna, renderDna, renderDay, layersFor, raceIndex, colorIndex, grid, svgOf, summary, SLOTS, NUM_LAYERS } from "./runners.ts";
import { LAYERS, WEIGHTS, TRAIT_TYPES } from "./layers.ts";
import reference from "./fixtures/ethereum-runners.json";

test("338 layers of 416 bytes in 13 slots; every weight table for human, skull and bot", () => {
  expect(LAYERS.length).toBe(338);
  for (const l of LAYERS) expect(l.data.length).toBe(832);
  expect(SLOTS.length).toBe(NUM_LAYERS);
  expect(TRAIT_TYPES.length).toBe(13);
  expect(WEIGHTS.length).toBe(3);
  for (const race of WEIGHTS) {
    expect(race.length).toBe(13);
    for (const t of race) expect(t.reduce((a, b) => a + b, 0) === 10000 || t.reduce((a, b) => a + b, 0) === 0).toBe(true);
  }
});

test("six Ethereum Chain Runners render pixel for pixel from their DNA", () => {
  for (const r of reference.runners) {
    const g = grid(layersFor(splitDna(BigInt(r.dna))));
    const ours = g.map((c) => c.slice(1)).join("");
    expect(ours).toBe(r.pixels);
  }
});

test("dna for a day is thirteen numbers below 10000 and differs between days", () => {
  const a = dnaForDay(1), b = dnaForDay(2);
  expect(a.length).toBe(13);
  for (const x of a) expect(x).toBeLessThan(10000);
  expect(a).not.toEqual(b);
  expect(dnaForDay(1)).toEqual(a);
});

test("race index follows the race table: item 1 bot, items above 11 skull", () => {
  expect(raceIndex(0)).toBe(0);
  expect(raceIndex(875)).toBe(2);
  expect(raceIndex(9999)).toBe(1);
});

test("a mask hides the face and the eye and mouth accessories", () => {
  // Force slot 8 (mask) onto its first item and every other slot onto its first item.
  const dna = new Array(13).fill(0);
  const worn = layersFor(dna);
  const slots = worn.map((w) => w.slot);
  expect(slots).toContain(8);
  expect(slots).not.toContain(2);
  expect(slots).not.toContain(10);
  expect(slots).not.toContain(12);
  // Even first draw: no head above.
  expect(slots).not.toContain(11);
});

test("color index reads three bits per pixel, eight pixels per three bytes", () => {
  const d = new Uint8Array(416);
  d[32] = 0b00100101; d[33] = 0b00111001; d[34] = 0b01110111; // 1,1,2,3,4,5,6,7
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => colorIndex(d, p))).toEqual([1, 1, 2, 3, 4, 5, 6, 7]);
});

test("svg is 32 by 32 with one rect per run and a readable page palette", () => {
  const r = renderDay(1, 0n);
  expect(r.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges"><rect x="0" y="0"')).toBe(true);
  expect(r.svg.endsWith("</svg>")).toBe(true);
  expect(r.svg.length).toBeLessThan(40000);
  expect(r.traits[0].type).toBe("Background");
  expect(r.traits[1].type).toBe("Race");
  expect(summary(r)).toContain(r.race);
  for (let d = 1; d <= 200; d++) {
    const p = renderDay(d, 0n).palette;
    expect(p.bg).not.toBe(p.cord);
    expect(p.colors[0]).toBeDefined();
  }
});

test("a year of days renders and every day wears a background and a race", () => {
  for (let d = 1; d <= 366; d++) {
    const r = renderDna(dnaForDay(d), d, 0n);
    expect(r.layers[0].slot).toBe(0);
    expect(r.layers[1].slot).toBe(1);
    expect(svgOf(grid(r.layers)).length).toBeGreaterThan(300);
  }
});
