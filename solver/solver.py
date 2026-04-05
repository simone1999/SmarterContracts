#!/usr/bin/env python3
"""
AutomationRegistry off-chain solver.

Monitors all contracts registered in an AutomationRegistry, simulates
checkUpkeep() for each active one, and submits triggerUpkeep() for any
that report work is ready.

Usage examples
--------------
  # Continuous monitoring loop (one scan per block):
  python solver.py run \\
      --rpc-url=https://mainnet.infura.io/v3/YOUR_KEY \\
      --registry=0xRegistryAddress \\
      --private-key=0xYourKey

  # One-shot status check (no transactions):
  python solver.py check \\
      --rpc-url=... --registry=... --private-key=...

  # Manually trigger a specific contract:
  python solver.py trigger --contract=0xTarget \\
      --rpc-url=... --registry=... --private-key=...
"""

import logging
import sys
import time
from typing import Optional

import fire
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ABIs (minimal surface — only the functions the solver needs)
# ---------------------------------------------------------------------------

REGISTRY_ABI = [
    {
        "name": "getRegisteredContractCount",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "getRegisteredContract",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "index", "type": "uint256"}],
        "outputs": [{"name": "", "type": "address"}],
    },
    {
        "name": "getRegistration",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "contractAddress", "type": "address"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "active",  "type": "bool"},
                    {"name": "admin",   "type": "address"},
                    {"name": "balance", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "checkUpkeep",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "contractAddress", "type": "address"}],
        "outputs": [
            {"name": "upkeepNeeded", "type": "bool"},
            {"name": "performData",  "type": "bytes"},
        ],
    },
    {
        "name": "triggerUpkeep",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "contractAddress", "type": "address"},
            {"name": "performData",     "type": "bytes"},
            {"name": "minPayment",      "type": "uint256"},
        ],
        "outputs": [{"name": "payment", "type": "uint256"}],
    },
]


# ---------------------------------------------------------------------------
# Solver
# ---------------------------------------------------------------------------

class Solver:
    """
    Off-chain solver for the AutomationRegistry.

    Discovers registered contracts, simulates their readiness off-chain via
    checkUpkeep(), and submits triggerUpkeep() transactions for those that
    are ready, earning the solver-reward from each contract's balance.
    """

    def __init__(
        self,
        rpc_url:         str,
        registry:        str,
        private_key:     str,
        min_payment_eth: float = 0.0001,
        poll_interval:   int   = 5,
        gas_limit:       int   = 500_000,
        gas_multiplier:  float = 1.2,
        poa:             bool  = False,
        log_level:       str   = "INFO",
    ):
        """
        Args:
            rpc_url:         JSON-RPC endpoint (HTTP or WS).
            registry:        Deployed AutomationRegistry address.
            private_key:     Solver wallet private key (0x-prefixed hex).
            min_payment_eth: Minimum reward in ETH the solver accepts per trigger.
                             Passed as minPayment to triggerUpkeep; skips contracts
                             whose balance is lower. Default: 0.0001.
            poll_interval:   Seconds between full scans. Default: 12 (≈1 block).
            gas_limit:       Gas limit for triggerUpkeep transactions. Default: 500_000.
            gas_multiplier:  Scale factor applied to the base fee. Default: 1.2.
            poa:             Inject POA middleware (Polygon, BSC, …). Default: False.
            log_level:       Logging verbosity (DEBUG/INFO/WARNING). Default: INFO.
        """
        logging.getLogger().setLevel(log_level.upper())

        self._w3 = Web3(Web3.HTTPProvider(rpc_url))
        if poa:
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self._w3.is_connected():
            log.error("Cannot connect to RPC: %s", rpc_url)
            sys.exit(1)

        self._account = self._w3.eth.account.from_key(private_key)
        self._registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(registry),
            abi=REGISTRY_ABI,
        )
        self._min_payment    = self._w3.to_wei(min_payment_eth, "ether")
        self._poll_interval  = poll_interval
        self._gas_limit      = gas_limit
        self._gas_multiplier = gas_multiplier

        log.info("Solver wallet  : %s", self._account.address)
        log.info("Registry       : %s", registry)
        log.info("Min payment    : %s ETH (%s wei)", min_payment_eth, self._min_payment)
        log.info("Poll interval  : %s s", poll_interval)

    # ------------------------------------------------------------------
    # CLI commands
    # ------------------------------------------------------------------

    def check(self) -> None:
        """One-shot scan: print the upkeep status of every active registration."""
        entries = self._scan()
        if not entries:
            log.info("No active registrations with sufficient balance found.")
            return

        for addr, needed, perform_data, balance in entries:
            status = "READY  " if needed else "waiting"
            log.info(
                "[%s] %s | balance: %s ETH | performData: %s",
                status,
                addr,
                Web3.from_wei(balance, "ether"),
                perform_data.hex() if perform_data else "(empty)",
            )

    def run(self) -> None:
        """Continuous loop: scan all contracts and trigger upkeep when ready."""
        log.info("Solver running — press Ctrl-C to stop.")
        try:
            while True:
                try:
                    self._scan_and_trigger()
                except Exception as exc:  # noqa: BLE001
                    log.error("Error during scan: %s", exc, exc_info=True)
                time.sleep(self._poll_interval)
        except KeyboardInterrupt:
            log.info("Stopped.")

    def trigger(self, contract: str) -> None:
        """
        Manually trigger upkeep for a specific contract.

        Calls checkUpkeep() first to obtain performData, then submits
        triggerUpkeep() regardless of the upkeepNeeded flag (useful for
        testing or forced execution).

        Args:
            contract: Address of the registered automatable contract.
        """
        address = Web3.to_checksum_address(contract)
        perform_data = b""
        try:
            _, perform_data = self._registry.functions.checkUpkeep(address).call()
            log.info("checkUpkeep OK — performData: %s", perform_data.hex() or "(empty)")
        except Exception as exc:
            log.warning("checkUpkeep failed (%s) — proceeding with empty performData", exc)

        receipt = self._send_trigger(address, perform_data)
        if receipt:
            status = "confirmed" if receipt["status"] == 1 else "REVERTED"
            log.info("tx %s: %s (block %d)", receipt["transactionHash"].hex(), status, receipt["blockNumber"])

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _scan(self) -> list[tuple]:
        """
        Return (address, upkeepNeeded, performData, balance) for every active
        registration whose balance covers at least min_payment.
        """
        try:
            count = self._registry.functions.getRegisteredContractCount().call()
        except Exception as exc:
            log.error("Could not fetch contract count: %s", exc)
            return []

        log.debug("Scanning %d registered contract(s)…", count)
        entries = []

        for i in range(count):
            try:
                addr = self._registry.functions.getRegisteredContract(i).call()
                reg  = self._registry.functions.getRegistration(addr).call()
                active, _admin, balance = reg

                if not active:
                    log.debug("[%d] %s — inactive, skipping", i, addr)
                    continue

                if balance < self._min_payment:
                    log.debug(
                        "[%d] %s — balance %s wei < min %s wei, skipping",
                        i, addr, balance, self._min_payment,
                    )
                    continue

                upkeep_needed, perform_data = (
                    self._registry.functions.checkUpkeep(addr).call()
                )
                entries.append((addr, upkeep_needed, perform_data, balance))

            except Exception as exc:
                log.warning("Error checking contract index %d: %s", i, exc)

        return entries

    def _scan_and_trigger(self) -> None:
        for addr, upkeep_needed, perform_data, balance in self._scan():
            if not upkeep_needed:
                log.debug("%s — no upkeep needed", addr)
                continue

            log.info(
                "%s — upkeep ready (balance: %s ETH)",
                addr,
                Web3.from_wei(balance, "ether"),
            )
            self._send_trigger(addr, perform_data)

    def _send_trigger(self, address: str, perform_data: bytes) -> Optional[dict]:
        """Build, sign, send, and wait for a triggerUpkeep transaction."""
        try:
            nonce = self._w3.eth.get_transaction_count(self._account.address, "pending")
            tx_params = self._build_tx_params()

            tx = self._registry.functions.triggerUpkeep(
                address,
                perform_data,
                self._min_payment,
            ).build_transaction({
                "from":  self._account.address,
                "nonce": nonce,
                "gas":   self._gas_limit,
                **tx_params,
            })

            signed  = self._w3.eth.account.sign_transaction(tx, self._account.key)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            log.info("  submitted: %s", tx_hash.hex())

            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt["status"] == 1:
                log.info("  confirmed in block %d", receipt["blockNumber"])
            else:
                log.warning("  REVERTED in block %d", receipt["blockNumber"])

            return receipt

        except Exception as exc:
            log.error("  triggerUpkeep failed for %s: %s", address, exc)
            return None

    def _build_tx_params(self) -> dict:
        """
        Return gas-price parameters, preferring EIP-1559 fields when the
        chain supports them and falling back to legacy gasPrice otherwise.
        """
        latest = self._w3.eth.get_block("latest")
        if "baseFeePerGas" in latest:
            base_fee     = latest["baseFeePerGas"]
            # Ask the node for its current priority-fee recommendation rather
            # than hardcoding a value — different chains have different minimums.
            max_priority = int(self._w3.eth.max_priority_fee * self._gas_multiplier)
            max_fee      = int(base_fee * self._gas_multiplier) + max_priority
            return {
                "maxFeePerGas":         max_fee,
                "maxPriorityFeePerGas": max_priority,
            }

        # Legacy chains (pre-EIP-1559)
        gas_price = self._w3.eth.gas_price
        return {"gasPrice": int(gas_price * self._gas_multiplier)}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    fire.Fire(Solver)
