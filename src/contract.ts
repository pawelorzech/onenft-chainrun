/**
 * Reads state from the OneNFT contract. Without CONTRACT_ADDRESS the site
 * runs as a plain renderer with no chain.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

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
};

let cache: { at: number; state: ChainState } | null = null;
const TTL_MS = 12_000;

const client = CONTRACT
  ? createPublicClient({ chain, transport: http(process.env.BASE_RPC_URL) })
  : null;

export function contractEnabled(): boolean {
  return Boolean(client && CONTRACT);
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
      else if (!/revert/i.test(r.error?.message ?? "")) throw new Error(`ownerOf(${from + i}) failed: ${(r.error as any)?.shortMessage ?? r.error?.message}`);
    });
  }
  if (!fresh) {
    const past = new Map(owners);
    past.delete(day);
    pastOwners = { at: Date.now(), day: day - 1, owners: past };
  }
  return owners;
}

/** The last state that read cleanly. Served when the RPC fails, so a flaky RPC never blanks the page or the holder lists. */
let lastGood: ChainState | null = null;

export async function chainState(): Promise<ChainState | null> {
  if (!client || !CONTRACT) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.state;
  try {
    const state = await readChainState();
    lastGood = state;
    return state;
  } catch (e) {
    if (!lastGood) throw e;
    console.error("chain read failed, serving the last good state:", (e as Error).message);
    cache = { at: Date.now(), state: lastGood };
    return lastGood;
  }
}

async function readChainState(): Promise<ChainState> {
  const c = { address: CONTRACT as Address, abi: ABI } as const;
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
  const state: ChainState = { address: CONTRACT, chainId: CHAIN_ID, day, startEpoch, author, renderer, rendererLocked, secondsLeft: Number(secondsLeftBn), owners, claims };
  cache = { at: Date.now(), state };
  return state;
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
    console.error("claim scan:", (e as Error).message);
  } finally {
    scanning = false;
  }
}

export function startClaimScan(everyMs = 60_000): void {
  void scanClaims();
  setInterval(() => void scanClaims(), everyMs);
}
