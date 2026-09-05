# chainrun.onenft.click

One Chain Runner a day, drawn on chain from the clock of the Base chain. Every day at midnight UTC the contract draws one runner from the day number with the 338 CC0 Chain Runners layers and the original's weight tables. Nobody picks the traits and nobody can delay it. A day nobody claims stays empty forever.

Live: **https://chainrun.onenft.click** · Contract: [`0x748b…Bb58` on Base](https://basescan.org/address/0x748b55c3762FE2a697DC268eD19743e22481Bb58) · One of the daily collections at [onenft.click](https://onenft.click)

## How it works

- **The layers** are the 338 pieces Chain Runners drew on Ethereum in 2021 and released as CC0: 13 slots (background, race, face, mouth, nose, eyes, seven kinds of accessory), each 32 by 32 pixels in eight RGBA colors, 416 bytes. They sit byte for byte in six data contracts on Base (`DataStore.sol`, the SSTORE2 pattern), read from the Ethereum renderer `0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc`, with its weight tables and layer names in a seventh.
- **A day** is `block.timestamp / 86400`, rounded down: one calendar day in UTC.
- **The DNA** is thirteen draws of splitmix64 seeded with the day, each mod 10,000. The original picked DNA off chain; here the clock does.
- **The selection** is the original's, line by line: the race draw picks one of three weight tables (human and alien, skull, bot), each slot's draw walks its table, and the rules that hide a face under a mask or a hat above the hair apply unchanged, quirks included.
- **The image** composites the worn layers with the original's alpha blend and comes out as one SVG, one rect per horizontal run of one color, returned by the contract as a `data:` URI. No server in the loop.
- **The site has no palette of its own.** It takes today's runner's colors, so it looks different every day.
- **Every tenth day up to 1000** goes to the author. Everything else is free to claim, gas only.
- **Everything is CC0**: runners, contracts, site. This project is not affiliated with Chain Runners.

The TypeScript generator (`src/runners.ts`) and the Solidity renderer (`contracts/src/RunnerRenderer.sol`) produce the same bytes; a Foundry test enforces it against fixtures generated from TypeScript. A second test renders six Ethereum Chain Runners from their DNA and matches the original pixel for pixel. The draw is written out on [`/how`](https://chainrun.onenft.click/how); layers, names and weight tables are in [`/spec.json`](https://chainrun.onenft.click/spec.json).

## Repository

| Path | What |
|---|---|
| `src/` | The site (Bun + TypeScript): generator (`runners.ts`), the layers and weights as data (`layers.ts`), clock, pages, API, server, chain reads, autoclaim, PNG cards, ENS. `src/fixtures/` holds the six Ethereum reference runners. |
| `contracts/` | Foundry project: `OneNFT.sol` (the same token contract as onenft.click), `RunnerRenderer.sol`, `DataStore.sol`, tests, deploy script. |
| `assets/fonts/` | Static TTFs for PNG cards (Syne ExtraBold, Newsreader; OFL). |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Deployments](docs/DEPLOYMENTS.md) · [Operations](docs/OPERATIONS.md) |
| `CLAUDE.md` | Working notes for an AI session continuing this project. |

## Run

```sh
bun install
bun test                          # site and generator tests, includes the Ethereum pixel check
bun run contracts/fixtures.ts     # data blobs and day fixtures from TypeScript
cd contracts && forge test        # contract tests, includes TS↔Solidity byte equality
PORT=3000 bun run src/server.ts
```

Environment: `PORT`; `CONTRACT_ADDRESS` and `CHAIN_ID` (8453 mainnet, 84532 Sepolia) to read chain state and enable claiming; `BASE_RPC_URL`; `START_EPOCH` (overridden by the contract); `DEPLOYER_KEY` for the author-day autoclaim; `ETH_RPC_URL` for ENS; `UMAMI_URL` and `UMAMI_WEBSITE_ID` for analytics. Without a contract the site is a plain renderer.

## Deploy

`contracts/deploy.sh sepolia|mainnet` deploys the seven data stores, the renderer and the token, then `contracts/wire.sh sepolia|mainnet` points the site at them. Details in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## License

Code: MIT. Fonts: SIL Open Font License. The layers are CC0 by Chain Runners; the daily runners are CC0 too.
