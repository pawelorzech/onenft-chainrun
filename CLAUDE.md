# chainrun.onenft.click

Last verified: 7dceeee | 2026-10-26

One Chain Runner a day, drawn on chain from the clock of the Base chain. Hub: `~/Programowanie/onenft/hub`; built from knot and blit on 2026-09-05. Shared rules (stack, deploy, copy, design, secrets, TS = source of truth): `../CLAUDE.md`. Operational identifiers: `CLAUDE.local.md` (gitignored).

## What this is

- Every UTC day the contract can mint exactly one ERC-721 token, `tokenId = day number`. A day nobody claims stays empty forever.
- Day n's DNA is thirteen splitmix64 draws seeded with n, each mod 10,000. Selection (three race tables, per-slot weight walk, mask and hat rules) and alpha blending are ported from `ChainRunnersBaseRenderer.sol` line by line, quirks included. `src/fixtures/ethereum-runners.json` holds six real Chain Runners; `src/runners.test.ts` renders them from DNA and matches pixel for pixel.
- Image built on chain by `RunnerRenderer.sol` from six `DataStore` contracts (59 layers each) and a seventh with weights, slot index and names. `src/runners.ts` produces the same SVG byte for byte; `contracts/test/RunnerRenderer.t.sol` enforces it.
- Metadata: one attribute per worn layer, typed by slot (Background, Race, Face, Mouth, Nose, Eyes, Ear Accessory, Face Accessory, Mask, Head Below, Eye Accessory, Head Above, Mouth Accessory).
- Site `--bg` is the background layer's top-left pixel, `--fg` the most used color far enough from it (`paletteOf` in `src/runners.ts`, site only).
- Every tenth day up to 1000 goes to the author; the site's autoclaim loop claims those from the deployer wallet.
- Free, no price, no royalties. Not an investment.

## Legal position, stated once

The Chain Runners art and renderer are CC0 and MIT; both are copied lawfully. The name only says where the layers come from, never this project's brand. The site says so on `/assets`.

## Commands and rules that bite

- `bun run contracts/fixtures.ts` regenerates data blobs and day fixtures; run after any change to `src/runners.ts` or `src/layers.ts`. `src/layers.ts` is a byte copy of the Ethereum renderer's layers and tables.
- Foundry tests need `via_ir`.
- **Rendering gas matters.** `tokenURI` runs inside `OneNFT`'s constructor check and in every `eth_call`; Base Sepolia's RPC rejected a deploy when it cost 20M. Keep `svg()` well under 10M (`forge test --gas-report`).

## Frontend Theme

Inherited from onenft.click, one change: the page colors are today's runner's colors (`paletteOf`). Pixel art renders with `image-rendering: pixelated`. Typography, shapes, density and motion unchanged.
