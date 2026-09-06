import { expect, test } from "bun:test";
import { holderFacts } from "./facts.ts";
import { dayByNumber } from "./chain.ts";
import type { ChainState, Claim } from "./contract.ts";

const A = "0x2222222222222222222222222222222222222222" as const;
const B = "0x4444444444444444444444444444444444444444" as const;
const AUTHOR = "0xAAAA000000000000000000000000000000000001" as const;
function chain(day: number, owners: Record<number, string>, claims: Partial<Claim>[] = []): ChainState {
  return {
    address: "0x1111111111111111111111111111111111111111", chainId: 84532, day, startEpoch: 20701n, author: AUTHOR,
    renderer: "0x3333333333333333333333333333333333333333", rendererLocked: false, secondsLeft: 2000, readAt: Date.now(),
    owners: new Map(Object.entries(owners).map(([k, v]) => [Number(k), v as `0x${string}`])),
    claims: new Map(claims.map((c) => [c.day!, { tx: "0xabc", block: 1n, renderer: "0x3333333333333333333333333333333333333333", at: Number(dayByNumber(c.day!)!.startsAt) + 60, ...c } as Claim])),
  };
}

test("no days, no facts", () => {
  expect(holderFacts(A, dayByNumber(9)!, chain(9, { 2: B }))).toEqual([]);
});

test("chain facts, then races and the fullest runner", () => {
  const f = holderFacts(A, dayByNumber(9)!, chain(9, { 1: A, 3: A, 4: A, 7: B }, [{ day: 1, to: A, at: Number(dayByNumber(1)!.startsAt) + 42 }, { day: 3, to: B }]));
  expect(f.map((x) => x.kind).slice(0, 5)).toEqual(["first", "run", "claimed", "later", "fastest"]);
  expect(f[0].label).toBe("the first runner");
  expect(f[4].figure).toBe("42 s");
  expect(f.find((x) => x.kind === "races")!.label).toMatch(/^races?: /);
  expect(f.find((x) => x.kind === "slots")!.figure).toMatch(/^\d+ of 13$/);
});

test("a single day still names its slots", () => {
  const f = holderFacts(A, dayByNumber(9)!, chain(9, { 5: A }));
  expect(f.map((x) => x.kind)).toContain("slots");
  expect(f.map((x) => x.kind)).not.toContain("races");
});
