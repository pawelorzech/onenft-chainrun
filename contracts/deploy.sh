#!/usr/bin/env bash
# Deploys the seven data stores, RunnerRenderer and OneNFT. Usage: contracts/deploy.sh sepolia|mainnet
# Deployer uses the encrypted onenft-deployer Foundry keystore, author address from ~/.config/onenft/author.json.
set -euo pipefail
source "$(dirname "$0")/../scripts/operator-safe.sh"
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
[ -f test/fixtures/runner_data.json ] || (cd .. && bun run contracts/fixtures.ts)
AUTHOR=$(operator_json_address "$HOME/.config/onenft/author.json" address)
operator_signer deployer
DEPLOYER=$(operator_address "$(cast wallet address "${SIGNER_ARGS[@]}")")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR"
START_EPOCH="${START_EPOCH:-$(( $(date -u +%s) / 86400 ))}"
[[ "$START_EPOCH" =~ ^[0-9]{1,12}$ ]] || { echo "Invalid START_EPOCH" >&2; exit 1; }
echo "START_EPOCH=$START_EPOCH"
LOG="$OPERATOR_TMP_DIR/onenft-chainrun-deploy-$NET.log"
START_EPOCH=$START_EPOCH AUTHOR=$AUTHOR forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast "${SIGNER_ARGS[@]}" \
  --verify --verifier sourcify 2>&1 | tee "$LOG"
get() { operator_log_address "$LOG" "$1"; }
STORES=$(for i in 0 1 2 3 4 5; do get "store$i" || exit 1; done | jq -R . | jq -s -c .)
NFT=$(get OneNFT); REN=$(get RunnerRenderer); META=$(get meta)
mkdir -p "$HOME/.config/onenft-chainrun"
jq -n --arg net "$NET" --argjson chain "$CHAIN" --arg nft "$NFT" --arg ren "$REN" --argjson stores "$STORES" --arg m "$META" \
  --argjson start "$START_EPOCH" --arg author "$AUTHOR" --arg deployer "$DEPLOYER" --arg at "$(date -u +%FT%TZ)" \
  '{network:$net,chainId:$chain,OneNFT:$nft,RunnerRenderer:$ren,stores:$stores,meta:$m,startEpoch:$start,author:$author,deployer:$deployer,at:$at}' | operator_write_json "$HOME/.config/onenft-chainrun/deploy-$NET.json"
cat "$HOME/.config/onenft-chainrun/deploy-$NET.json"
