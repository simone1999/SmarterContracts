import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY          = process.env.PRIVATE_KEY          ?? "";
const RPC_URL              = process.env.RPC_URL              ?? "";
const CHAIN_ID             = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : undefined;
const EXPLORER_API_KEY     = process.env.EXPLORER_API_KEY     ?? "placeholder";
const EXPLORER_API_URL     = process.env.EXPLORER_API_URL     ?? "";
const EXPLORER_BROWSER_URL = process.env.EXPLORER_BROWSER_URL ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },

  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Generic target network — driven entirely by environment variables.
    // Set RPC_URL (and optionally CHAIN_ID) to point at any EVM chain.
    evm: {
      url: RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      ...(CHAIN_ID !== undefined ? { chainId: CHAIN_ID } : {}),
    },
  },

  etherscan: {
    apiKey: {
      // Key name must match the network name above.
      evm: EXPLORER_API_KEY,
    },
    // Register the target chain's block explorer so `hardhat verify` works.
    // Only active when EXPLORER_API_URL is provided.
    customChains: EXPLORER_API_URL
      ? [
          {
            network: "evm",
            chainId: CHAIN_ID ?? 0,
            urls: {
              apiURL:     EXPLORER_API_URL,
              browserURL: EXPLORER_BROWSER_URL,
            },
          },
        ]
      : [],
  },

  paths: {
    sources:   "./src",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
