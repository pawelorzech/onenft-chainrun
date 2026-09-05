// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IDayRenderer} from "./IDayRenderer.sol";
import {DataStore} from "./DataStore.sol";

/// @title RunnerRenderer
/// @notice A one-to-one port of `src/runners.ts`, itself a port of the Chain
/// Runners renderer (Ethereum, CC0): the same DNA split, the same weight
/// tables and selection rules, the same alpha blend, the same SVG string. The
/// equality test compares keccak hashes against fixtures generated from
/// TypeScript. Changing anything here without the same change in TS is a bug.
///
/// The 338 layers (416 bytes each) sit in six data contracts, 59 per contract.
/// A seventh holds the weight tables, the slot index and the layer names.
contract RunnerRenderer is IDayRenderer {
    using Strings for uint256;

    uint256 public constant NUM_LAYERS = 13;
    uint256 public constant RECORD = 416;
    uint256 public constant PER_STORE = 59;
    uint256 public constant TOTAL_SLOTS = 346;
    uint256 public constant LAYER_COUNT = 338;

    uint256 public immutable startEpoch;
    address public immutable meta;
    address[6] internal stores;

    error BadData(string which, uint256 length);

    constructor(uint256 startEpoch_, address[6] memory stores_, address meta_) {
        uint256 left = LAYER_COUNT;
        for (uint256 i = 0; i < 6; i++) {
            uint256 want = left > PER_STORE ? PER_STORE : left;
            if (stores_[i].code.length != want * RECORD + 1) revert BadData("store", stores_[i].code.length);
            left -= want;
        }
        // weights 3 * 346 * 2, index 346 * 2, then at least one byte per name
        if (meta_.code.length < 3 * TOTAL_SLOTS * 2 + TOTAL_SLOTS * 2 + LAYER_COUNT + 1) revert BadData("meta", meta_.code.length);
        startEpoch = startEpoch_;
        stores = stores_;
        meta = meta_;
    }

    function store(uint256 i) external view returns (address) {
        return stores[i];
    }

    // ---- dna ----

    /// @dev splitmix64 finalizer, wrapping at 64 bits.
    function mix64(uint64 x) public pure returns (uint64 z) {
        unchecked {
            z = x + 0x9e3779b97f4a7c15;
            z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9;
            z = (z ^ (z >> 27)) * 0x94d049bb133111eb;
            z = z ^ (z >> 31);
        }
    }

    /// @notice Thirteen draws in 0..9999: seed = mix64(day), dna[i] = mix64(seed + i) mod 10000.
    function dnaForDay(uint256 day) public pure returns (uint16[NUM_LAYERS] memory dna) {
        uint64 seed = mix64(uint64(day));
        for (uint256 i = 0; i < NUM_LAYERS; i++) {
            unchecked {
                dna[i] = uint16(mix64(seed + uint64(i)) % 10000);
            }
        }
    }

    /// @dev Days before the start read as day 1, as in TypeScript.
    function dayOf(uint256 epoch) public view returns (uint256) {
        return epoch < startEpoch ? 1 : epoch - startEpoch + 1;
    }

    // ---- tables ----

    /// @dev Slot sizes 44,15,33,14,11,74,11,8,8,37,33,49,9; offsets are their running sum.
    function slotOffset(uint256 slot) public pure returns (uint256) {
        uint16[14] memory o = [0, 44, 59, 92, 106, 117, 191, 202, 210, 218, 255, 288, 337, 346];
        return o[slot];
    }

    function slotSize(uint256 slot) public pure returns (uint256) {
        return slotOffset(slot + 1) - slotOffset(slot);
    }

    function u16(bytes memory m, uint256 p) internal pure returns (uint256) {
        return (uint256(uint8(m[p])) << 8) | uint8(m[p + 1]);
    }

    function weight(bytes memory m, uint256 race, uint256 slot, uint256 k) internal pure returns (uint256) {
        return u16(m, (race * TOTAL_SLOTS + slotOffset(slot) + k) * 2);
    }

    /// @return g global layer number plus one, 0 when the slot item has no art
    function layerAt(bytes memory m, uint256 slot, uint256 item) internal pure returns (uint256 g) {
        if (item >= slotSize(slot)) return 0;
        return u16(m, (3 * TOTAL_SLOTS + slotOffset(slot) + item) * 2);
    }

    function layerName(bytes memory m, uint256 g) public pure returns (string memory) {
        uint256 p = 4 * TOTAL_SLOTS * 2;
        for (uint256 k = 0; k < g; k++) p += 1 + uint256(uint8(m[p]));
        uint256 len = uint8(m[p]);
        bytes memory out = new bytes(len);
        for (uint256 k = 0; k < len; k++) out[k] = m[p + 1 + k];
        return string(out);
    }

    function layerData(uint256 g) public view returns (bytes memory) {
        return DataStore.read(stores[g / PER_STORE], (g % PER_STORE) * RECORD, RECORD);
    }

    /// @notice 0 human or alien, 1 skull, 2 bot.
    function raceIndex(bytes memory m, uint256 d) internal pure returns (uint256) {
        uint256 lower = 0;
        for (uint256 i = 0; i < 15; i++) {
            uint256 w = weight(m, 0, 1, i);
            if (d >= lower && d < lower + w) return i == 1 ? 2 : i > 11 ? 1 : 0;
            lower += w;
        }
        revert("dna");
    }

    function layerIndex(bytes memory m, uint256 d, uint256 slot, uint256 race) internal pure returns (uint256) {
        uint256 lower = 0;
        uint256 n = slotSize(slot);
        for (uint256 i = 0; i < n; i++) {
            uint256 w = weight(m, race, slot, i);
            if (d >= lower && d < lower + w) return i;
            lower += w;
        }
        return n;
    }

    struct Worn {
        uint8 slot;
        uint16 g; // global layer number
        bytes data;
    }

    /// @notice The layers a DNA wears, bottom to top, with the original's rules and precedence.
    function layersFor(uint16[NUM_LAYERS] memory dna) public view returns (Worn[] memory worn, uint256 count) {
        bytes memory m = DataStore.read(meta);
        uint256 race = raceIndex(m, dna[1]);
        bool hasFaceAcc = dna[7] < 10000 - weight(m, race, 7, 7);
        bool hasMask = dna[8] < 10000 - weight(m, race, 8, 7);
        bool hasHeadBelow = dna[9] < 10000 - weight(m, race, 9, 36);
        bool hasHeadAbove = dna[11] < 10000 - weight(m, race, 11, 48);
        bool useHeadAbove = (dna[0] % 2) > 0;
        worn = new Worn[](NUM_LAYERS);
        for (uint256 i = 0; i < NUM_LAYERS; i++) {
            uint256 g = layerAt(m, i, layerIndex(m, dna[i], i, race));
            if (g == 0) continue;
            if (((i == 2 || i == 12) && !hasMask && !hasFaceAcc) || (i == 7 && !hasMask) || (i == 10 && !hasMask) || (i < 2 || (i > 2 && i < 7) || i == 8 || i == 9 || i == 11)) {
                if (hasHeadBelow && hasHeadAbove && (i == 9 && useHeadAbove) || (i == 11 && !useHeadAbove)) continue;
                worn[count++] = Worn(uint8(i), uint16(g - 1), layerData(g - 1));
            }
        }
    }

    // ---- pixels ----

    uint256 internal constant HAS = 1 << 24;
    bytes16 private constant HEX = "0123456789abcdef";

    /// @notice Composite the worn layers bottom to top into 1024 pixels, each
    /// `HAS | rgb` once any layer painted it. Same result as the original's
    /// top-down rule (a semi-transparent pixel blends once with the first
    /// non-transparent pixel below it): `raw` keeps the unblended color of the
    /// topmost non-transparent layer so far.
    ///
    /// A layer is 32 bytes of palette (8 x RGBA) then 384 bytes of pixels, three
    /// bits each, eight pixels per three bytes, high bits first. One MLOAD per
    /// eight pixels; the bytes past a 3-byte group are shifted away.
    function compose(Worn[] memory worn, uint256 count) public pure returns (uint256[1024] memory px) {
        uint256[1024] memory raw;
        uint256[8] memory pal;
        for (uint256 l = 0; l < count; l++) {
            bytes memory d = worn[l].data;
            // The inner loops in assembly: 10,000 pixel steps a day with bounds
            // checks cost 4M gas; without them, a fraction of that.
            assembly {
                let base := add(d, 32)
                for { let c := 0 } lt(c, 8) { c := add(c, 1) } {
                    mstore(add(pal, mul(c, 32)), shr(224, mload(add(base, mul(c, 4)))))
                }
                for { let g := 0 } lt(g, 128) { g := add(g, 1) } {
                    let bits := shr(232, mload(add(add(base, 32), mul(g, 3))))
                    for { let j := 0 } lt(j, 8) { j := add(j, 1) } {
                        let col := mload(add(pal, mul(and(shr(sub(21, mul(3, j)), bits), 7), 32)))
                        let a := and(col, 0xff)
                        if a {
                            let rgb := shr(8, col)
                            let off := mul(add(mul(g, 8), j), 32)
                            let cur := mload(add(px, off))
                            switch or(eq(a, 255), lt(cur, 0x1000000))
                            case 1 { mstore(add(px, off), or(0x1000000, rgb)) }
                            default {
                                let bg := mload(add(raw, off))
                                let alpha := add(a, 1)
                                let inv := sub(256, a)
                                let r := shr(8, add(mul(alpha, shr(16, rgb)), mul(inv, shr(16, bg))))
                                let gg := shr(8, add(mul(alpha, and(shr(8, rgb), 0xff)), mul(inv, and(shr(8, bg), 0xff))))
                                let bb := shr(8, add(mul(alpha, and(rgb, 0xff)), mul(inv, and(bg, 0xff))))
                                mstore(add(px, off), or(0x1000000, or(shl(16, r), or(shl(8, gg), bb))))
                            }
                            mstore(add(raw, off), rgb)
                        }
                    }
                }
            }
        }
    }

    // ---- a writer that never reallocates ----
    // Building the SVG with repeated abi.encodePacked leaves every intermediate
    // copy in memory; with a thousand rects that is over a megabyte and the
    // quadratic memory cost dominates. One 64 kB buffer and a cursor instead.

    function put(bytes memory buf, uint256 n, bytes memory s) internal pure returns (uint256) {
        assembly {
            let len := mload(s)
            let src := add(s, 32)
            let dst := add(add(buf, 32), n)
            for { let i := 0 } lt(i, len) { i := add(i, 32) } { mstore(add(dst, i), mload(add(src, i))) }
            n := add(n, len)
        }
        return n;
    }

    function putByte(bytes memory buf, uint256 n, bytes1 b) internal pure returns (uint256) {
        buf[n] = b;
        return n + 1;
    }

    /// @dev 0..32 as decimal.
    function putNum(bytes memory buf, uint256 n, uint256 v) internal pure returns (uint256) {
        if (v >= 10) n = putByte(buf, n, bytes1(uint8(48 + v / 10)));
        return putByte(buf, n, bytes1(uint8(48 + (v % 10))));
    }

    function putHex(bytes memory buf, uint256 n, uint256 rgb) internal pure returns (uint256) {
        n = putByte(buf, n, "#");
        for (uint256 k = 0; k < 3; k++) {
            uint256 v = (rgb >> (16 - 8 * k)) & 0xff;
            n = putByte(buf, n, HEX[v >> 4]);
            n = putByte(buf, n, HEX[v & 15]);
        }
        return n;
    }

    /// @notice One rect per horizontal run of one color.
    function svgOf(Worn[] memory worn, uint256 count) public pure returns (string memory) {
        uint256[1024] memory px = compose(worn, count);
        bytes memory buf = new bytes(65536);
        uint256 n = put(buf, 0, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges">');
        for (uint256 y = 0; y < 32; y++) {
            uint256 x = 0;
            while (x < 32) {
                uint256 p = y * 32 + x;
                uint256 w = 1;
                while (x + w < 32 && px[p + w] == px[p]) w++;
                n = put(buf, n, '<rect x="');
                n = putNum(buf, n, x);
                n = put(buf, n, '" y="');
                n = putNum(buf, n, y);
                n = put(buf, n, '" width="');
                n = putNum(buf, n, w);
                n = put(buf, n, '" height="1" fill="');
                n = putHex(buf, n, px[p] & 0xffffff);
                n = put(buf, n, '"/>');
                x += w;
            }
        }
        n = put(buf, n, "</svg>");
        assembly {
            mstore(buf, n)
        }
        return string(buf);
    }

    // ---- IDayRenderer ----

    function svg(uint256 epoch) public view returns (string memory) {
        (Worn[] memory worn, uint256 count) = layersFor(dnaForDay(dayOf(epoch)));
        return svgOf(worn, count);
    }

    /// @notice The background layer's name.
    function paletteName(uint256 epoch) external view returns (string memory) {
        (Worn[] memory worn,) = layersFor(dnaForDay(dayOf(epoch)));
        return layerName(DataStore.read(meta), worn[0].g);
    }

    function traitType(uint256 slot) public pure returns (string memory) {
        string[13] memory t = ["Background", "Race", "Face", "Mouth", "Nose", "Eyes", "Ear Accessory", "Face Accessory", "Mask", "Head Below", "Eye Accessory", "Head Above", "Mouth Accessory"];
        return t[slot];
    }

    /// @return types trait types worn, in slot order
    /// @return values layer names
    function traitsOf(uint256 epoch) public view returns (string[] memory types, string[] memory values) {
        (Worn[] memory worn, uint256 count) = layersFor(dnaForDay(dayOf(epoch)));
        bytes memory m = DataStore.read(meta);
        types = new string[](count);
        values = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            types[i] = traitType(worn[i].slot);
            values[i] = layerName(m, worn[i].g);
        }
    }

    function tokenURI(uint256 day, uint256 epoch) external view returns (string memory) {
        (string[] memory types, string[] memory values) = traitsOf(epoch);
        bytes memory attributes;
        for (uint256 i = 0; i < types.length; i++) {
            attributes = abi.encodePacked(attributes, i == 0 ? "" : ",", '{"trait_type":"', types[i], '","value":"', values[i], '"}');
        }
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg(epoch))));
        string memory json = string.concat(
            '{"name":"Day ', day.toString(),
            '","description":"One Chain Runner a day, drawn on chain from the day number with the CC0 Chain Runners layers. chainrun.onenft.click","image":"', image,
            '","attributes":[', string(attributes), "]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
