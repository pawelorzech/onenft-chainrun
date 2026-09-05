// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDayRenderer} from "./IDayRenderer.sol";

/// @title OneNFT, one knot a day
/// @notice The chain is the clock: a day is `block.timestamp / 86400`, one calendar
/// day in UTC. Each day exactly one token can be claimed, numbered by the day.
/// A day nobody claims stays empty forever; there are no second chances.
///
/// Every tenth day up to and including 1000 belongs to the author: `claim()` on
/// such a day mints to the author, not to the caller. Stated from day one.
///
/// The renderer is a separate contract. Its address is stored per token at claim
/// time, so `setRenderer` touches future days only; a claimed knot never changes.
/// `lockRenderer` closes even that door, one way.
contract OneNFT is ERC721, Ownable {
    uint256 public constant EPOCH_SECONDS = 86400;
    uint256 public constant AUTHOR_UNTIL_DAY = 1000;

    uint256 public immutable startEpoch;
    address public immutable author;

    address public renderer;
    bool public rendererLocked;
    mapping(uint256 tokenId => address) public rendererOf;

    event Claimed(uint256 indexed day, address indexed to, uint256 epoch, address renderer);
    event RendererSet(address indexed renderer);
    event RendererLocked();

    error BeforeFirstDay();
    error DayAlreadyClaimed(uint256 day);
    error RendererIsLocked();
    error BadRenderer(address renderer);
    error BadStartEpoch(uint256 startEpoch, uint256 currentEpoch);
    error OwnershipIsPermanent();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 startEpoch_,
        address author_,
        address renderer_
    ) ERC721(name_, symbol_) Ownable(author_) {
        // Day 1 must be the current epoch or one of the next seven. A late deploy
        // would otherwise skip days silently, and startEpoch is immutable.
        uint256 now_ = block.timestamp / EPOCH_SECONDS;
        if (startEpoch_ < now_ || startEpoch_ > now_ + 7) revert BadStartEpoch(startEpoch_, now_);
        _checkRenderer(renderer_, startEpoch_);
        startEpoch = startEpoch_;
        author = author_;
        renderer = renderer_;
        emit RendererSet(renderer_);
    }

    /// @dev A renderer address is pinned per token forever, so it must be a live
    /// contract that answers tokenURI() before we let anyone claim against it.
    /// 96 bytes is the ABI floor for a non-empty string return.
    function _checkRenderer(address renderer_, uint256 epoch) internal view {
        if (renderer_.code.length == 0) revert BadRenderer(renderer_);
        (bool ok, bytes memory out) = renderer_.staticcall(abi.encodeCall(IDayRenderer.tokenURI, (1, epoch)));
        if (!ok || out.length < 96) revert BadRenderer(renderer_);
    }

    // ---- clock ----

    function currentEpoch() public view returns (uint256) {
        return block.timestamp / EPOCH_SECONDS;
    }

    /// @return 0 before day one, then 1, 2, 3, ...
    function currentDay() public view returns (uint256) {
        uint256 e = currentEpoch();
        return e < startEpoch ? 0 : e - startEpoch + 1;
    }

    function epochOf(uint256 day) public view returns (uint256) {
        return startEpoch + day - 1;
    }

    /// @return Seconds until midnight UTC, the end of the current day.
    function secondsLeft() public view returns (uint256) {
        return (currentEpoch() + 1) * EPOCH_SECONDS - block.timestamp;
    }

    function isAuthorDay(uint256 day) public pure returns (bool) {
        return day % 10 == 0 && day <= AUTHOR_UNTIL_DAY;
    }

    // ---- claiming ----

    function claimed(uint256 day) public view returns (bool) {
        return _ownerOf(day) != address(0);
    }

    /// @notice Takes today's day. Free; you pay gas only.
    /// @dev On an author day (day % 10 == 0, day <= 1000) the token goes to `author`
    /// no matter who calls. The caller pays gas and gets nothing; the site hides the
    /// button on those days. This keeps author days claimable by anyone, so they are
    /// never lost because the author was away.
    function claim() external returns (uint256 day) {
        day = currentDay();
        if (day == 0) revert BeforeFirstDay();
        if (claimed(day)) revert DayAlreadyClaimed(day);
        address to = isAuthorDay(day) ? author : msg.sender;
        rendererOf[day] = renderer;
        // _mint, not _safeMint: the receiver calls claim() themselves, and after
        // EIP-7702 a normal wallet can be an account with delegation code that
        // does not answer onERC721Received.
        _mint(to, day);
        emit Claimed(day, to, epochOf(day), renderer);
    }

    // ---- renderer ----

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        _checkRenderer(renderer_, currentEpoch());
        renderer = renderer_;
        emit RendererSet(renderer_);
    }

    /// @dev Giving up ownership would freeze the renderer while `rendererLocked`
    /// still reads false. `lockRenderer` is the one sanctioned way to freeze.
    function renounceOwnership() public pure override {
        revert OwnershipIsPermanent();
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLocked();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return IDayRenderer(rendererOf[tokenId]).tokenURI(tokenId, epochOf(tokenId));
    }

    /// @notice Preview of any day's knot, claimed or not, with the current renderer.
    function preview(uint256 day) external view returns (string memory) {
        return IDayRenderer(renderer).svg(epochOf(day));
    }
}
