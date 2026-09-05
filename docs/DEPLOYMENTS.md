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

## Base mainnet (8453), 2026-09-05

| Contract | Address |
|---|---|
| OneNFT (`chainrun.onenft.click`, `RUNDAY`) | `0x748b55c3762FE2a697DC268eD19743e22481Bb58` |
| RunnerRenderer | `0xC48Fef4362eB1910a95224AC888FdcCF89E27060` |
| store0 (layers 0..58) | `0x043aD57a1DB88D0747Ace60809B84F5a4A59e26c` |
| store1 (layers 59..117) | `0x537cbC21D052edca6eC26D7d8858d1f009eEb384` |
| store2 (layers 118..176) | `0xC2698e860211FDd8DC79bAE16565c54cD6e8cb1D` |
| store3 (layers 177..235) | `0x227B6382d06ED561947396A21c6bCddeA7bE26bC` |
| store4 (layers 236..294) | `0xdA55846f1f073037e4325c16Cc08fD0Af960AB69` |
| store5 (layers 295..337) | `0xbf10e7cFa36DDcE808CeDF19B33093B023cdCe25` |
| meta (weights, slot index, names) | `0xeb687b3004B1041425758456aA54e5a503541515` |

startEpoch 20701 (2026-09-05). Owner and author `0x6e36Dc3ec2F9D4f3D8e616725fB6Fa184CD9aE20`, deployer `0x7f28c8c9171b13F1E2fea21b6f2c8d4f91F892F3`. Every store's code was compared byte for byte with `contracts/test/fixtures/runner_data.json` after deployment, and `svg(20701)` on chain equals the TypeScript output.

## Source

The layers and weight tables come from Ethereum mainnet, `ChainRunnersBaseRenderer` `0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc` (token `0x97597002980134beA46250Aa0510C9B90d87A587`), read 2026-09-05.
