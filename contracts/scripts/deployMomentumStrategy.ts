/**
 * Deploy MomentumStrategy and self-register it with an existing AutomationRegistry.
 *
 * Prerequisites:
 *   - AutomationRegistry already deployed (run deployRegistry.ts first)
 *   - REGISTRY_ADDRESS set in .env
 *
 * Usage:
 *   npm run deploy:momentum               (targets --network evm, configured via .env)
 *   npm run deploy:momentum:local         (targets local hardhat node)
 *
 * Required .env variables:
 *   RPC_URL              RPC endpoint of the target chain
 *   PRIVATE_KEY          Deployer private key (no 0x prefix)
 *   REGISTRY_ADDRESS     Address of a deployed AutomationRegistry
 *   MOMENTUM_POOL        Uniswap V3 pool address to track
 *   MOMENTUM_ROUTER      Uniswap V3 SwapRouter address
 *
 * Optional .env variables:
 *   CHAIN_ID                   Auto-detected from RPC if omitted
 *   MOMENTUM_THRESHOLD_TICKS   Tick displacement to trigger (default: 100 ≈ 1%)
 *   MOMENTUM_SOLVER_PAYMENT    Solver reward in ETH            (default: 0.0001)
 *   MOMENTUM_FUNDING           Initial solver-reward balance   (default: 0.01)
 *   EXPLORER_API_KEY           Block explorer API key (for verification)
 *   EXPLORER_API_URL           Block explorer API endpoint
 *   EXPLORER_BROWSER_URL       Block explorer browser URL
 */

import { ethers, network, run } from "hardhat";

async function main() {
  // ── Config ────────────────────────────────────────────────────────────────
  const registryAddress = process.env.REGISTRY_ADDRESS;
  if (!registryAddress) throw new Error("REGISTRY_ADDRESS is not set in .env");

  const poolAddress   = process.env.MOMENTUM_POOL;
  if (!poolAddress)   throw new Error("MOMENTUM_POOL is not set in .env");

  const routerAddress = process.env.MOMENTUM_ROUTER;
  if (!routerAddress) throw new Error("MOMENTUM_ROUTER is not set in .env");

  const thresholdTicks  = parseInt(process.env.MOMENTUM_THRESHOLD_TICKS ?? "100");
  const solverPaymentEth = process.env.MOMENTUM_SOLVER_PAYMENT ?? "0.0001";
  const fundingEth       = process.env.MOMENTUM_FUNDING        ?? "0.01";

  const solverPayment  = ethers.parseEther(solverPaymentEth);
  const initialFunding = ethers.parseEther(fundingEth);

  // ── Signer ────────────────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();

  console.log(`Network           : ${network.name}`);
  console.log(`Deployer          : ${deployer.address}`);
  console.log(`Balance           : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`Registry          : ${registryAddress}`);
  console.log(`Pool              : ${poolAddress}`);
  console.log(`SwapRouter        : ${routerAddress}`);
  console.log(`Threshold ticks   : ${thresholdTicks}  (≈ ${(thresholdTicks * 0.01).toFixed(2)}% price move)`);
  console.log(`Solver payment    : ${solverPaymentEth} ETH`);
  console.log(`Initial funding   : ${fundingEth} ETH\n`);

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("Deploying MomentumStrategy...");
  const Strategy = await ethers.getContractFactory("MomentumStrategy");

  const strategy = await Strategy.deploy(
    poolAddress,
    routerAddress,
    registryAddress,
    deployer.address,   // owner / admin of the registry entry
    thresholdTicks,
    solverPayment,
    { value: initialFunding }
  );
  await strategy.waitForDeployment();

  const strategyAddress = await strategy.getAddress();
  console.log(`MomentumStrategy deployed to : ${strategyAddress}`);

  // ── Read back state ───────────────────────────────────────────────────────
  const [token0, token1, poolFee, lastTick] = await Promise.all([
    strategy.token0(),
    strategy.token1(),
    strategy.poolFee(),
    strategy.lastTick(),
  ]);
  console.log(`token0            : ${token0}`);
  console.log(`token1            : ${token1}`);
  console.log(`Pool fee tier     : ${poolFee}`);
  console.log(`Starting tick     : ${lastTick}`);

  const Registry = await ethers.getContractAt("AutomationRegistry", registryAddress);
  const reg = await Registry.getRegistration(strategyAddress);
  console.log(`Registry active   : ${reg.active}`);
  console.log(`Registry admin    : ${reg.admin}`);
  console.log(`Registry balance  : ${ethers.formatEther(reg.balance)} ETH`);

  // ── Verify ────────────────────────────────────────────────────────────────
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations before verifying...");
    const deployTx = strategy.deploymentTransaction();
    if (deployTx) await deployTx.wait(5);

    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address: strategyAddress,
        constructorArguments: [
          poolAddress,
          routerAddress,
          registryAddress,
          deployer.address,
          thresholdTicks,
          solverPayment,
        ],
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

  console.log(`\nDone. Add to .env if needed:\n  MOMENTUM_ADDRESS=${strategyAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
