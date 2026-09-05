/**
 * Reads state from the OneNFT contract. Without CONTRACT_ADDRESS the site
 * runs as a plain renderer with no chain.
 *
 * One rule for the cache: a page never waits on the RPC when a last good state
 * exists. It gets that state at once and a refresh runs behind it, shared by
 * every request that arrives while it runs. Only the first read after boot
 * waits, and only up to a deadline. Failures back off; the age of the last
 * good read is public, so pages and JSON can say how old their data is.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import { setStartEpoch } from "./chain.ts";
import { Swr } from "./swr.ts";

export const CONTRACT = (process.env.CONTRACT_ADDRESS ?? "") as Address | "";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? (CONTRACT ? 84532 : 0));
export const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const ABI = parseAbi([
  "function currentDay() view returns (uint256)",
  "function startEpoch() view returns (uint256)",
  "function author() view returns (address)",
  "function renderer() view returns (address)",
  "function rendererLocked() view returns (bool)",
  "function secondsLeft() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isAuthorDay(uint256 day) pure returns (bool)",
  "function claim() returns (uint256)",
]);
const CLAIMED = parseAbiItem("event Claimed(uint256 indexed day, address indexed to, uint256 epoch, address renderer)");

export type Claim = {
  day: number;
  to: Address;
  tx: Hex;
  block: bigint;
  /** Unix seconds of the block, so "claimed 4 min after midnight" can be shown. */
  at: number;
  renderer: Address;
};

export type ChainState = {
  address: Address;
  chainId: number;
  day: number;
  startEpoch: bigint;
  author: Address;
  renderer: Address;
  rendererLocked: boolean;
  secondsLeft: number;
  /** day → owner; a missing entry is today's day still nobody's, or a gap on earlier days. */
  owners: Map<number, Address>;
  /** day → the claim transaction, once the log scan has reached it. */
  claims: Map<number, Claim>;
  /** Unix milliseconds of the read this state came from. */
  readAt: number;
};

/** How the chain data a page holds relates to the chain right now. */
export type ChainStatus = {
  configured: boolean;
  /** A good read exists (the state served may still be old). */
  known: boolean;
  /** The last good read is older than STALE_AFTER_MS. */
  stale: boolean;
  /** Unix milliseconds of the last good read, null when none. */
  readAt: number | null;
  ageSeconds: number | null;
  /** Message of the last failed read, without URLs or keys. Null when the last read succeeded. */
  error: string | null;
  errorAt: number | null;
  /** Blocks the claim log scan has reached, and whether that scan is behind the chain head. */
  scannedBlock: string;
};

/** A fresh read is reused for this long. */
const TTL_MS = 12_000;
/** A last good read older than this is reported as stale on every page and in every JSON. */
export const STALE_AFTER_MS = Number(process.env.STALE_AFTER_MS ?? 90_000);
/** The longest a request waits for the first read after boot, or for any read when there is no last good state. */
const DEADLINE_MS = Number(process.env.CHAIN_DEADLINE_MS ?? 2_500);
/** After a failed read, no new read starts for this long; it doubles per failure up to BACKOFF_MAX_MS. */
const BACKOFF_MIN_MS = 3_000;
const BACKOFF_MAX_MS = 60_000;
/** One RPC call's own timeout; well under the sum a page could otherwise wait. */
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 8_000);

export const client = CONTRACT
  ? createPublicClient({ chain, transport: http(process.env.BASE_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }) })
  : null;

export function contractEnabled(): boolean {
  return Boolean(client && CONTRACT);
}

/** Errors from the RPC can quote the URL it was sent to, which may carry a key. Keep the first line, without URLs. */
export function scrubError(e: unknown): string {
  const m = ((e as any)?.shortMessage ?? (e as Error)?.message ?? String(e)).split("\n")[0];
  return m.replace(/https?:\/\/\S+/g, "[rpc]").slice(0, 200);
}

/** Past days change hands rarely; their owners refresh every 10 minutes, today's every 12 s. */
const PAST_TTL_MS = 10 * 60_000;
let pastOwners: { at: number; day: number; owners: Map<number, Address> } | null = null;

async function ownersUpTo(day: number): Promise<Map<number, Address>> {
  if (!client) return new Map();
  const c = { address: CONTRACT as Address, abi: ABI } as const;
  const fresh = pastOwners && pastOwners.day === day - 1 && Date.now() - pastOwners.at < PAST_TTL_MS;
  const from = fresh ? day : 1;
  const ids = Array.from({ length: day - from + 1 }, (_, i) => BigInt(from + i));
  const owners = new Map<number, Address>(fresh ? pastOwners!.owners : []);
  if (ids.length) {
    const res = await client.multicall({
      contracts: ids.map((id) => ({ ...c, functionName: "ownerOf" as const, args: [id] as const })),
      allowFailure: true,
    });
    res.forEach((r, i) => {
      if (r.status === "success") owners.set(from + i, r.result as Address);
      // A revert means the token does not exist (a gap). Anything else is the RPC failing, and a failing RPC must not turn every day into a gap.
      else if (!/revert/i.test(r.error?.message ?? "")) throw new Error(`ownerOf(${from + i}) failed: ${scrubError(r.error)}`);
    });
  }
  if (!fresh) {
    const past = new Map(owners);
    past.delete(day);
    pastOwners = { at: Date.now(), day: day - 1, owners: past };
  }
  return owners;
}

/**
 * The last state that read cleanly, served at once while a refresh runs behind
 * it, so a flaky RPC never blanks the page or the holder lists. See swr.ts.
 */
const store = new Swr<ChainState>({
  load: readChainState,
  ttlMs: TTL_MS,
  staleAfterMs: STALE_AFTER_MS,
  deadlineMs: DEADLINE_MS,
  backoffMinMs: BACKOFF_MIN_MS,
  backoffMaxMs: BACKOFF_MAX_MS,
  describe: scrubError,
  // The clock's idea of day 1 follows the contract, on every good read, not only at boot.
  onValue: (state) => setStartEpoch(state.startEpoch),
  onError: (message, failures) => console.error(`chain read failed (${failures}):`, message),
});

/**
 * The state to render a page with: the last good read, at once, with a refresh
 * behind it when it is older than TTL. Null when no contract is configured, or
 * when nothing has ever been read and the read in flight does not answer before
 * the deadline. Never throws; the reason for a null is in chainStatus().
 */
export async function chainState(): Promise<ChainState | null> {
  if (!client || !CONTRACT) return null;
  return store.get();
}

/** Forces a read and waits for it, for the boot log and the keeper. Throws on failure. */
export function readNow(): Promise<ChainState> {
  return store.refresh();
}

export function chainStatus(): ChainStatus {
  const s = store.status();
  return { configured: contractEnabled(), known: s.known, stale: s.stale, readAt: s.readAt, ageSeconds: s.ageSeconds, error: s.error, errorAt: s.errorAt, scannedBlock: scanned.toString() };
}

async function readChainState(): Promise<ChainState> {
  if (!client || !CONTRACT) throw new Error("no contract configured");
  const c = { address: CONTRACT, abi: ABI } as const;
  const [dayBn, startEpoch, author, renderer, rendererLocked, secondsLeftBn] = await client.multicall({
    contracts: [
      { ...c, functionName: "currentDay" },
      { ...c, functionName: "startEpoch" },
      { ...c, functionName: "author" },
      { ...c, functionName: "renderer" },
      { ...c, functionName: "rendererLocked" },
      { ...c, functionName: "secondsLeft" },
    ],
    allowFailure: false,
  });
  const day = Number(dayBn);
  const owners = day > 0 ? await ownersUpTo(day) : new Map<number, Address>();
  return { address: CONTRACT, chainId: CHAIN_ID, day, startEpoch, author, renderer, rendererLocked, secondsLeft: Number(secondsLeftBn), owners, claims, readAt: Date.now() };
}

// ---- claim log ----
// The Claimed event carries the transaction and the block, so a day page can
// say who came and how long after midnight. Scanned in chunks in the background;
// pages show what has been scanned so far.

const claims = new Map<number, Claim>();
const CHUNK = BigInt(process.env.LOG_CHUNK ?? "10000");
let scanned = BigInt(process.env.CONTRACT_BLOCK ?? (CHAIN_ID === 8453 ? "50880000" : "0"));
let scanning = false;

export async function scanClaims(): Promise<void> {
  if (!client || scanning) return;
  scanning = true;
  try {
    const head = await client.getBlockNumber();
    while (scanned < head) {
      const to = scanned + CHUNK > head ? head : scanned + CHUNK;
      const logs = await client.getLogs({ address: CONTRACT as Address, event: CLAIMED, fromBlock: scanned, toBlock: to });
      for (const l of logs) {
        const block = await client.getBlock({ blockNumber: l.blockNumber });
        claims.set(Number(l.args.day), { day: Number(l.args.day), to: l.args.to!, tx: l.transactionHash, block: l.blockNumber, at: Number(block.timestamp), renderer: l.args.renderer! });
      }
      scanned = to + 1n;
    }
  } catch (e) {
    console.error("claim scan:", scrubError(e));
  } finally {
    scanning = false;
  }
}

export function startClaimScan(everyMs = 60_000): void {
  void scanClaims();
  setInterval(() => void scanClaims(), everyMs);
}
