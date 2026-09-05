// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RunnerRenderer} from "../src/RunnerRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract RunnerRendererTest is Test {
    using Strings for uint256;

    uint256 constant START = 20701;
    RunnerRenderer r;

    function deployRenderer() internal returns (RunnerRenderer) {
        string memory d = vm.readFile("test/fixtures/runner_data.json");
        address[6] memory s;
        for (uint256 i = 0; i < 6; i++) s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
        return new RunnerRenderer(START, s, DataStore.write(vm.parseJsonBytes(d, "$.meta")));
    }

    function setUp() public {
        r = deployRenderer();
    }

    function parseUint(string memory s) internal pure returns (uint256 n) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) n = n * 10 + (uint8(b[i]) - 48);
    }

    /// Fixtures from `bun run contracts/fixtures.ts`. TypeScript is the source of truth.
    function test_SvgAndTraitsMatchTypeScriptByteForByte() public view {
        string memory json = vm.readFile("test/fixtures/runner_days.json");
        uint256 count = 0;
        while (vm.keyExistsJson(json, string.concat("$[", count.toString(), "].day"))) count++;
        assertGt(count, 18);
        for (uint256 i = 0; i < count; i++) {
            string memory k = string.concat("$[", i.toString(), "]");
            uint256 epoch = parseUint(vm.parseJsonString(json, string.concat(k, ".epoch")));
            uint256 day = vm.parseJsonUint(json, string.concat(k, ".day"));
            assertEq(r.dayOf(epoch), day, "day");
            uint16[13] memory dna = r.dnaForDay(day);
            uint256[] memory want = vm.parseJsonUintArray(json, string.concat(k, ".dna"));
            for (uint256 j = 0; j < 13; j++) assertEq(uint256(dna[j]), want[j], "dna");
            assertEq(keccak256(bytes(r.svg(epoch))), keccak256(bytes(vm.parseJsonString(json, string.concat(k, ".svg")))), k);
            assertEq(r.paletteName(epoch), vm.parseJsonString(json, string.concat(k, ".palette")), "palette");
            (string[] memory types, string[] memory values) = r.traitsOf(epoch);
            uint256 n = 0;
            while (vm.keyExistsJson(json, string.concat(k, ".traits[", n.toString(), "].type"))) n++;
            assertEq(types.length, n, "trait count");
            for (uint256 j = 0; j < n; j++) {
                assertEq(types[j], vm.parseJsonString(json, string.concat(k, ".traits[", j.toString(), "].type")), "type");
                assertEq(values[j], vm.parseJsonString(json, string.concat(k, ".traits[", j.toString(), "].value")), "value");
            }
        }
    }

    function testFuzz_EveryDayRenders(uint32 day) public view {
        vm.assume(day > 0);
        (RunnerRenderer.Worn[] memory worn, uint256 count) = r.layersFor(r.dnaForDay(day));
        assertGt(count, 1); // at least background and race
        assertEq(worn[0].slot, 0);
        assertEq(worn[1].slot, 1);
        assertGt(bytes(r.svg(START + day - 1)).length, 300);
    }

    function test_TokenUriIsBase64Json() public view {
        string memory uri = r.tokenURI(1, START);
        assertGt(bytes(uri).length, 1000);
        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i = 0; i < prefix.length; i++) assertEq(bytes(uri)[i], prefix[i]);
    }

    function test_RejectsWrongDataSizes() public {
        address[6] memory s;
        for (uint256 i = 0; i < 6; i++) s[i] = DataStore.write(new bytes(100));
        vm.expectRevert();
        new RunnerRenderer(START, s, s[0]);
    }
}
