import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rabbyWallet,
  braveWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { og } from "./config";

// Only injected/browser wallets — no WalletConnect initialization needed,
// which avoids the hanging connection bug caused by an invalid project ID.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Browser Wallets",
      wallets: [metaMaskWallet, rabbyWallet, coinbaseWallet, braveWallet, injectedWallet],
    },
  ],
  {
    appName: "EVM Automation",
    // A placeholder is required by the type but is only used by WalletConnect
    // wallets (none listed above), so it never makes a real WC connection.
    projectId: "evm-automation-ui",
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [og],
  transports: {
    [og.id]: http(),
  },
  ssr: true,
});
