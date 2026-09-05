// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title DataStore
/// @notice Bytes stored as the code of a contract (the SSTORE2 pattern): written
/// once at deploy time, read with EXTCODECOPY, immutable by construction. A
/// leading STOP byte keeps the data from ever running as code.
library DataStore {
    error TooLarge(uint256 length);
    error DeployFailed();

    /// @dev Init code: PUSH2 size, DUP1, PUSH1 10, RETURNDATASIZE, CODECOPY, RETURNDATASIZE, RETURN, then the code.
    function write(bytes memory data) internal returns (address store) {
        if (data.length > 24575) revert TooLarge(data.length);
        bytes memory code = abi.encodePacked(hex"00", data);
        bytes memory init = abi.encodePacked(hex"61", uint16(code.length), hex"80600a3d393df3", code);
        assembly {
            store := create(0, add(init, 32), mload(init))
        }
        if (store == address(0)) revert DeployFailed();
    }

    function read(address store) internal view returns (bytes memory data) {
        uint256 size = store.code.length - 1;
        data = new bytes(size);
        assembly {
            extcodecopy(store, add(data, 32), 1, size)
        }
    }

    /// @notice `length` bytes starting at `offset` of the stored data.
    function read(address store, uint256 offset, uint256 length) internal view returns (bytes memory data) {
        data = new bytes(length);
        assembly {
            extcodecopy(store, add(data, 32), add(offset, 1), length)
        }
    }
}
