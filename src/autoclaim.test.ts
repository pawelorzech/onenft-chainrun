import { expect, test } from "bun:test";
import { shouldClaim, isAuthorDay } from "./autoclaim.ts";
import type { ChainState } from "./contract.ts";

const st = (day: number, owners: number[] = []): ChainState => ({
  address: "0x1111111111111111111111111111111111111111", chainId: 8453, day, startEpoch: 20701n,
  author: "0xAAAA000000000000000000000000000000000001", rendererLocked: false, secondsLeft: 100,
  owners: new Map(owners.map((n) => [n, "0x2222222222222222222222222222222222222222" as const])),
});

test("author days are every tenth up to 1000", () => {
  expect(isAuthorDay(10)).toBe(true);
  expect(isAuthorDay(1000)).toBe(true);
  expect(isAuthorDay(1010)).toBe(false);
  expect(isAuthorDay(7)).toBe(false);
  expect(isAuthorDay(0)).toBe(false);
});

test("claims only an unclaimed author day", () => {
  expect(shouldClaim(st(10))).toBe(true);
  expect(shouldClaim(st(10, [10]))).toBe(false);
  expect(shouldClaim(st(11))).toBe(false);
  expect(shouldClaim(st(0))).toBe(false);
  expect(shouldClaim(null)).toBe(false);
});
