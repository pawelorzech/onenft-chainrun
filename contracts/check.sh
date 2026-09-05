#!/usr/bin/env bash
# Post-deploy check. Usage: contracts/check.sh sepolia|mainnet
# Compares every data store's code with the fixture blob byte for byte, and the
# renderer's svg() for a late day with the TypeScript output. Same-size blobs in
# the wrong order would pass the constructor's length checks; this catches it.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in sepolia) RPC=https://sepolia.base.org;; mainnet) RPC=https://mainnet.base.org;; *) exit 1;; esac
cd "$(dirname "$0")/.."
D="$HOME/.config/onenft-chainrun/deploy-$NET.json"; F=contracts/test/fixtures/runner_data.json; ok=1
for i in 0 1 2 3 4 5; do
  want="0x00$(jq -r ".stores[$i]" $F | cut -c3-)"; got=$(cast code "$(jq -r ".stores[$i]" "$D")" --rpc-url "$RPC")
  if [ "$want" = "$got" ]; then echo "store$i: on-chain bytes == fixture"; else echo "store$i: MISMATCH"; ok=0; fi
done
want="0x00$(jq -r ".meta" $F | cut -c3-)"; got=$(cast code "$(jq -r ".meta" "$D")" --rpc-url "$RPC")
if [ "$want" = "$got" ]; then echo "meta: on-chain bytes == fixture"; else echo "meta: MISMATCH"; ok=0; fi
START=$(jq -r .startEpoch "$D"); R=$(jq -r .RunnerRenderer "$D")
for day in 1 2089 10000; do
  cast call "$R" "svg(uint256)(string)" $((START + day - 1)) --rpc-url "$RPC" > /tmp/check-run.svg
  if bun -e 'import { renderDay } from "./src/runners.ts"; let s=(await Bun.file("/tmp/check-run.svg").text()).trim(); if(s.startsWith("\"")) s=JSON.parse(s); const d=Number(process.argv[1]); process.exit(s===renderDay(d, BigInt(process.argv[2])+BigInt(d-1)).svg?0:1)' "$day" "$START"; then echo "day $day: svg == TypeScript"; else echo "day $day: MISMATCH"; ok=0; fi
done
[ $ok = 1 ] && echo "all good" || { echo "PROBLEM"; exit 1; }
