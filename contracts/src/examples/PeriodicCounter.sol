// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAutomatable}        from "../interfaces/IAutomatable.sol";
import {IAutomationRegistry} from "../interfaces/IAutomationRegistry.sol";

/// @notice Minimal IAutomatable example. Increments a counter every `interval` seconds.
contract PeriodicCounter is IAutomatable {

    uint256 public immutable interval;
    address public immutable registry;

    uint256 public lastTimestamp;
    uint256 public counter;

    constructor(uint256 _interval, address _registry, address _owner) payable {
        interval      = _interval;
        registry      = _registry;
        lastTimestamp = block.timestamp;
        IAutomationRegistry(_registry).register{value: msg.value}(_owner);
    }

    function checkUpkeep() external view override returns (bool, bytes memory) {
        return (block.timestamp >= lastTimestamp + interval, "");
    }

    function performUpkeep(bytes calldata) external override returns (uint256) {
        require(msg.sender == registry, "only registry");
        require(block.timestamp >= lastTimestamp + interval, "too early");

        lastTimestamp = block.timestamp;
        counter += 1;

        return 0.0001 ether;
    }
}
