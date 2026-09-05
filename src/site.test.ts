import { expect, test } from "bun:test";
import { homePage, dayPage, howPage, feedXml, mix } from "./site.ts";
import { dayByNumber } from "./chain.ts";
import { EPOCH_SECONDS } from "./chain.ts";

const today = dayByNumber(7)!;

test("mix interpolates colors", () => {
  expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
  expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
  expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
});

test("home lists every earlier day, today not among the rows", () => {
  const h = homePage(today, today.startsAt + 100n);
  for (let n = 1; n < 7; n++) expect(h).toContain(`href="/day/${n}"`);
  expect(h).not.toContain(`class="row" href="/day/7"`);
  expect(h).toContain("<title>Day 7 | chainrun.onenft.click</title>");
});

test("page palette is today's palette", () => {
  const h = homePage(today, today.startsAt);
  expect(h).toMatch(/--bg:#[0-9a-f]{6};--fg:#[0-9a-f]{6}/);
  const bg = h.match(/--bg:(#[0-9a-f]{6})/)![1];
  expect(h).toContain(`<meta name="theme-color" content="${bg}">`);
});

test("day page navigates both ways only when neighbours exist", () => {
  const d3 = dayPage(dayByNumber(3)!, today);
  expect(d3).toContain('href="/day/2"');
  expect(d3).toContain('href="/day/4"');
  const d1 = dayPage(dayByNumber(1)!, today);
  expect(d1).not.toContain('href="/day/0"');
  const d7 = dayPage(today, today);
  expect(d7).not.toContain('href="/day/8"');
});

test("how page explains the traits and points at the spec", () => {
  const f = howPage(today);
  for (const w of ["338", "13 slots", "dna[i] = mix(seed + i) mod 10000", "mask", "/spec.json", "CC0"]) expect(f).toContain(w);
});

test("day one gets a sentence instead of an empty list", () => {
  const d1 = dayByNumber(1)!;
  const h = homePage(d1, d1.startsAt + EPOCH_SECONDS / 2n);
  expect(h).toContain("This is day one");
  expect(h).not.toContain('class="row"');
});

import type { ChainState } from "./contract.ts";

function fakeChain(day: number, owners: Record<number, string>, extra: Partial<ChainState> = {}): ChainState {
  return {
    address: "0x1111111111111111111111111111111111111111",
    chainId: 84532,
    day,
    startEpoch: 20701n,
    author: "0xAAAA000000000000000000000000000000000001",
    renderer: "0x2222222222222222222222222222222222222222",
    rendererLocked: false,
    secondsLeft: 2000,
    claims: new Map(),
    owners: new Map(Object.entries(owners).map(([k, v]) => [Number(k), v as `0x${string}`])),
    ...extra,
  };
}

test("with a contract: a free day has the mint button and script", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, { 1: "0x2222222222222222222222222222222222222222", 3: "0xAAAA000000000000000000000000000000000001" }));
  expect(h).toContain('id="mint"');
  expect(h).toContain("0x4e71d92d");
  expect(h).toContain("wallet_switchEthereumChain");
  expect(h).toContain("still nobody's");
  expect(h).not.toContain("Claiming on-chain opens today");
});

test("with a contract: gaps and owners in the rows", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, { 1: "0x2222222222222222222222222222222222222222", 3: "0xAAAA000000000000000000000000000000000001" }));
  expect(h).toContain("taken by 0x2222…2222");
  expect(h).toContain("the author's");
  expect((h.match(/class="row hole"/g) ?? []).length).toBe(2);
  expect(h).toMatch(/>2<\/span><br><span class="small">nobody came/);
});

test("with a contract: a taken day disables the button", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, { 5: "0x3333333333333333333333333333333333333333" }));
  expect(h).toContain("is taken");
  expect(h).not.toContain('id="mint"');
  expect(h).toContain("taken by 0x3333…3333");
});

test("with a contract: an author day has no button for people", () => {
  const t = dayByNumber(10)!;
  const h = homePage(t, t.startsAt, fakeChain(10, {}));
  expect(h).toContain("goes to the author");
  expect(h).not.toContain('id="mint"');
});

test("day page shows the owner or the gap", () => {
  const t = dayByNumber(5)!;
  const c = fakeChain(5, { 2: "0x2222222222222222222222222222222222222222" });
  expect(dayPage(dayByNumber(2)!, t, c)).toContain("taken by");
  expect(dayPage(dayByNumber(3)!, t, c)).toContain("nobody came");
  expect(dayPage(t, t, c)).toContain("still nobody's");
});

test("owner rows carry data-owner and ENS names replace hex when known", () => {
  const t = dayByNumber(5)!;
  const c = fakeChain(5, { 2: "0x2222222222222222222222222222222222222222" });
  const names = new Map([["0x2222222222222222222222222222222222222222", "pawel.eth"]]);
  const h = homePage(t, t.startsAt, c, names);
  expect(h).toContain('data-owner="0x2222222222222222222222222222222222222222"');
  expect(h).toContain("taken by pawel.eth");
  expect(h).toContain('id="yours"');
});

test("day page links to OpenSea and Basescan only for claimed days", () => {
  const t = dayByNumber(5)!;
  const c = fakeChain(5, { 2: "0x2222222222222222222222222222222222222222" });
  expect(dayPage(dayByNumber(2)!, t, c)).toContain("opensea.io/assets/base_sepolia/");
  expect(dayPage(dayByNumber(3)!, t, c)).not.toContain("opensea.io");
  expect(dayPage(dayByNumber(3)!, t, c)).toContain('href="/day/3.png"');
});

test("feed lists days newest first with a PNG enclosure", () => {
  const t = dayByNumber(3)!;
  const x = feedXml(t, fakeChain(3, { 1: "0x2222222222222222222222222222222222222222" }));
  expect(x.indexOf("<title>Day 3</title>")).toBeLessThan(x.indexOf("<title>Day 1</title>"));
  expect(x).toContain('enclosure url="https://chainrun.onenft.click/day/2.png"');
  expect(x).toContain("Nobody came");
});

test("every page carries og:image and the feed link", () => {
  const t = dayByNumber(2)!;
  expect(homePage(t, t.startsAt)).toContain('og:image" content="https://chainrun.onenft.click/day/2.png"');
  expect(howPage(t)).toContain('type="application/rss+xml"');
});

test("OpenSea collection link appears with a contract, never without", () => {
  const t = dayByNumber(5)!;
  expect(homePage(t, t.startsAt, fakeChain(5, {}))).toContain("Collection on OpenSea");
  expect(homePage(t, t.startsAt)).not.toContain("OpenSea");
  expect(homePage(t, t.startsAt, { ...fakeChain(5, {}), chainId: 8453 })).toContain("opensea.io/collection/chainrun-onenft-click");
});
