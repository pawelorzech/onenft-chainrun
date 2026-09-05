# chainrun.onenft.click

One Chain Runner a day, drawn on chain from the clock of the Base chain. One of the daily collections listed at onenft.click (hub repo `~/Programowanie/onenft-hub`); the knot lives at knot.onenft.click (`~/Programowanie/onenft`) and blit.onenft.click (`~/Programowanie/onenft-blit`), built from their code on 2026-09-05. Operational identifiers that should not be public live in `CLAUDE.local.md` (gitignored).

## What this is

- Every UTC day the contract can mint exactly one ERC-721 token, `tokenId = day number`. A day nobody claims stays empty forever.
- Day n's DNA is thirteen splitmix64 draws seeded with n, each mod 10,000. Selection (three race tables, per-slot weight walk, mask and hat rules) and alpha blending are ported from `ChainRunnersBaseRenderer.sol` line by line, quirks included. `src/fixtures/ethereum-runners.json` holds six real Chain Runners; `src/runners.test.ts` renders them from DNA and matches pixel for pixel.
- The image is built on chain by `RunnerRenderer.sol` from six `DataStore` contracts (59 layers each) and a seventh with weights, slot index and names. `src/runners.ts` produces the same SVG byte for byte; `contracts/test/RunnerRenderer.t.sol` enforces it against fixtures from `bun run contracts/fixtures.ts`. **TypeScript is the source of truth.**
- Traits in the metadata: one attribute per worn layer, typed by slot (Background, Race, Face, Mouth, Nose, Eyes, Ear Accessory, Face Accessory, Mask, Head Below, Eye Accessory, Head Above, Mouth Accessory).
- The site has no palette of its own; `--bg` is the background layer's top-left pixel and `--fg` the most used color far enough from it (`paletteOf` in `src/runners.ts`, site only). No light/dark toggle.
- Every tenth day up to 1000 goes to the author; the site's autoclaim loop claims those from the deployer wallet.
- Free, no price, no royalties. Not an investment.

## Legal position, stated once

The Chain Runners art and renderer are CC0 and MIT; both are copied lawfully. The name is used only to say where the layers come from, never as this project's brand. The site says so on `/assets`.

## Stack and commands

- Bun + TypeScript for the site (`src/`), Foundry for contracts (`contracts/`), OpenZeppelin 5.x via submodule. Never npm/npx, never Python for project code.
- `bun test` · `bun run contracts/fixtures.ts` (regenerates data blobs and day fixtures; run after any change to `src/runners.ts` or `src/layers.ts`) · `cd contracts && forge test` (needs `via_ir`).
- `PORT=3000 bun run src/server.ts`. With `CONTRACT_ADDRESS` + `CHAIN_ID` it reads chain state and shows the claim button.
- `contracts/deploy.sh sepolia|mainnet` deploys data stores + renderer + token, writes `~/.config/onenft-chainrun/deploy-<net>.json`. `contracts/wire.sh` writes the addresses into the hosting env and redeploys. `scripts/status.sh` prints state.
- Deploy of the site = `git push origin master` then trigger the hosting redeploy (see `CLAUDE.local.md`).

## Rules that bite

- **Do not change `src/runners.ts` output casually.** Past days are minted with the on-chain renderer. A change means a new renderer and `setRenderer` from the author wallet; it affects future days only.
- **Never edit `src/layers.ts` by hand.** It is a byte copy of the Ethereum renderer's layers and tables. If it must be regenerated, read it from chain again and diff.
- **Rendering gas matters.** `tokenURI` runs inside `OneNFT`'s constructor check and in every `eth_call`; Base Sepolia's RPC rejected a deploy when it cost 20M. Keep `svg()` well under 10M (`forge test --gas-report`).
- **All copy in English**, plain words, active voice, no adverbs, no em dashes. Same copy rules as onenft.click.
- **No AI-default design tells.** Same as onenft.click.
- Public repo: never commit keys or hosting tokens.
- The token contract is immutable; the renderer is the only swappable piece.

## Frontend Theme

Inherited from onenft.click, one change: the page colors are today's runner's colors (`paletteOf`). Pixel art renders with `image-rendering: pixelated`. Typography, shapes, density and motion unchanged.

## Where things are

| Thing | Path |
|---|---|
| Generator (source of truth) | `src/runners.ts` |
| The 338 layers and weight tables as data | `src/layers.ts` |
| Ethereum reference runners | `src/fixtures/ethereum-runners.json` |
| Clock, day math | `src/chain.ts` |
| Page HTML, CSS, copy | `src/site.ts` |
| Inner pages | `src/pages.ts` |
| JSON API, spec, calendar | `src/api.ts` |
| Server, routes | `src/server.ts` |
| Chain reads | `src/contract.ts` |
| Autoclaim | `src/autoclaim.ts` |
| PNG cards | `src/image.ts` |
| Contracts, tests, deploy | `contracts/` |
| Docs | `docs/` |
