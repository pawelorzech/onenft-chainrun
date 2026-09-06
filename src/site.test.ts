import { expect, test } from "bun:test";
import { homePage, dayPage, howPage, legalPage, feedXml, mix, dayState, STATE_TEXT, cssVars, contrast } from "./site.ts";
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

import type { ChainState, ChainStatus } from "./contract.ts";

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
    readAt: Date.now(),
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
  expect(h).toContain("Available today");
  expect(h).not.toContain("Claiming on-chain opens today");
});

test("with a contract: gaps and owners in the rows", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, { 1: "0x2222222222222222222222222222222222222222", 3: "0xAAAA000000000000000000000000000000000001" }));
  expect(h).toContain("held by 0x2222…2222");
  expect(h).toContain("the author's");
  expect((h.match(/class="row hole"/g) ?? []).length).toBe(2);
  expect(h).toMatch(/>2<\/span><br><span class="small">unclaimed day/);
});

test("with a contract: a taken day disables the button", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, { 5: "0x3333333333333333333333333333333333333333" }));
  expect(h).toContain("is claimed");
  expect(h).not.toContain('id="mint"');
  expect(h).toContain("Claimed, held by 0x3333…3333");
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
  expect(dayPage(dayByNumber(2)!, t, c)).toContain("held by");
  expect(dayPage(dayByNumber(3)!, t, c)).toContain("This day ended without a claim. It can no longer be minted.");
  expect(dayPage(t, t, c)).toContain(", available");
});

test("owner rows carry data-owner and ENS names replace hex when known", () => {
  const t = dayByNumber(5)!;
  const c = fakeChain(5, { 2: "0x2222222222222222222222222222222222222222" });
  const names = new Map([["0x2222222222222222222222222222222222222222", "pawel.eth"]]);
  const h = homePage(t, t.startsAt, c, names);
  expect(h).toContain('data-owner="0x2222222222222222222222222222222222222222"');
  expect(h).toContain("held by pawel.eth");
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
  expect(x).toContain("Unclaimed; it can no longer be minted.");
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

const DOWN: ChainStatus = { configured: true, known: false, stale: false, readAt: null, ageSeconds: null, error: "no answer", errorAt: Date.now(), scannedBlock: "0" };
const STALE: ChainStatus = { configured: true, known: true, stale: true, readAt: Date.parse("2026-09-05T12:04:00Z"), ageSeconds: 600, error: "no answer", errorAt: Date.now(), scannedBlock: "0" };
const FRESH: ChainStatus = { configured: true, known: true, stale: false, readAt: Date.now(), ageSeconds: 3, error: null, errorAt: null, scannedBlock: "0" };

test("a configured chain that did not answer says so instead of 'opens today', and ownership reads unknown, not gap", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, null, undefined, DOWN);
  expect(h).toContain("the chain did not answer");
  expect(h).toContain("Status unavailable");
  expect(h).not.toContain("opens today");
  expect(h).not.toContain('class="row hole"');
  expect(h).not.toContain("unclaimed day");
  expect(homePage(t, t.startsAt, null)).toContain("opens today");
});

test("a stale read is served with its age", () => {
  const t = dayByNumber(5)!;
  expect(homePage(t, t.startsAt, fakeChain(5, {}), undefined, STALE)).toContain("Collection status could not be refreshed. Showing data from 12:04 UTC.");
  expect(homePage(t, t.startsAt, fakeChain(5, {}), undefined, FRESH)).not.toContain("could not be refreshed");
  expect(dayPage(dayByNumber(3)!, t, fakeChain(5, {}), undefined, STALE)).toContain("Showing data from 12:04 UTC");
});

test("the five day states have their own words", () => {
  const c = fakeChain(21, { 1: "0x2222222222222222222222222222222222222222", 10: "0xAAAA000000000000000000000000000000000001" });
  expect(dayState(1, 21, c)).toBe("claimed");
  expect(dayState(10, 21, c)).toBe("author");
  expect(dayState(2, 21, c)).toBe("gap");
  expect(dayState(21, 21, c)).toBe("available");
  expect(dayState(30, 30, c)).toBe("author");
  expect(dayState(2, 21, null, DOWN)).toBe("unknown");
  for (const s of Object.values(STATE_TEXT)) expect(s.length).toBeGreaterThan(3);
});

test("the countdown never reloads the page; it reveals a notice instead", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, {}));
  expect(h).not.toContain("location.reload();return}");
  expect(h).toContain('id="newday"');
  expect(h).toContain("A new UTC day has started. Refresh to see it.");
});

test("the claim script keeps the hash per chain, contract, day and account, and a timeout offers a status check, not a resend", () => {
  const t = dayByNumber(5)!;
  const h = homePage(t, t.startsAt, fakeChain(5, {}));
  expect(h).toContain("onenft_claim:");
  expect(h).toContain('id="check"');
  expect(h).toContain("We cannot confirm the transaction yet. Check its status before trying again.");
  expect(h).toContain("Transaction sent. Waiting for confirmation.");
  expect(h).toContain("0 ETH mint fee. You pay network gas.");
  expect(h).toContain("accountsChanged");
});

test("owner links use the full address, never the short label; a hostile name cannot break the title", () => {
  const t = dayByNumber(5)!;
  const who = "0x2222222222222222222222222222222222222222" as const;
  const d = dayPage(dayByNumber(1)!, t, fakeChain(5, { 1: who }));
  expect(d).toContain(`href="/${who}"`);
  expect(d).not.toContain('href="/0x2222…2222"');
  const names = new Map([[who, '</title><script>alert(1)</script>"']]);
  const h = homePage(t, t.startsAt, fakeChain(5, { 1: who }), names);
  expect(h).not.toContain("<script>alert(1)</script>");
  expect(dayPage(dayByNumber(1)!, t, fakeChain(5, { 1: who }), names)).not.toContain("<script>alert(1)</script>");
});

test("muted text keeps 4.5:1 and control edges keep 3:1 on every day of the first year, and the page ink stays readable", () => {
  for (let n = 1; n <= 400; n += 1) {
    const t = dayByNumber(n)!;
    const h = homePage(t, t.startsAt);
    const bg = h.match(/--bg:(#[0-9a-f]{6})/)![1], muted = h.match(/--muted:(#[0-9a-f]{6})/)![1], edge = h.match(/--edge:(#[0-9a-f]{6})/)![1], fg = h.match(/--fg:(#[0-9a-f]{6})/)![1];
    expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(edge, bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  }
}, 20000);

test("terms and privacy pages say what the site does and link back", () => {
  const t = legalPage("terms", today);
  expect(t).toContain("Terms of use");
  expect(t).toContain("CC0");
  expect(t).toContain('href="https://onenft.click"');
  const p = legalPage("privacy", today);
  expect(p).toContain("No accounts, no cookies");
  expect(p).toContain("local storage");
  for (const f of [t, p]) expect(f).toContain("Last changed");
});
