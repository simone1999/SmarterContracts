// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IAutomationRegistry
/// @notice Minimal interface for `IAutomatable` contracts to self-register
///         and for anyone to fund a registered contract's balance.
interface IAutomationRegistry {
    /// @notice Register the calling contract as an automatable task.
    /// @dev    `msg.sender` is recorded as the contract to automate.
    ///         Call this from the implementing contract's constructor (or a
    ///         dedicated setup function).  Native tokens sent along seed the
    ///         balance that will be used to pay solvers.
    /// @param  admin  Address that may cancel the registration and withdraw
    ///                surplus funds (e.g. the deployer / owner of the contract).
    function register(address admin) external payable;

    /// @notice Top up the native-token balance for a registered contract.
    ///         Anyone may fund any registered contract.
    /// @param  contractAddress  The registered contract to fund.
    function fund(address contractAddress) external payable;
}
