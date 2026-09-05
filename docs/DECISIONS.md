# Decisions

Last verified: 2026-09-05

- **2026-09-05 One runner a day, not a port of the 10,000.** The Ethereum tokens exist; copying them adds nothing. Feeding the same machine from the clock makes new runners out of CC0 material and keeps the onenft.click rule: one token a day, gaps stay.
- **2026-09-05 The day number is the DNA.** Thirteen splitmix64 draws mod 10,000, the same mixer the sister projects use, portable to Solidity without keccak.
- **2026-09-05 Port the selection rules exactly, quirks included.** The original's `(A && B && C) || D` precedence hides "head above" on every even first draw. Matching it means a reference Ethereum token renders pixel for pixel from its DNA, which is the only proof the port is right. Six such tokens are in the test suite.
- **2026-09-05 Bottom-up compositing on chain.** The original composites top-down per pixel with byte-array reads; on Base Sepolia that cost 20M gas per `tokenURI` and the RPC refused the token deploy (the constructor calls `tokenURI` as a liveness check). A `uint256[1024]` buffer, one MLOAD per eight pixels and the same blend rule bring it down by an order of magnitude with identical output.
- **2026-09-05 Data in seven SSTORE2 contracts.** 140 kB of layers do not fit one contract; 59 layers per store stays under the code size limit. Weights, slot index and names share one more store, so the renderer's code holds no data at all.
- **2026-09-05 Run-length SVG.** The original emits 1,024 rects; merging horizontal runs cuts the file to a few kB and keeps it byte-identical between TypeScript and Solidity.
- **2026-09-05 Separate repository, same wallets, same author days.** As with blit.onenft.click.
