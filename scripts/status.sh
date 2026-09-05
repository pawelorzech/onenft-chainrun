#!/usr/bin/env bash
# One screen of state: chain, wallets, site. Read-only. Usage: scripts/status.sh [mainnet|sepolia]
set -euo pipefail
NET="${1:-mainnet}"
case "$NET" in
  mainnet) RPC=https://mainnet.base.org; SITE=https://chainrun.onenft.click;;
  sepolia) RPC=https://sepolia.base.org; SITE=https://chainrun-test.onenft.click;;
  *) echo "mainnet|sepolia"; exit 1;;
esac
D="$HOME/.config/onenft-chainrun/deploy-$NET.json"
NFT=$(jq -r .OneNFT "$D")
AUTHOR=$(jq -r .author "$D")
DEPLOYER=$(jq -r .deployer "$D")
day=$(cast call "$NFT" 'currentDay()(uint256)' --rpc-url "$RPC")
left=$(cast call "$NFT" 'secondsLeft()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
echo "network   $NET"
echo "contract  $NFT"
echo "day       $day   ($((left/3600)) h $(((left%3600)/60)) min left)"
echo "renderer  $(cast call "$NFT" 'renderer()(address)' --rpc-url "$RPC")   locked=$(cast call "$NFT" 'rendererLocked()(bool)' --rpc-url "$RPC")"
echo "owner     $(cast call "$NFT" 'owner()(address)' --rpc-url "$RPC")"
taken=0; gaps=""
for n in $(seq 1 "$day"); do
  if cast call "$NFT" 'ownerOf(uint256)(address)' "$n" --rpc-url "$RPC" >/dev/null 2>&1; then taken=$((taken+1)); else gaps="$gaps $n"; fi
done
echo "taken     $taken of $day   gaps:${gaps:- none}"
echo "deployer  $DEPLOYER  $(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether) ETH"
echo "author    $AUTHOR  $(cast balance "$AUTHOR" --rpc-url "$RPC" --ether) ETH"
echo "site      $(curl -s -m 8 "$SITE/health" | head -c 90)"
