// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RunnerRenderer} from "../src/RunnerRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
/// env: START_EPOCH (unix days), AUTHOR (owner and every-tenth-day recipient)
/// Data blobs come from test/fixtures/runner_data.json (bun run contracts/fixtures.ts).
contract Deploy is Script {
    using Strings for uint256;

    function run() external {
        uint256 startEpoch = vm.envUint("START_EPOCH");
        address author = vm.envAddress("AUTHOR");
        string memory d = vm.readFile("test/fixtures/runner_data.json");
        vm.startBroadcast();
        address[6] memory s;
        for (uint256 i = 0; i < 6; i++) {
            s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
            console.log(string.concat("store", i.toString()), s[i]);
        }
        address m = DataStore.write(vm.parseJsonBytes(d, "$.meta"));
        RunnerRenderer renderer = new RunnerRenderer(startEpoch, s, m);
        OneNFT nft = new OneNFT("chainrun.onenft.click", "RUNDAY", startEpoch, author, address(renderer));
        vm.stopBroadcast();
        console.log("meta", m);
        console.log("RunnerRenderer", address(renderer));
        console.log("OneNFT", address(nft));
        console.log("startEpoch", startEpoch);
    }
}
