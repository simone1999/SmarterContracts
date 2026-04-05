/**
 * Deploy PeriodicCounter and self-register it with an existing AutomationRegistry.
 *
 * Prerequisites:
 *   - AutomationRegistry already deployed (run deployRegistry.ts first)
 *   - REGISTRY_ADDRESS set in .env
 *
 * Usage:
 *   npm run deploy:counter               (targets --network evm, configured via .env)
 *   npm run deploy:counter:local         (targets local hardhat node)
 *
 * Required .env variables:
 *   RPC_URL            RPC endpoint of the target chain
 *   PRIVATE_KEY        Deployer private key (no 0x prefix)
 *   REGISTRY_ADDRESS   Address of a deployed AutomationRegistry
 *
 * Optional .env variables:
 *   CHAIN_ID             Auto-detected from RPC if omitted
 *   COUNTER_INTERVAL     Upkeep interval in seconds  (default: 3600)
 *   COUNTER_FUNDING      Initial solver-reward balance in ETH (default: 0.01)
 *   EXPLORER_API_KEY     Block explorer API key (for verification)
 *   EXPLORER_API_URL     Block explorer API endpoint
 *   EXPLORER_BROWSER_URL Block explorer browser URL
 */

import { ethers, network, run } from "hardhat";

async function main() {
  // ── Config ────────────────────────────────────────────────────────────────
  const registryAddress = process.env.REGISTRY_ADDRESS;
  if (!registryAddress) {
    throw new Error("REGISTRY_ADDRESS is not set in .env");
  }

  const intervalSeconds = BigInt(process.env.COUNTER_INTERVAL ?? "3600");
  const fundingEth      = process.env.COUNTER_FUNDING ?? "0.01";
  const initialFunding  = ethers.parseEther(fundingEth);

  // ── Signer ────────────────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();

  console.log(`Network          : ${network.name}`);
  console.log(`Deployer         : ${deployer.address}`);
  console.log(
    `Balance          : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`
  );
  console.log(`Registry         : ${registryAddress}`);
  console.log(`Interval         : ${intervalSeconds}s`);
  console.log(`Initial funding  : ${fundingEth} ETH\n`);

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("Deploying PeriodicCounter...");
  const Counter = await ethers.getContractFactory("PeriodicCounter");

  // The constructor calls registry.register{value: initialFunding}(owner),
  // so we send ETH with the deployment transaction.
  const counter = await Counter.deploy(
    intervalSeconds,
    registryAddress,
    deployer.address,        // admin of the registry entry
    { value: initialFunding }
  );
  await counter.waitForDeployment();

  const counterAddress = await counter.getAddress();
  console.log(`PeriodicCounter deployed to  : ${counterAddress}`);

  // Confirm registration was recorded
  const Registry = await ethers.getContractAt("AutomationRegistry", registryAddress);
  const reg = await Registry.getRegistration(counterAddress);
  console.log(`Registry entry active        : ${reg.active}`);
  console.log(`Registry entry admin         : ${reg.admin}`);
  console.log(`Registry entry balance       : ${ethers.formatEther(reg.balance)} ETH`);

  // ── Verify ────────────────────────────────────────────────────────────────
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verifying...");
    const deployTx = counter.deploymentTransaction();
    if (deployTx) await deployTx.wait(5);

    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address: counterAddress,
        constructorArguments: [intervalSeconds, registryAddress, deployer.address],
      });
      console.log("Verification successful.");
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Already Verified")) {
        console.log("Contract already verified.");
      } else {
        console.error("Verification failed:", err);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
