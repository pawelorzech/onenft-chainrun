# Deployments

Last verified: 2026-09-05

## Base Sepolia (84532), 2026-09-05, third deployment

| Contract | Address |
|---|---|
| OneNFT (`chainrun.onenft.click`, `RUNDAY`) | `0x4Bd8F79bE4862544cbA135b87a139Be0e3004a72` |
| RunnerRenderer | `0x58529c06a474d4A46Babcf5c6b8f0CDc6CDE73B6` |
| store0 (layers 0..58) | `0xF5584197FAbBd23C8858C379cC1eb61A7fa589fE` |
| store1 (layers 59..117) | `0x2D1b3D8686799973F677745651db69005B4AA0db` |
| store2 (layers 118..176) | `0xa5EC64050248350A1116485DF73755B12722A558` |
| store3 (layers 177..235) | `0x1c6b6a00bb949e50668c2b38aCF798043C0a5Cfa` |
| store4 (layers 236..294) | `0xF597D7bD4467A501a7634dD53Be63E1c7261bcdB` |
| store5 (layers 295..337) | `0xd54563F0556480a77A306014D9A960a296C440F3` |
| meta (weights, slot index, names) | `0x7f3E7C2350059891F7610eD41ae5Af51D3630B06` |

startEpoch 20701 (2026-09-05). Site: https://chainrun-test.onenft.click. Two earlier sets the same day are orphaned: the first (renderer `0x05545c0089A73eE5de1c16641489D2DbB42988c4`) never got a token because the 20M-gas `tokenURI` was rejected; the second (token `0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c`, renderer `0x9Db0AEE0e6EE9817A86f6c9CC8Cb85327f28462D`) holds a test claim of day 1. Nothing points at them.

## Base mainnet (8453)

Not yet deployed.

## Source

The layers and weight tables come from Ethereum mainnet, `ChainRunnersBaseRenderer` `0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc` (token `0x97597002980134beA46250Aa0510C9B90d87A587`), read 2026-09-05.
