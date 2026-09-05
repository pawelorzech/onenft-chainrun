// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The day renderer. A separate contract so it can be improved for
/// future days without touching tokens already claimed.
interface IDayRenderer {
    function svg(uint256 epoch) external view returns (string memory);
    function paletteName(uint256 epoch) external view returns (string memory);
    function tokenURI(uint256 day, uint256 epoch) external view returns (string memory);
}
