/**
 * Author days (every tenth up to 1000) belong to the author, but nobody else
 * will pay gas for them. This loop claims them from the deployer wallet so
 * they never become gaps. Runs only when DEPLOYER_KEY is set.
 */
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, CONTRACT, chain, chainState, type ChainState } from "./contract.ts";

export function isAuthorDay(day: number): boolean {
  return day > 0 && day % 10 === 0 && day <= 1000;
}

/** Pure decision, so it can be tested without a chain. */
export function shouldClaim(state: ChainState | null): boolean {
  if (!state || state.day === 0) return false;
  return isAuthorDay(state.day) && !state.owners.has(state.day);
}

export function startAutoclaim(key: Hex, everyMs = 5 * 60_000): void {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(process.env.BASE_RPC_URL) });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const st = await chainState();
      if (shouldClaim(st)) {
        const hash = await wallet.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "claim" });
        console.log(`autoclaim: day ${st!.day} for the author, tx ${hash}`);
      }
    } catch (e) {
      console.error("autoclaim:", (e as Error).message);
    } finally {
      busy = false;
    }
  };
  void tick();
  setInterval(tick, everyMs);
  console.log(`autoclaim armed from ${account.address}, every ${everyMs / 60000} min`);
}
