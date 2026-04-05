# EVM Automation

A permissionless, open-standard automation protocol for EVM chains — similar to Gelato Network and Chainlink Automation, but without a centralised operator network.

Any contract that implements the `IAutomatable` interface can be triggered by any solver on the network. Solvers compete to submit trigger transactions and earn a reward paid from the contract's pre-funded balance. No whitelisting, no operators, no off-chain coordination required.

---

## Overview

The system has three main parts working together:

- **Smart contracts** — the `AutomationRegistry` on-chain hub that coordinates registrations, upkeep triggers, and solver payments, plus the `IAutomatable` interface that any contract can implement to become automatable.
- **Solver** — an off-chain Python process that continuously monitors all registered contracts, simulates `checkUpkeep` for free, and submits `triggerUpkeep` transactions for any that are ready, earning the reward.
- **UI** — a Next.js web app that lets anyone browse all registered contracts, inspect their upkeep history, fund balances, and manually trigger upkeep from the browser — no CLI needed.

---

## How it works

```
                ┌─────────────────────────────────┐
                │        AutomationRegistry        │
                │                                 │
  register() ──►│  balance per contract            │◄── fund()
                │                                 │
   solver ─────►│  triggerUpkeep(addr, data, min) │
                │        │                        │
                │        ▼                        │
                │  performUpkeep(data) ───────────►│ automatable contract
                │        │                        │   verifies conditions
                │        │◄── payment ────────────│   executes action
                │        │                        │   returns reward amount
                │        ▼                        │
                │  pay solver ◄── balance          │
                └─────────────────────────────────┘
```

**Step 1 — Off-chain check (free)**
Solvers call `checkUpkeep()` as a view simulation. This can do arbitrarily expensive computation — iterating thousands of positions, running complex calculations — without paying gas. It returns an opaque `performData` blob encoding the result (e.g. the address of the best liquidation target).

**Step 2 — On-chain trigger (paid)**
If upkeep is needed, the solver calls `AutomationRegistry.triggerUpkeep(address, performData, minPayment)`. The registry forwards `performData` to the target contract's `performUpkeep` function.

**Step 3 — Execution & payment**
`performUpkeep` is the authoritative guard. It validates the conditions on-chain (it cannot trust `performData` since any caller may supply arbitrary bytes), executes the action, and returns the payment amount. The registry transfers that amount from the contract's balance to the solver.

If `performUpkeep` reverts for any reason, the solver's transaction fails and no balance is touched — only the solver pays for the failed gas.

---

## Repository layout

```
contracts/
├── interfaces/
│   ├── IAutomatable.sol          ← Open standard interface
│   └── IAutomationRegistry.sol   ← Self-registration interface
├── AutomationRegistry.sol        ← Registry and payment hub
└── examples/
    └── PeriodicCounter.sol       ← Reference implementation

scripts/
├── deployRegistry.ts             ← Deploy AutomationRegistry
└── deployPeriodicCounter.ts      ← Deploy & self-register PeriodicCounter

solver/
├── solver.py                     ← Off-chain solver (Python)
├── requirements.txt
└── Dockerfile

ui/
├── src/
│   ├── app/                      ← Next.js app router pages
│   ├── components/               ← UI components (ContractCard, AdminPanel, FundPanel, …)
│   ├── hooks/                    ← wagmi/viem data hooks
│   └── lib/                      ← ABI, chain config, wagmi setup
└── .env.local                    ← Chain & registry configuration
```

---

## The `IAutomatable` interface

Implement these two functions to make any contract automatable:

```solidity
interface IAutomatable {
    /// @notice Off-chain readiness check — never called on-chain.
    /// @return upkeepNeeded  True when performUpkeep should be triggered.
    /// @return performData   Hint blob forwarded to performUpkeep.
    function checkUpkeep()
        external view
        returns (bool upkeepNeeded, bytes memory performData);

    /// @notice Execute the upkeep. MUST revert if conditions are not met.
    /// @param  performData  Untrusted hint from checkUpkeep — validate before use.
    /// @return payment      Wei amount the registry should pay the solver.
    function performUpkeep(bytes calldata performData)
        external
        returns (uint256 payment);
}
```

### Trust model for `performData`

`performData` is a gas-saving hint, not a trusted input. The contract must always re-verify critical values on-chain:

| Use case | `checkUpkeep` | `performUpkeep` |
|---|---|---|
| Liquidation bot | Iterate all borrowers off-chain, return the best target address | Re-check the health factor for that address; revert if healthy |
| Complex calculation | Run expensive calculation off-chain, return the result | Verify result with a cheap on-chain proof; revert if invalid |
| Time-based task | Check `block.timestamp >= lastRun + interval` | Re-check on-chain; revert if early |

### Self-registration

Automatable contracts register themselves — typically in their constructor — by calling the registry directly:

```solidity
constructor(address registry, address admin) payable {
    IAutomationRegistry(registry).register{value: msg.value}(admin);
}
```

`msg.sender` is recorded as the contract address. The `admin` address may later withdraw surplus funds or cancel the registration.

---

## AutomationRegistry reference

| Function | Who | Description |
|---|---|---|
| `register(admin)` payable | Automatable contract | Self-register; seeds solver-reward balance |
| `fund(address)` payable | Anyone | Top up a contract's reward balance |
| `triggerUpkeep(address, bytes, uint256)` | Any solver | Execute upkeep; pays solver on success |
| `withdraw(address, uint256)` | Admin only | Withdraw surplus balance |
| `cancelRegistration(address)` | Admin only | Deactivate and refund full balance |
| `checkUpkeep(address)` view | Off-chain | Simulate readiness; do not call on-chain |
| `getRegistration(address)` view | Anyone | Full registration struct |
| `getRegisteredContractCount()` view | Anyone | Number of ever-registered contracts |
| `getRegisteredContract(uint256)` view | Anyone | Address at a given index |

---

## Contracts — setup & deployment

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- An EVM-compatible RPC endpoint and a funded deployer wallet

### Install

```bash
npm install
```

### Compile

```bash
npm run compile
```

This also generates TypeScript typings under `typechain-types/`.

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
PRIVATE_KEY=your_deployer_private_key_without_0x

RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111

# For contract verification (optional)
EXPLORER_API_KEY=your_etherscan_key
EXPLORER_API_URL=https://api-sepolia.etherscan.io/api
EXPLORER_BROWSER_URL=https://sepolia.etherscan.io
```

### Deploy

```bash
# 1. Deploy the registry — note the printed address
npm run deploy:registry

# 2. Add to .env:
#    REGISTRY_ADDRESS=0x...

# 3. Deploy and self-register a PeriodicCounter
#    Optional: COUNTER_INTERVAL=3600  (seconds, default 1h)
#              COUNTER_FUNDING=0.01   (ETH initial balance, default 0.01)
npm run deploy:counter
```

Both scripts automatically verify the contracts on the block explorer when deployed to a non-local network.

**Local development** (separate terminal):

```bash
npm run node                    # start local Hardhat node
npm run deploy:registry:local
npm run deploy:counter:local
```

---

## Solver — setup & usage

The off-chain solver monitors all registered contracts, simulates `checkUpkeep` for each one, and submits `triggerUpkeep` for any that are ready.

### Python (direct)

```bash
cd solver
pip install -r requirements.txt

# Continuous monitoring loop
python solver.py run \
  --rpc_url=https://sepolia.infura.io/v3/YOUR_KEY \
  --registry=0xRegistryAddress \
  --private_key=0xYourKey

# One-shot status check (no transactions)
python solver.py check \
  --rpc_url=... --registry=... --private_key=...

# Manually trigger a specific contract
python solver.py trigger \
  --contract=0xTargetAddress \
  --rpc_url=... --registry=... --private_key=...
```

### Docker

```bash
docker build -t evm-solver ./solver

docker run --rm evm-solver run \
  --rpc_url=https://sepolia.infura.io/v3/YOUR_KEY \
  --registry=0xRegistryAddress \
  --private_key=0xYourKey
```

### Solver options

| Option | Default | Description |
|---|---|---|
| `--rpc_url` | — | JSON-RPC endpoint **(required)** |
| `--registry` | — | AutomationRegistry address **(required)** |
| `--private_key` | — | Solver wallet private key **(required)** |
| `--min_payment_eth` | `0.0001` | Minimum reward in ETH to accept per trigger |
| `--poll_interval` | `5` | Seconds between full scans |
| `--gas_limit` | `500000` | Gas limit for trigger transactions |
| `--gas_multiplier` | `1.2` | Multiplier applied to base fee and priority fee |
| `--poa` | `false` | Enable POA middleware (Polygon, BSC, …) |
| `--log_level` | `INFO` | `DEBUG` / `INFO` / `WARNING` |

---

## UI — setup & usage

The web UI lets anyone explore the registry, monitor contracts, fund balances, and trigger upkeep from the browser using their connected wallet.

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- A WalletConnect project ID (from [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Install & configure

```bash
cd ui
npm install
cp .env.local.example .env.local   # or create .env.local manually
```

Edit `ui/.env.local`:

```env
NEXT_PUBLIC_REGISTRY_ADDRESS=0xYourRegistryAddress
NEXT_PUBLIC_RPC_URL=https://your-rpc-endpoint
NEXT_PUBLIC_CHAIN_ID=your_chain_id
NEXT_PUBLIC_EXPLORER_URL=https://your-block-explorer
```

### Run

```bash
# Development server
npm run dev

# Production build
npm run build
npm start
```

The app runs on [http://localhost:3000](http://localhost:3000) by default.

### What the UI provides

- **Registry dashboard** — lists all registered contracts with their current balance and upkeep status.
- **Contract detail page** — per-contract view with upkeep history, balance, and admin controls.
- **Fund panel** — top up any contract's solver-reward balance directly from the browser.
- **Admin panel** — withdraw surplus funds or cancel a registration (admin wallet required).
- **Trigger button** — manually call `triggerUpkeep` from the browser for testing or one-off execution.

---

## Building an automatable contract

Use `PeriodicCounter` (`contracts/examples/PeriodicCounter.sol`) as a starting point. The key points:

1. **Import the interfaces** and implement `IAutomatable`.
2. **Self-register** in the constructor by calling `IAutomationRegistry(registry).register{value: msg.value}(admin)`.
3. **`checkUpkeep`** — do all expensive off-chain work here. Return `(false, "")` if not ready, or `(true, performData)` with any hint data the execution needs.
4. **`performUpkeep`** — re-verify all conditions on-chain. Treat `performData` as untrusted. Revert if conditions are not met. Return the payment amount in wei.
5. **Fund the balance** — keep the registry balance topped up so solvers are compensated. Anyone can call `registry.fund{value: ...}(address(this))`.

```solidity
contract MyJob is IAutomatable {
    uint256 public constant SOLVER_PAYMENT = 0.0001 ether;
    address public immutable registry;

    constructor(address _registry, address _admin) payable {
        registry = _registry;
        IAutomationRegistry(_registry).register{value: msg.value}(_admin);
    }

    function checkUpkeep() external view override
        returns (bool, bytes memory)
    {
        bool ready = /* your condition */;
        return (ready, abi.encode(/* hint data */));
    }

    function performUpkeep(bytes calldata performData) external override
        returns (uint256)
    {
        require(msg.sender == registry, "only registry");
        // decode and RE-VERIFY hint — it is untrusted
        // execute action
        return SOLVER_PAYMENT;
    }
}
```

---

## License

MIT
