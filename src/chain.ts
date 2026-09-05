/**
 * The clock. A day is unix seconds / 86400 in UTC, the same number the
 * contract computes from block.timestamp. No RPC needed to know the day.
 */
export const EPOCH_SECONDS = 86400n;
export function epochOf(unixSeconds: bigint): bigint {
  return unixSeconds / EPOCH_SECONDS;
}

/** Epoch of day 1: 2026-09-05 UTC. Can be overridden by env or by the contract. */
export let START_EPOCH = BigInt(process.env.START_EPOCH ?? "20701");
export function setStartEpoch(e: bigint): void {
  START_EPOCH = e;
}

export function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export type Day = {
  /** 1-based day number; day 1 = START_EPOCH. */
  n: number;
  epoch: bigint;
  /** First unix second of this day (00:00 UTC). */
  startsAt: bigint;
};

export function dayOfEpoch(epoch: bigint): Day | null {
  if (epoch < START_EPOCH) return null;
  return { n: Number(epoch - START_EPOCH) + 1, epoch, startsAt: epoch * EPOCH_SECONDS };
}
export function dayOfTime(unixSeconds: bigint): Day | null {
  return dayOfEpoch(epochOf(unixSeconds));
}
export function dayByNumber(n: number): Day | null {
  if (!Number.isInteger(n) || n < 1) return null;
  return dayOfEpoch(START_EPOCH + BigInt(n - 1));
}
/** Seconds until day 1 starts; 0 once it has. */
export function secondsToStart(unixSeconds: bigint): number {
  const first = START_EPOCH * EPOCH_SECONDS;
  return unixSeconds >= first ? 0 : Number(first - unixSeconds);
}
/** Seconds left in the day that contains `unixSeconds`. */
export function secondsLeft(unixSeconds: bigint): number {
  return Number((epochOf(unixSeconds) + 1n) * EPOCH_SECONDS - unixSeconds);
}
/** Calendar date of an epoch, e.g. "5 September 2026". */
export function dateOf(epoch: bigint): string {
  return new Date(Number(epoch * EPOCH_SECONDS) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
