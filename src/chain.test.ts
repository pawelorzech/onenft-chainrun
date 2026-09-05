import { expect, test } from "bun:test";
import { dayByNumber, dayOfTime, secondsLeft, secondsToStart, dateOf, START_EPOCH, EPOCH_SECONDS } from "./chain.ts";

test("day 1 starts at START_EPOCH midnight UTC", () => {
  expect(dayOfTime(START_EPOCH * EPOCH_SECONDS)?.n).toBe(1);
  expect(dayOfTime(START_EPOCH * EPOCH_SECONDS - 1n)).toBeNull();
});

test("dayByNumber and dayOfTime are inverse", () => {
  for (const n of [1, 2, 90, 1000]) {
    const d = dayByNumber(n)!;
    expect(dayOfTime(d.startsAt)?.n).toBe(n);
    expect(dayOfTime(d.startsAt + EPOCH_SECONDS - 1n)?.n).toBe(n);
  }
  expect(dayByNumber(0)).toBeNull();
  expect(dayByNumber(1.5)).toBeNull();
});

test("secondsLeft counts down to midnight", () => {
  const first = START_EPOCH * EPOCH_SECONDS;
  expect(secondsLeft(first)).toBe(86400);
  expect(secondsLeft(first + 86399n)).toBe(1);
});

test("secondsToStart hits zero at day 1", () => {
  const first = START_EPOCH * EPOCH_SECONDS;
  expect(secondsToStart(first - 30n)).toBe(30);
  expect(secondsToStart(first)).toBe(0);
});

test("day 1 is 5 September 2026", () => {
  expect(dateOf(20701n)).toBe("5 September 2026");
});
