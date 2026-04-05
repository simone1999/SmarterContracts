/**
 * Deploy AutomationRegistry
 *
 * Usage:
 *   npm run deploy:registry              (targets --network evm, configured via .env)
 *   npm run deploy:registry:local        (targets local hardhat node)
 *
 * After deployment the registry address is printed to stdout and should be
 * recorded in .env as REGISTRY_ADDRESS before running deployPeriodicCounter.ts.
 *
 * Required .env variables (for live networks):
 *   RPC_URL          RPC endpoint of the target chain
 *   PRIVATE_KEY      Deployer private key (no 0x prefix)
 *
 * Optional .env variables:
 *   CHAIN_ID             Auto-detected from RPC if omitted
 *   EXPLORER_API_KEY     Block explorer API key (for verification)
 *   EXPLORER_API_URL     Block explorer API endpoint
 *   EXPLORER_BROWSER_URL Block explorer browser URL
 */

import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`Network  : ${network.name}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(
    `Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`
  );

  console.log("Deploying AutomationRegistry...");
  const Registry = await ethers.getContractFactory("AutomationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`AutomationRegistry deployed to: ${address}`);

  // Skip verification on local networks
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verifying...");
    // Wait a few blocks so Etherscan has indexed the contract
    const deployTx = registry.deploymentTransaction();
    if (deployTx) await deployTx.wait(5);

    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
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

  console.log(`\nAdd to .env:\n  REGISTRY_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
