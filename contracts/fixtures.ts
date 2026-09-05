/**
 * Generates fixtures for the TS ↔ Solidity byte-equality tests and the data
 * blobs the deploy script writes into DataStore contracts. TypeScript is the
 * source of truth.
 *
 * Blobs: `stores` holds the 338 layers in (slot, item) order, 59 per store
 * (59 * 416 = 24,544 bytes, under the code size limit). `meta` holds, in order:
 * WEIGHTS as uint16 for 3 races times 346 slots; the slot index as uint16 per
 * slot (global layer number plus one, 0 for no art); then one length-prefixed
 * name per global layer.
 */
import { renderDay, RECORD } from "../src/runners.ts";
import { LAYERS, WEIGHTS } from "../src/layers.ts";

export const PER_STORE = 59;
const sorted = [...LAYERS].sort((a, b) => a.layer - b.layer || a.item - b.item);
const slotSizes = WEIGHTS[0].map((t) => t.length); // 44,15,33,14,11,74,11,8,8,37,33,49,9
const slotOffsets = slotSizes.map((_, i) => slotSizes.slice(0, i).reduce((a, b) => a + b, 0));
const totalSlots = slotSizes.reduce((a, b) => a + b, 0); // 346

const stores: string[] = [];
for (let i = 0; i < sorted.length; i += PER_STORE) stores.push("0x" + sorted.slice(i, i + PER_STORE).map((l) => l.data).join(""));

const meta: number[] = [];
const u16 = (v: number) => meta.push(v >> 8, v & 255);
for (let r = 0; r < 3; r++) for (let s = 0; s < 13; s++) for (let k = 0; k < slotSizes[s]; k++) u16(WEIGHTS[r][s][k]);
const index = new Array(totalSlots).fill(0);
sorted.forEach((l, g) => { index[slotOffsets[l.layer] + l.item] = g + 1; });
for (const v of index) u16(v);
for (const l of sorted) {
  const n = Buffer.from(l.name, "utf8");
  if (n.length > 255 || l.data.length !== RECORD * 2) throw new Error("bad layer");
  meta.push(n.length, ...n);
}
const hex = (b: number[]) => "0x" + b.map((x) => x.toString(16).padStart(2, "0")).join("");
await Bun.write(new URL("./test/fixtures/runner_data.json", import.meta.url).pathname, JSON.stringify({ stores, meta: hex(meta), slotSizes, layers: sorted.length }));

const START = 20701n;
const days = [...Array.from({ length: 14 }, (_, i) => i + 1), 100, 365, 1000, 4243, 9999, 50000, 123456];
const fixtures = days.map((d) => {
  const r = renderDay(d, START + BigInt(d - 1));
  return { day: d, epoch: (START + BigInt(d - 1)).toString(), dna: r.dna, palette: r.palette.name, svg: r.svg, traits: r.traits };
});
await Bun.write(new URL("./test/fixtures/runner_days.json", import.meta.url).pathname, JSON.stringify(fixtures, null, 1));
console.log(`${fixtures.length} day fixtures; ${stores.length} stores, meta ${meta.length} bytes, ${totalSlots} slots`);
