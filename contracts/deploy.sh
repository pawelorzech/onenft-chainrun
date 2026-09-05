#!/usr/bin/env bash
# Deploys the seven data stores, RunnerRenderer and OneNFT. Usage: contracts/deploy.sh sepolia|mainnet
# Deployer secret from Keychain (onenft-deployer), author address from ~/.config/onenft/author.json.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
[ -f test/fixtures/runner_data.json ] || (cd .. && bun run contracts/fixtures.ts)
AUTHOR=$(jq -r .address "$HOME/.config/onenft/author.json")
PK=$(security find-generic-password -a onenft-deployer -s onenft-deployer -w)
DEPLOYER=$(cast wallet address --private-key "$PK")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR"
START_EPOCH="${START_EPOCH:-$(( $(date -u +%s) / 86400 ))}"
echo "START_EPOCH=$START_EPOCH"
LOG="/tmp/onenft-chainrun-deploy-$NET.log"
START_EPOCH=$START_EPOCH AUTHOR=$AUTHOR forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key "$PK" \
  --verify --verifier sourcify 2>&1 | tee "$LOG" | grep -E "store|meta|RunnerRenderer|OneNFT|startEpoch|verif|Error" || true
unset PK
get() { grep -E "^\s*$1 " "$LOG" | head -1 | awk '{print $2}'; }
STORES=$(for i in 0 1 2 3 4 5; do get "store$i"; done | jq -R . | jq -s -c .)
mkdir -p "$HOME/.config/onenft-chainrun"
jq -n --arg net "$NET" --argjson chain "$CHAIN" --arg nft "$(get OneNFT)" --arg ren "$(get RunnerRenderer)" --argjson stores "$STORES" --arg m "$(get meta)" \
  --argjson start "$START_EPOCH" --arg author "$AUTHOR" --arg deployer "$DEPLOYER" --arg at "$(date -u +%FT%TZ)" \
  '{network:$net,chainId:$chain,OneNFT:$nft,RunnerRenderer:$ren,stores:$stores,meta:$m,startEpoch:$start,author:$author,deployer:$deployer,at:$at}' > "$HOME/.config/onenft-chainrun/deploy-$NET.json"
cat "$HOME/.config/onenft-chainrun/deploy-$NET.json"
