"use client";

import { use, useState, useCallback } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { REGISTRY_ADDRESS, og } from "@/lib/config";
import { REGISTRY_ABI } from "@/lib/abi";
import { useUpkeepHistory } from "@/hooks/useUpkeepHistory";
import { TriggerButton } from "@/components/TriggerButton";
import { FundPanel } from "@/components/FundPanel";
import { AdminPanel } from "@/components/AdminPanel";

const publicClient = createPublicClient({
  chain: og,
  transport: http(),
});

interface Registration {
  active: boolean;
  admin: `0x${string}`;
  balance: bigint;
}

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const contractAddress = address as `0x${string}`;

  const { address: walletAddress } = useAccount();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [upkeepNeeded, setUpkeepNeeded] = useState<boolean | null>(null);
  const [performData, setPerformData] = useState<`0x${string}`>("0x");
  const [expectedReward, setExpectedReward] = useState<bigint | null>(null);
  const [regLoading, setRegLoading] = useState(true);

  const { events, isLoading: historyLoading, error: historyError, refetch } =
    useUpkeepHistory(contractAddress);

  const loadRegistration = useCallback(async () => {
    setRegLoading(true);
    setExpectedReward(null);
    try {
      const reg = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getRegistration",
        args: [contractAddress],
      })) as Registration;
      setRegistration(reg);

      if (reg.active) {
        try {
          const [needed, data] = (await publicClient.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "checkUpkeep",
            args: [contractAddress],
          })) as [boolean, `0x${string}`];
          setUpkeepNeeded(needed);
          setPerformData(data);

          if (needed) {
            try {
              const { result } = await publicClient.simulateContract({
                address: REGISTRY_ADDRESS,
                abi: REGISTRY_ABI,
                functionName: "triggerUpkeep",
                args: [contractAddress, data, 0n],
                account: "0x0000000000000000000000000000000000000001",
              });
              setExpectedReward(result as bigint);
            } catch {
              // simulation failed — reward unavailable
            }
          }
        } catch {
          setUpkeepNeeded(null);
        }
      }
    } catch {
      // registration not found
    } finally {
      setRegLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    loadRegistration();
  }, [loadRegistration]);

  const isAdmin =
    !!walletAddress &&
    !!registration?.admin &&
    walletAddress.toLowerCase() === registration.admin.toLowerCase();

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const explorerBase = "https://chainscan.0g.ai";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back to dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white break-all">
          {contractAddress}
        </h1>
        <a
          href={`${explorerBase}/address/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-500 hover:text-violet-400 transition-colors mt-1 inline-flex items-center gap-1"
        >
          View on explorer
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      {/* Registration Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard
          label="Status"
          isLoading={regLoading}
          value={
            registration?.active ? (
              <span className="text-emerald-400 font-semibold">Active</span>
            ) : (
              <span className="text-red-400 font-semibold">Inactive</span>
            )
          }
        />
        <InfoCard
          label="Balance"
          isLoading={regLoading}
          value={
            registration ? (
              <span>
                {parseFloat(formatEther(registration.balance)).toFixed(5)}{" "}
                <span className="text-gray-400 text-sm font-normal">0G</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <InfoCard
          label="You earn"
          isLoading={regLoading}
          highlight={expectedReward !== null}
          value={
            expectedReward !== null ? (
              <span className="text-emerald-400">
                +{parseFloat(formatEther(expectedReward)).toFixed(5)}{" "}
                <span className="text-emerald-600 text-sm font-normal">0G</span>
              </span>
            ) : upkeepNeeded === false ? (
              <span className="text-gray-500">Not ready</span>
            ) : upkeepNeeded === true ? (
              <span className="text-gray-500 text-sm">Simulating…</span>
            ) : (
              "—"
            )
          }
        />
        <InfoCard
          label="Admin"
          isLoading={regLoading}
          value={
            registration ? (
              <a
                href={`${explorerBase}/address/${registration.admin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-violet-400 hover:text-violet-300 text-sm transition-colors"
              >
                {shortAddr(registration.admin)}
              </a>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Upkeep Status + Trigger */}
      {registration?.active && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Upkeep Status</h2>
            {upkeepNeeded !== null && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  upkeepNeeded
                    ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                    : "bg-amber-950 text-amber-400 border-amber-800"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    upkeepNeeded
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-amber-400"
                  }`}
                />
                {upkeepNeeded ? "Ready to trigger" : "Waiting"}
              </span>
            )}
          </div>

          {performData && performData !== "0x" && (
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">performData</p>
              <p className="font-mono text-xs text-gray-300 break-all">
                {performData}
              </p>
            </div>
          )}

          <TriggerButton
            contractAddress={contractAddress}
            performData={performData}
            upkeepNeeded={upkeepNeeded}
            balance={registration.balance}
            onTriggered={() => { refetch(); loadRegistration(); }}
          />
        </div>
      )}

      {/* Top Up Balance */}
      {registration?.active && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-white">Top Up Balance</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Anyone can add funds to keep this contract running. Sent 0G is
              paid out to solvers as trigger rewards.
            </p>
          </div>
          <FundPanel
            contractAddress={contractAddress}
            onFunded={loadRegistration}
          />
        </div>
      )}

      {/* Admin Panel — only shown to the registered admin */}
      {registration && isAdmin && (
        <AdminPanel
          contractAddress={contractAddress}
          balance={registration.balance}
          onAction={loadRegistration}
        />
      )}

      {/* History Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Triggering History
          </h2>
          <button
            onClick={refetch}
            disabled={historyLoading}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <svg
              className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {historyError && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
            {historyError}
          </div>
        )}

        {historyLoading && events.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 bg-gray-900 border border-gray-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {!historyLoading && events.length === 0 && !historyError && (
          <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl text-gray-500">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-medium">No triggerings found</p>
            <p className="text-sm mt-1 text-gray-600">
              Searched last 50,000 blocks
            </p>
          </div>
        )}

        {events.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tx
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Solver
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Payment
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                    Block
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 bg-gray-900/50">
                {events.map((evt, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`${explorerBase}/tx/${evt.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        {shortAddr(evt.transactionHash)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${explorerBase}/address/${evt.solver}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-gray-300 hover:text-white transition-colors"
                      >
                        {shortAddr(evt.solver)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">
                      +{parseFloat(formatEther(evt.payment)).toFixed(6)}{" "}
                      <span className="text-gray-500">0G</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-400 hidden sm:table-cell">
                      {evt.blockNumber.toString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 hidden md:table-cell">
                      {evt.timestamp
                        ? new Date(
                            Number(evt.timestamp) * 1000
                          ).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-xs text-gray-600">
              Showing {events.length} event{events.length !== 1 ? "s" : ""} from
              the last 50,000 blocks
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  isLoading,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  isLoading: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 border ${
        highlight
          ? "bg-emerald-950/30 border-emerald-900"
          : "bg-gray-900 border-gray-800"
      }`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      {isLoading ? (
        <div className="h-5 bg-gray-800 rounded w-24 mt-2 animate-pulse" />
      ) : (
        <div className="font-semibold text-white mt-1">{value}</div>
      )}
    </div>
  );
}
