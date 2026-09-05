#!/usr/bin/env bash
# Point a site instance at a deployed contract. Usage: contracts/wire.sh sepolia|mainnet
# Reads ~/.config/onenft-chainrun/deploy-<net>.json and the app uuids from ~/.config/onenft-chainrun/coolify.json,, sets CONTRACT_ADDRESS/CHAIN_ID/START_EPOCH/BASE_RPC_URL in Coolify, redeploys.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) APP=$(jq -r .test "$HOME/.config/onenft-chainrun/coolify.json"); RPC=https://sepolia.base.org;;
  mainnet) APP=$(jq -r .prod "$HOME/.config/onenft-chainrun/coolify.json"); RPC=https://mainnet.base.org;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
D="$HOME/.config/onenft-chainrun/deploy-$NET.json"; [ -f "$D" ] || { echo "no $D"; exit 1; }
python3 - "$NET" "$APP" "$RPC" "$D" <<'EOF'
import sys, json, urllib.request, os
net, app, rpc, dpath = sys.argv[1:5]
d = json.load(open(dpath))
tok = json.load(open(os.path.expanduser("~/.config/coolify/credentials.json")))["api_token"]
H = {"Authorization": "Bearer " + tok, "content-type": "application/json"}
base = f"https://admin.orzech.me/api/v1/applications/{app}/envs"
existing = {e["key"]: e["uuid"] for e in json.load(urllib.request.urlopen(urllib.request.Request(base, headers=H)))}
want = {"CONTRACT_ADDRESS": d["OneNFT"], "CHAIN_ID": str(d["chainId"]), "START_EPOCH": str(d["startEpoch"]), "BASE_RPC_URL": rpc}
for k, v in want.items():
    body = json.dumps({"key": k, "value": v, "is_preview": False}).encode()
    if k in existing:
        urllib.request.urlopen(urllib.request.Request(base, data=body, headers=H, method="PATCH")).read()
    else:
        urllib.request.urlopen(urllib.request.Request(base, data=body, headers=H, method="POST")).read()
    print(f"{k}={v}")
r = json.load(urllib.request.urlopen(urllib.request.Request(f"https://admin.orzech.me/api/v1/deploy?uuid={app}", data=b"", headers=H, method="POST")))
print("redeploy queued:", r["deployments"][0]["deployment_uuid"])
EOF
