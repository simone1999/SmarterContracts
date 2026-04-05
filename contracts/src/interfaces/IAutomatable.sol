// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IAutomatable
/// @notice Open standard interface for contracts that wish to be executed by
///         automated solvers via the AutomationRegistry.
///
/// Pattern
/// -------
///   1. Solvers simulate `checkUpkeep()` off-chain (view call, free).
///      This function may perform arbitrarily expensive computation that would
///      be prohibitive on-chain — e.g. iterating through all open positions on
///      a lending protocol, running a complex optimisation, or computing a
///      Merkle proof.  It returns an opaque `performData` blob encoding the
///      result (e.g. the address of the most liquidatable position).
///
///   2. If `upkeepNeeded` is true the solver calls
///      `AutomationRegistry.triggerUpkeep(contractAddress, performData, minPayment)`,
///      forwarding the blob verbatim.
///
///   3. The registry calls `performUpkeep(performData)` on the target contract.
///      `performData` is UNTRUSTED — any solver (or attacker) could supply
///      arbitrary bytes.  The implementation MUST verify or re-derive any
///      critical values before acting on them.
///
///   4. On success `performUpkeep` returns the `payment` amount the registry
///      will transfer to the solver from the contract's pre-funded balance.
///
/// Trust model for performData
/// ---------------------------
/// `performData` is a gas-saving hint, not a trusted input.  Examples:
///
///   Liquidation bot
///     checkUpkeep  – iterates all borrowers off-chain, picks the most
///                    under-collateralised one, returns its address.
///     performUpkeep – receives the address, re-checks the health factor
///                     on-chain (single SLOAD), reverts if it is healthy.
///
///   Complex calculation
///     checkUpkeep  – runs an expensive calculation off-chain, returns result.
///     performUpkeep – verifies the result with a cheap on-chain proof /
///                     sanity check, reverts if invalid.
///
/// Self-registration
/// -----------------
/// Implementing contracts are expected to register themselves with the
/// AutomationRegistry (typically in their constructor) by calling
/// `IAutomationRegistry.register(admin)`.
interface IAutomatable {
    /// @notice Off-chain readiness check.
    /// @dev    Simulated for free; NEVER called inside on-chain transactions.
    ///         Must be side-effect free (view).
    ///         May perform expensive iteration or computation that would be
    ///         unacceptably costly as an on-chain call.
    /// @return upkeepNeeded  True when `performUpkeep` should be triggered.
    /// @return performData   Opaque blob forwarded verbatim to `performUpkeep`.
    ///                       Encodes any hints the solver computed off-chain
    ///                       (e.g. target position id, calculated result, path).
    function checkUpkeep()
        external
        view
        returns (bool upkeepNeeded, bytes memory performData);

    /// @notice Execute the upkeep action.
    /// @dev    `performData` is UNTRUSTED — verify or re-derive critical values
    ///         before using them.  MUST revert if the triggering condition is
    ///         not met so that the solver's gas is the only cost of a failed
    ///         attempt (no balance is deducted on revert).
    ///         MUST be race-safe: if two solvers submit simultaneously only the
    ///         first should succeed; subsequent calls should revert.
    /// @param  performData  The blob returned by `checkUpkeep`, supplied by the
    ///                      solver.  Treat as untrusted input.
    /// @return payment      Amount of native tokens (wei) the registry should
    ///                      pay the calling solver from this contract's balance.
    function performUpkeep(bytes calldata performData)
        external
        returns (uint256 payment);
}
