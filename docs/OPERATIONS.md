# Operations

Last verified: 2026-09-05

## Deploy contracts

`contracts/deploy.sh sepolia|mainnet` reads the deployer secret from Keychain and the author address from `~/.config/onenft/author.json`, generates fixtures if missing, deploys the six layer stores, the meta store, `RunnerRenderer` and `OneNFT`, verifies on Sourcify and writes `~/.config/onenft-chainrun/deploy-<net>.json`. `START_EPOCH` defaults to today; the constructor rejects a start in the past or more than 7 days ahead. Then `contracts/wire.sh <net>` writes `CONTRACT_ADDRESS`, `CHAIN_ID`, `START_EPOCH`, `BASE_RPC_URL` into the Coolify app (uuids from `~/.config/onenft-chainrun/coolify.json`) and redeploys.

The script prints simulated addresses before broadcasting. If a transaction is rejected (it happened once with "exceeds max transaction gas limit" when `tokenURI` cost 20M), check `cast code` for each address before trusting the record, then fix and rerun the whole script; the stores cost cents.

If Sourcify's verification of the renderer fails inside the script, rerun it alone:

```sh
forge verify-contract <renderer> src/RunnerRenderer.sol:RunnerRenderer --verifier sourcify --chain <id> \
  --constructor-args $(cast abi-encode "c(uint256,address[6],address)" <startEpoch> "[<s0>,<s1>,<s2>,<s3>,<s4>,<s5>]" <meta>)
```

## After every deploy

`contracts/check.sh sepolia|mainnet` compares every data store's code with the fixture blob byte for byte and the renderer's `svg()` for an early, a late and a far day with the TypeScript output. The constructors only check blob lengths, so two same-size blobs in the wrong order would pass them; this script is what catches it. Run it before `wire.sh`.

## Change the drawing

Edit `src/runners.ts`, run `bun test`, `bun run contracts/fixtures.ts`, port the change to `RunnerRenderer.sol`, run `forge test` and check `--gas-report`. Deploy a new renderer (the stores can be reused: pass the existing addresses) and switch with `setRenderer` from the author wallet. Claimed days keep their renderer.

## Analytics

Umami, same instance as onenft.click, when `UMAMI_URL` and `UMAMI_WEBSITE_ID` are set. The test site has neither.

## Health

`/health` returns the day and, with a contract, the address and the number of scanned claims. Container logs should show `autoclaim armed` when `DEPLOYER_KEY` is set. `scripts/status.sh mainnet|sepolia` prints one screen of chain and site state.
