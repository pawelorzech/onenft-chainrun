import { expect, test } from "bun:test";
import { explorePage, traitsPage, holderPage, assetsPage, embedPage, PREVIEW_DAYS } from "./pages.ts";
import { dayJson, daysJson, specJson, calendarIcs } from "./api.ts";
import { dayByNumber } from "./chain.ts";
import type { ChainState } from "./contract.ts";

const A = "0x2222222222222222222222222222222222222222" as const;
function fakeChain(day: number, owners: Record<number, string>): ChainState {
  return {
    address: "0x1111111111111111111111111111111111111111",
    chainId: 84532,
    day,
    startEpoch: 20701n,
    author: "0xAAAA000000000000000000000000000000000001",
    renderer: "0x3333333333333333333333333333333333333333",
    rendererLocked: false,
    secondsLeft: 2000,
    owners: new Map(Object.entries(owners).map(([k, v]) => [Number(k), v as `0x${string}`])),
    claims: new Map([[1, { day: 1, to: A, tx: "0xabc", block: 5n, at: Number(dayByNumber(1)!.startsAt) + 1087, renderer: "0x3333333333333333333333333333333333333333" }]]),
  };
}

test("explore: every day so far is a cell, gaps are hatched, the preview reaches seven days out", () => {
  const t = dayByNumber(5)!;
  const h = explorePage(t, fakeChain(5, { 1: A, 3: A }));
  for (let n = 1; n <= 5; n++) expect(h).toContain(`href="/day/${n}"`);
  expect((h.match(/class="hole"/g) ?? []).length).toBe(2);
  expect(h).toContain(`/preview/${5 + PREVIEW_DAYS}.svg`);
  expect(h).not.toContain(`/preview/${6 + PREVIEW_DAYS}.svg`);
  expect(h).toContain("September 2026");
  // Every month grid is whole weeks: 7 headers plus a multiple of 7 cells.
  for (const cal of h.split('<div class="cal">').slice(1)) {
    const cells = (cal.split("</div></section>")[0].match(/class="(blank|later|dow|hole)"|<a href="\/day\//g) ?? []).length;
    expect(cells % 7).toBe(0);
  }
});

test("explore spans every month from day 1 to today", () => {
  const t = dayByNumber(120)!;
  const h = explorePage(t);
  for (const m of ["September 2026", "October 2026", "November 2026", "December 2026", "January 2027"]) expect(h).toContain(m);
});

test("traits: thirteen slots, every layer with odds and counts", () => {
  const h = traitsPage(dayByNumber(40)!, fakeChain(40, { 1: A }));
  for (const w of ["Background", "Mouth Accessory", "Beam", "Human", "Skull", "Bot", "Nouns", 'id="s0"', 'id="s12"', 'id="s1-2"', "none"]) expect(h).toContain(w);
  expect((h.match(/<tr id="s\d+-\d+"/g) ?? []).length).toBe(338);
});

test("holder page lists that wallet's days only", () => {
  const t = dayByNumber(5)!;
  const h = holderPage(A, "0x2222…", t, fakeChain(5, { 1: A, 2: "0x4444444444444444444444444444444444444444", 4: A }));
  expect(h).toContain('href="/day/1"');
  expect(h).toContain('href="/day/4"');
  expect(h).not.toContain('href="/day/2"');
  expect(h).toContain("2 days of 5");
});

test("assets page states CC0 and the embed snippet", () => {
  const h = assetsPage(dayByNumber(3)!);
  expect(h).toContain("CC0");
  expect(h).toContain("&lt;iframe src=&quot;https://chainrun.onenft.click/embed&quot;");
  expect(h).toContain("/spec.json");
  expect(h).toContain("/calendar.ics");
});

test("embed page links out to the top window", () => {
  const h = embedPage(dayByNumber(3)!);
  expect(h).toContain('target="_top"');
  expect(h).toContain("Day 3");
});

test("day JSON carries traits, owner and the claim", () => {
  const t = dayByNumber(3)!;
  const j = dayJson(dayByNumber(1)!, t, fakeChain(3, { 1: A }));
  expect(j.owner).toBe(A);
  expect(j.state).toBe("taken");
  expect(j.claim?.secondsAfterMidnight).toBe(1087);
  expect(j.traits.Race).toBe("Bot");
  expect(j.traits.Background).toBe("Green Stripe");
  expect(j.dna.length).toBe(13);
  expect(j.layers.length).toBe(10);
  expect(j.renderer).toBe(1);
  expect(dayJson(dayByNumber(2)!, t, fakeChain(3, { 1: A })).state).toBe("gap");
  expect(dayJson(t, t, fakeChain(3, { 1: A })).state).toBe("free");
});

test("days JSON has one entry per day and the spec has the tables", () => {
  expect(daysJson(dayByNumber(9)!, null).days.length).toBe(9);
  const s = specJson();
  expect(s.layers.length).toBe(338);
  expect(s.weights.length).toBe(3);
  expect(s.traitTypes.length).toBe(13);
  expect(s.license).toContain("CC0-1.0");
});

test("calendar is one daily event from day 1", () => {
  const ics = calendarIcs(dayByNumber(1)!);
  expect(ics).toContain("DTSTART:20260905T000000Z");
  expect(ics).toContain("RRULE:FREQ=DAILY");
  expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
});
