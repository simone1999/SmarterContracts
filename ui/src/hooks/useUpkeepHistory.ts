"use client";

import { useEffect, useState, useCallback } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { og, REGISTRY_ADDRESS } from "@/lib/config";

export interface UpkeepEvent {
  contractAddress: `0x${string}`;
  solver: `0x${string}`;
  payment: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  timestamp: bigint | null;
}

const publicClient = createPublicClient({
  chain: og,
  transport: http(),
});

const UPKEEP_TRIGGERED_EVENT = parseAbiItem(
  "event UpkeepTriggered(address indexed contractAddress, address indexed solver, uint256 payment)"
);

export function useUpkeepHistory(contractAddress: `0x${string}`) {
  const [events, setEvents] = useState<UpkeepEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const latestBlock = await publicClient.getBlockNumber();
      // Fetch last ~50k blocks (or from genesis if chain is young)
      const fromBlock = latestBlock > 50_000n ? latestBlock - 50_000n : 0n;

      const logs = await publicClient.getLogs({
        address: REGISTRY_ADDRESS,
        event: UPKEEP_TRIGGERED_EVENT,
        args: { contractAddress },
        fromBlock,
        toBlock: "latest",
      });

      // Fetch block timestamps in batches for display
      const blockNumbers = [...new Set(logs.map((l) => l.blockNumber))];
      const blockTimestamps = new Map<bigint, bigint>();

      await Promise.all(
        blockNumbers.map(async (bn) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: bn });
            blockTimestamps.set(bn, block.timestamp);
          } catch {
            // timestamp unavailable for this block
          }
        })
      );

      const parsed: UpkeepEvent[] = logs
        .map((log) => ({
          contractAddress: log.args.contractAddress as `0x${string}`,
          solver: log.args.solver as `0x${string}`,
          payment: log.args.payment as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: blockTimestamps.get(log.blockNumber) ?? null,
        }))
        .reverse(); // newest first

      setEvents(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { events, isLoading, error, refetch: fetchHistory };
}
