// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAutomatable}        from "./interfaces/IAutomatable.sol";
import {IAutomationRegistry} from "./interfaces/IAutomationRegistry.sol";

/// @title  AutomationRegistry
/// @notice Permissionless registry and payment hub for on-chain automation.
///
/// Overview
/// --------
/// Contracts that implement `IAutomatable` self-register by calling
/// `register(admin)` from within their own code (e.g. constructor).  A
/// native-token balance is stored per registered contract; anyone can top it
/// up at any time via `fund(address)`.
///
/// Triggering
/// ----------
/// Any solver (EOA or contract) calls `triggerUpkeep(contractAddress, minPayment)`.
/// The registry forwards the call to `IAutomatable.performUpkeep()` on the
/// target contract.  The target is solely responsible for:
///   a) verifying that the triggering condition is actually met (reverts if not), and
///   b) returning the `payment` amount it authorises the registry to pay out.
///
/// `checkUpkeep()` is intentionally NOT called inside this transaction — it
/// is an off-chain simulation tool only.
///
/// Payment
/// -------
///   payment = value returned by IAutomatable.performUpkeep()
///
/// The payment is deducted from the registered contract's balance and
/// transferred to the solver.  `minPayment` lets the solver protect against
/// a contract returning a lower amount than expected (slippage guard).
///
/// Reentrancy
/// ----------
/// A mutex guard is combined with the checks-effects-interactions pattern:
/// the balance is debited before the external `performUpkeep` call.
contract AutomationRegistry is IAutomationRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Registration {
        bool    active;
        address admin;    // may cancel and withdraw
        uint256 balance;  // native-token balance funding solver payments
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(address => Registration) private _registrations;

    /// @dev Append-only enumeration list. Cancelled entries stay in the array;
    ///      consumers must filter by `Registration.active`.
    address[] private _registeredContracts;

    bool private _locked;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ContractRegistered(
        address indexed contractAddress,
        address indexed admin,
        uint256         initialBalance
    );

    event BalanceFunded(
        address indexed contractAddress,
        address indexed funder,
        uint256         amount,
        uint256         newBalance
    );

    event BalanceWithdrawn(
        address indexed contractAddress,
        address indexed admin,
        uint256         amount,
        uint256         newBalance
    );

    event UpkeepTriggered(
        address indexed contractAddress,
        address indexed solver,
        uint256         payment
    );

    event RegistrationCancelled(
        address indexed contractAddress,
        address indexed admin,
        uint256         refund
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegistered(address contractAddress);
    error AlreadyRegistered(address contractAddress);
    error NotAdmin(address caller, address admin);
    error InsufficientBalance(uint256 available, uint256 required);
    error PaymentBelowMinimum(uint256 payment, uint256 minPayment);
    error TransferFailed(address recipient, uint256 amount);
    error Reentrancy();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyActive(address contractAddress) {
        if (!_registrations[contractAddress].active) {
            revert NotRegistered(contractAddress);
        }
        _;
    }

    modifier onlyAdmin(address contractAddress) {
        address admin = _registrations[contractAddress].admin;
        if (msg.sender != admin) revert NotAdmin(msg.sender, admin);
        _;
    }

    // -------------------------------------------------------------------------
    // Self-registration (called BY the automatable contract)
    // -------------------------------------------------------------------------

    /// @inheritdoc IAutomationRegistry
    /// @dev `msg.sender` is treated as the contract being registered.
    ///      Intended to be called from the automatable contract's constructor
    ///      or a dedicated setup function, forwarding ETH to seed the balance.
    function register(address admin) external payable override {
        address contractAddress = msg.sender;
        if (_registrations[contractAddress].active) {
            revert AlreadyRegistered(contractAddress);
        }

        _registrations[contractAddress] = Registration({
            active:  true,
            admin:   admin,
            balance: msg.value
        });
        _registeredContracts.push(contractAddress);

        emit ContractRegistered(contractAddress, admin, msg.value);
    }

    // -------------------------------------------------------------------------
    // Funding
    // -------------------------------------------------------------------------

    /// @inheritdoc IAutomationRegistry
    function fund(address contractAddress)
        external
        payable
        override
        onlyActive(contractAddress)
    {
        _registrations[contractAddress].balance += msg.value;
        emit BalanceFunded(
            contractAddress,
            msg.sender,
            msg.value,
            _registrations[contractAddress].balance
        );
    }

    /// @notice Withdraw surplus funds from a registration.
    ///         Only the admin may withdraw.
    /// @param contractAddress  Registration to withdraw from.
    /// @param amount           Amount of native tokens to withdraw.
    function withdraw(address contractAddress, uint256 amount)
        external
        nonReentrant
        onlyActive(contractAddress)
        onlyAdmin(contractAddress)
    {
        Registration storage reg = _registrations[contractAddress];
        if (reg.balance < amount) {
            revert InsufficientBalance(reg.balance, amount);
        }

        reg.balance -= amount;

        _safeTransfer(msg.sender, amount);
        emit BalanceWithdrawn(contractAddress, msg.sender, amount, reg.balance);
    }

    // -------------------------------------------------------------------------
    // Core: trigger upkeep
    // -------------------------------------------------------------------------

    /// @notice Permissionless entry point for solvers.
    ///         Forwards `performData` (obtained from `checkUpkeep` off-chain) to
    ///         `IAutomatable.performUpkeep()` and pays the solver the amount the
    ///         upkeep function authorises.
    ///
    /// @dev    `checkUpkeep` is NOT called here — it is for off-chain simulation
    ///         only.  The target contract's `performUpkeep` is the authoritative
    ///         guard; it must revert if work is not yet needed or if `performData`
    ///         fails its internal verification.
    ///
    ///         `performData` is passed through opaquely.  It is UNTRUSTED from
    ///         the target contract's perspective — any caller may supply arbitrary
    ///         bytes.  The target is responsible for validating the data.
    ///
    ///         Flow:
    ///           1. Pre-flight: verify balance covers `minPayment`.
    ///           2. Call `performUpkeep(performData)` — reverts propagate
    ///              naturally; reentrancy is prevented by the mutex.
    ///           3. Validate returned `payment` against `minPayment` and
    ///              available balance; deduct and pay solver.
    ///
    /// @param contractAddress  The registered contract to trigger.
    /// @param performData      Blob returned by `checkUpkeep`, forwarded verbatim.
    ///                         The target contract must validate this data itself.
    /// @param minPayment       Minimum payment (wei) the solver is willing to
    ///                         accept.  Reverts if the contract returns less,
    ///                         protecting the solver from reward slippage.
    function triggerUpkeep(
        address        contractAddress,
        bytes calldata performData,
        uint256        minPayment
    )
        external
        nonReentrant
        onlyActive(contractAddress)
        returns (uint256 payment)
    {
        Registration storage reg = _registrations[contractAddress];

        // ── 1. Pre-flight balance check ───────────────────────────────────────
        if (reg.balance < minPayment) {
            revert InsufficientBalance(reg.balance, minPayment);
        }

        // ── 2. Execute — target MUST revert if conditions are not met ─────────
        payment = IAutomatable(contractAddress).performUpkeep(performData);

        // ── 3. Validate and deduct payment ────────────────────────────────────
        if (payment < minPayment) {
            revert PaymentBelowMinimum(payment, minPayment);
        }
        if (payment > reg.balance) {
            revert InsufficientBalance(reg.balance, payment);
        }

        reg.balance -= payment;

        _safeTransfer(msg.sender, payment);

        emit UpkeepTriggered(contractAddress, msg.sender, payment);
    }

    // -------------------------------------------------------------------------
    // Cancellation
    // -------------------------------------------------------------------------

    /// @notice Cancel a registration and refund the remaining balance.
    ///         Only the admin may cancel.
    /// @param contractAddress  Registration to cancel.
    function cancelRegistration(address contractAddress)
        external
        nonReentrant
        onlyActive(contractAddress)
        onlyAdmin(contractAddress)
    {
        Registration storage reg = _registrations[contractAddress];
        uint256 refund = reg.balance;

        reg.active  = false;
        reg.balance = 0;

        if (refund > 0) {
            _safeTransfer(msg.sender, refund);
        }

        emit RegistrationCancelled(contractAddress, msg.sender, refund);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Return the full registration details for a contract.
    function getRegistration(address contractAddress)
        external
        view
        returns (Registration memory)
    {
        return _registrations[contractAddress];
    }

    /// @notice Number of ever-registered contracts (including cancelled ones).
    function getRegisteredContractCount() external view returns (uint256) {
        return _registeredContracts.length;
    }

    /// @notice Return a single registered contract address by index.
    /// @dev    Iterate off-chain using `getRegisteredContractCount()` to avoid
    ///         returning a potentially unbounded array in one call.
    ///         Includes cancelled registrations; check `Registration.active`.
    function getRegisteredContract(uint256 index) external view returns (address) {
        return _registeredContracts[index];
    }

    /// @notice Off-chain helper: simulate `checkUpkeep` for a registered contract.
    ///         Do NOT call this on-chain inside automation transactions.
    /// @return upkeepNeeded  Whether `triggerUpkeep` is expected to succeed.
    /// @return performData   Blob to forward to `triggerUpkeep`.
    function checkUpkeep(address contractAddress)
        external
        view
        onlyActive(contractAddress)
        returns (bool upkeepNeeded, bytes memory performData)
    {
        return IAutomatable(contractAddress).checkUpkeep();
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _safeTransfer(address recipient, uint256 amount) internal {
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed(recipient, amount);
    }
}
