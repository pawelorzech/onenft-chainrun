// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {RunnerRenderer} from "../src/RunnerRenderer.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DataStore} from "../src/DataStore.sol";
import {IDayRenderer} from "../src/IDayRenderer.sol";

contract StubRenderer is IDayRenderer {
    function svg(uint256) external pure returns (string memory) { return "stub"; }
    function paletteName(uint256) external pure returns (string memory) { return "stub"; }
    function tokenURI(uint256, uint256) external pure returns (string memory) { return "stub-uri"; }
}

contract BrokenRenderer is IDayRenderer {
    function svg(uint256) external pure returns (string memory) { return "looks fine"; }
    function paletteName(uint256) external pure returns (string memory) { return "x"; }
    function tokenURI(uint256, uint256) external pure returns (string memory) { revert("nope"); }
}

contract OneNFTTest is Test {
    uint256 constant START = 20701;
    uint256 constant EB = 86400;
    address author = makeAddr("author");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    using Strings for uint256;
    RunnerRenderer renderer;
    OneNFT nft;

    function setUp() public {
        vm.warp(START * EB - 100);
        string memory d = vm.readFile("test/fixtures/runner_data.json");
        address[6] memory s;
        for (uint256 i = 0; i < 6; i++) s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
        renderer = new RunnerRenderer(START, s, DataStore.write(vm.parseJsonBytes(d, "$.meta")));
        nft = new OneNFT("chainrun.onenft.click", "RUNDAY", START, author, address(renderer));
    }

    function test_ConstructorRejectsStartEpochInThePastOrTooFar() public {
        vm.warp(START * EB);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadStartEpoch.selector, START - 1, START));
        new OneNFT("x", "X", START - 1, author, address(renderer));
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadStartEpoch.selector, START + 8, START));
        new OneNFT("x", "X", START + 8, author, address(renderer));
        new OneNFT("x", "X", START + 7, author, address(renderer));
    }

    function test_RendererMustBeALiveContract() public {
        vm.prank(author);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadRenderer.selector, address(0xdead)));
        nft.setRenderer(address(0xdead));
        address broken = address(new BrokenRenderer());
        vm.prank(author);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadRenderer.selector, broken));
        nft.setRenderer(broken);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadRenderer.selector, address(0)));
        new OneNFT("x", "X", START, author, address(0));
    }

    function test_OwnershipCannotBeRenounced() public {
        vm.prank(author);
        vm.expectRevert(OneNFT.OwnershipIsPermanent.selector);
        nft.renounceOwnership();
    }

    function rollToDay(uint256 day, uint256 offset) internal {
        vm.warp((START + day - 1) * EB + offset);
    }

    function test_BeforeFirstDayNothingToClaim() public {
        vm.warp(START * EB - 1);
        assertEq(nft.currentDay(), 0);
        vm.prank(alice);
        vm.expectRevert(OneNFT.BeforeFirstDay.selector);
        nft.claim();
    }

    function test_ClaimMintsTokenNumberedByDay() public {
        rollToDay(1, 100);
        vm.prank(alice);
        uint256 day = nft.claim();
        assertEq(day, 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.rendererOf(1), address(renderer));
        assertEq(nft.epochOf(1), START);
    }

    function test_OnlyOneClaimPerDay() public {
        rollToDay(3, 5);
        vm.prank(alice);
        nft.claim();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.DayAlreadyClaimed.selector, 3));
        nft.claim();
    }

    function test_MissedDayStaysEmptyForever() public {
        rollToDay(2, 0);
        rollToDay(4, 0);
        vm.prank(alice);
        nft.claim();
        assertEq(nft.ownerOf(4), alice);
        assertFalse(nft.claimed(2));
        assertFalse(nft.claimed(3));
        vm.expectRevert();
        nft.ownerOf(3);
    }

    function test_EveryTenthDayGoesToAuthor() public {
        rollToDay(10, 1);
        vm.prank(alice);
        nft.claim();
        assertEq(nft.ownerOf(10), author);
        rollToDay(1000, 1);
        vm.prank(bob);
        nft.claim();
        assertEq(nft.ownerOf(1000), author);
        rollToDay(1010, 1);
        vm.prank(bob);
        nft.claim();
        assertEq(nft.ownerOf(1010), bob, "po dobie 1000 autor nic nie dostaje");
    }

    function test_RendererChangeTouchesOnlyFutureDays() public {
        rollToDay(1, 0);
        vm.prank(alice);
        nft.claim();
        StubRenderer stub = new StubRenderer();
        vm.prank(author);
        nft.setRenderer(address(stub));
        rollToDay(2, 0);
        vm.prank(bob);
        nft.claim();
        assertEq(nft.rendererOf(1), address(renderer));
        assertEq(nft.rendererOf(2), address(stub));
        assertEq(nft.tokenURI(2), "stub-uri");
        assertTrue(bytes(nft.tokenURI(1)).length > 5000, "doba 1 dalej z prawdziwego renderera");
    }

    function test_LockIsOneWay() public {
        address stub = address(new StubRenderer());
        vm.prank(author);
        nft.lockRenderer();
        assertTrue(nft.rendererLocked());
        vm.prank(author);
        vm.expectRevert(OneNFT.RendererIsLocked.selector);
        nft.setRenderer(stub);
    }

    function test_OnlyOwnerTouchesRenderer() public {
        address stub = address(new StubRenderer());
        vm.prank(alice);
        vm.expectRevert();
        nft.setRenderer(stub);
        vm.prank(alice);
        vm.expectRevert();
        nft.lockRenderer();
        assertEq(nft.renderer(), address(renderer));
        assertFalse(nft.rendererLocked());
    }

    function test_TokenUriOfUnclaimedReverts() public {
        rollToDay(5, 0);
        vm.expectRevert();
        nft.tokenURI(5);
        assertTrue(bytes(nft.preview(5)).length > 3000, "podglad dziala bez tokenu");
    }

    function test_SecondsLeftCountsDownToMidnight() public {
        rollToDay(1, 0);
        assertEq(nft.secondsLeft(), EB);
        rollToDay(1, EB - 1);
        assertEq(nft.secondsLeft(), 1);
    }
}
