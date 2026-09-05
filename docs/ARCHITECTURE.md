# Architecture

Last verified: 2026-09-05

The same shape as onenft.click and blit.onenft.click, with the generator replaced by a port of the Chain Runners renderer fed from the day number.

## Data path

1. `src/layers.ts` holds the 338 layers (416 bytes each as hex, with slot, item and name) and the three weight tables, read once from `ChainRunnersBaseRenderer` `0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc` on Ethereum on 2026-09-05 (`getLayer(slot, item)` for every slot of every table; the tables from the verified source).
2. `contracts/fixtures.ts` sorts the layers by (slot, item), packs them 59 per blob (`stores`, six blobs) and writes `meta`: WEIGHTS as uint16 for 3 races times 346 slots, then a uint16 slot index (global layer number plus one, 0 for no art), then one length-prefixed name per layer. It also writes `runner_days.json` with sample days rendered in TypeScript.
3. The deploy script writes each blob into a `DataStore` contract (SSTORE2) and passes the seven addresses to `RunnerRenderer`.
4. `OneNFT` (unchanged from onenft.click apart from the interface name) stores the renderer address per token at claim time and delegates `tokenURI` to it.

## Day to DNA to layers

`seed = mix64(day); dna[i] = mix64(seed + i) mod 10000` for the 13 slots. Race from `dna[1]` through `WEIGHTS[0][1]` (item 1 bot, items above 11 skull, else human or alien). For each slot, walk `WEIGHTS[race][slot]` with `dna[slot]`; a draw past the last item means no layer. Then the original's visibility rules with the original's operator precedence, see `layersFor` in both languages.

## Rendering

Per layer, 8 RGBA colors then 1024 pixels at 3 bits (eight pixels per three bytes, high bits first). Compositing: top layer down, skip alpha 0, take alpha 255 as is, else blend once with the first non-transparent pixel below: `((a + 1) * fg + (256 - a) * bg) >> 8` per channel. TypeScript does this top-down per pixel; Solidity does it bottom-up into a `uint256[1024]` buffer keeping the unblended color of the topmost layer so far, which gives the same result at a fraction of the gas (one MLOAD per eight pixels). `svgOf` emits one rect per horizontal run.

## Site

`src/server.ts` routes are those of onenft.click. `runnerFor(epoch)` is the only entry point pages use. Page colors: `paletteOf` takes the top-left pixel as `--bg` and the most used color with enough luma distance as `--fg`. Site only, not on chain.
