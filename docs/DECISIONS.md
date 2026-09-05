# Decisions

Last verified: 2026-09-05

- **2026-09-05 One runner a day, not a port of the 10,000.** The Ethereum tokens exist; copying them adds nothing. Feeding the same machine from the clock makes new runners out of CC0 material and keeps the onenft.click rule: one token a day, gaps stay.
- **2026-09-05 The day number is the DNA.** Thirteen splitmix64 draws mod 10,000, the same mixer the sister projects use, portable to Solidity without keccak.
- **2026-09-05 Port the selection rules exactly, quirks included.** The original's `(A && B && C) || D` precedence hides "head above" on every even first draw. Matching it means a reference Ethereum token renders pixel for pixel from its DNA, which is the only proof the port is right. Six such tokens are in the test suite.
- **2026-09-05 Bottom-up compositing on chain.** The original composites top-down per pixel with byte-array reads; on Base Sepolia that cost 20M gas per `tokenURI` and the RPC refused the token deploy (the constructor calls `tokenURI` as a liveness check). A `uint256[1024]` buffer, one MLOAD per eight pixels and the same blend rule bring it down by an order of magnitude with identical output.
- **2026-09-05 Data in seven SSTORE2 contracts.** 140 kB of layers do not fit one contract; 59 layers per store stays under the code size limit. Weights, slot index and names share one more store, so the renderer's code holds no data at all.
- **2026-09-05 Run-length SVG.** The original emits 1,024 rects; merging horizontal runs cuts the file to a few kB and keeps it byte-identical between TypeScript and Solidity.
- **2026-09-05 Separate repository, same wallets, same author days.** As with blit.onenft.click.

## 2026-09-05 — Yours page, downloads drawn in the browser, the way back to the hub
Every collection site gets `/yours`: a Connect wallet button (`eth_requestAccounts`, no wallet library) and a field for an address or ENS name that posts to `/go`, which redirects to the holder page. The holder page shows one row per day: the image, the day number, when it was claimed, the traits, and a download bar. SVG is the file the contract holds. PNG and JPEG are drawn in the browser on a canvas at 1024, 2048 or 4096 pixels from that SVG, so the server gains no dependency and `/day/N.png` stays the 1200 by 630 share card. The top bar of every page is a breadcrumb, `onenft.click / chainrun.onenft.click`, so the hub is one click away. The hub gets `/wallet/<who>`, which reads `/api/holder/<who>` from every collection; that JSON and `/day/N.svg` with an open CORS header are the contract each collection keeps. Rejected: a gallery with one big image and a rail (fine for three tokens, tiring for thirty), and keeping the thumbnail grid with a side panel (two steps to a download).
