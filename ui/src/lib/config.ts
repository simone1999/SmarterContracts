import { defineChain } from "viem";

export const og = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: {
    name: "0G",
    symbol: "0G",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: {
      name: "0G Explorer",
      url: "https://chainscan.0g.ai",
    },
  },
  testnet: false,
});

export const REGISTRY_ADDRESS =
  "0x09DFCe482f15243d9c669b3824d29Df9BcF75baB" as `0x${string}`;

export const MIN_PAYMENT_ETH = 0.0001;
export const MIN_PAYMENT_WEI = BigInt(100_000_000_000_000); // 0.0001 ETH in wei
