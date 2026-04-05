"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPublicClient, http } from "viem";
import { REGISTRY_ADDRESS, og } from "@/lib/config";
import { REGISTRY_ABI } from "@/lib/abi";

export interface ContractInfo {
  address: `0x${string}`;
  active: boolean;
  admin: `0x${string}`;
  balance: bigint;
  upkeepNeeded: boolean | null;
  performData: `0x${string}` | null;
  expectedReward: bigint | null;
  checkError: string | null;
}

// Dummy solver address used only for eth_call simulation — no funds required.
const SIMULATION_ACCOUNT =
  "0x0000000000000000000000000000000000000001" as const;

const publicClient = createPublicClient({
  chain: og,
  transport: http(),
});

export function useRegisteredContracts() {
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  // True only for the very first fetch when we have nothing to show yet.
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // True whenever a fetch is in flight (including periodic refreshes).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const fetchContracts = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const count = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getRegisteredContractCount",
      })) as bigint;

      const indices = Array.from({ length: Number(count) }, (_, i) => BigInt(i));

      const addresses = await Promise.all(
        indices.map((i) =>
          publicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "getRegisteredContract",
            args: [i],
          }) as Promise<`0x${string}`>
        )
      );

      const registrations = await Promise.all(
        addresses.map((addr) =>
          publicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "getRegistration",
            args: [addr],
          }) as Promise<{ active: boolean; admin: `0x${string}`; balance: bigint }>
        )
      );

      const active = addresses
        .map((addr, i) => ({ addr, reg: registrations[i] }))
        .filter(({ reg }) => reg.active);

      const withUpkeep = await Promise.all(
        active.map(async ({ addr, reg }) => {
          try {
            const [upkeepNeeded, performData] = (await publicClient.readContract({
              address: REGISTRY_ADDRESS,
              abi: REGISTRY_ABI,
              functionName: "checkUpkeep",
              args: [addr],
            })) as [boolean, `0x${string}`];

            // Simulate triggerUpkeep to get the exact reward the solver would
            // receive. Uses eth_call (no gas spent, no state change).
            let expectedReward: bigint | null = null;
            if (upkeepNeeded) {
              try {
                const { result } = await publicClient.simulateContract({
                  address: REGISTRY_ADDRESS,
                  abi: REGISTRY_ABI,
                  functionName: "triggerUpkeep",
                  args: [addr, performData, 0n],
                  account: SIMULATION_ACCOUNT,
                });
                expectedReward = result as bigint;
              } catch {
                // Simulation failed — reward stays null.
              }
            }

            return {
              address: addr,
              active: reg.active,
              admin: reg.admin,
              balance: reg.balance,
              upkeepNeeded,
              performData,
              expectedReward,
              checkError: null,
            } satisfies ContractInfo;
          } catch (e) {
            return {
              address: addr,
              active: reg.active,
              admin: reg.admin,
              balance: reg.balance,
              upkeepNeeded: null,
              performData: null,
              expectedReward: null,
              checkError: e instanceof Error ? e.message : "Unknown error",
            } satisfies ContractInfo;
          }
        })
      );

      setContracts(withUpkeep);
      hasDataRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contracts");
    } finally {
      setIsRefreshing(false);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
    const interval = setInterval(fetchContracts, 15_000);
    return () => clearInterval(interval);
  }, [fetchContracts]);

  return {
    contracts,
    isInitialLoad,
    isRefreshing,
    error,
    refetch: fetchContracts,
  };
}
