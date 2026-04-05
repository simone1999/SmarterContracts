"use client";

import { useRegisteredContracts } from "@/hooks/useRegisteredContracts";
import { ContractCard } from "@/components/ContractCard";
import { REGISTRY_ADDRESS } from "@/lib/config";
import { HowItWorks } from "@/components/HowItWorks";

export default function Home() {
  const { contracts, isInitialLoad, isRefreshing, error, refetch } =
    useRegisteredContracts();

  const readyCount = contracts.filter((c) => c.upkeepNeeded).length;
  const hasContracts = contracts.length > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Automation Dashboard</h1>
        <p className="mt-2 text-gray-400 text-sm">
          Permissionless upkeep registry on 0G Network. Trigger ready contracts
          to earn solver rewards.
        </p>
        <p className="mt-1 text-xs text-gray-600 font-mono">
          Registry:{" "}
          <a
            href={`https://chainscan.0g.ai/address/${REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-500 hover:text-violet-400 transition-colors"
          >
            {REGISTRY_ADDRESS}
          </a>
        </p>
      </div>

      {/* Stats Bar — always rendered once we have data to avoid layout shift */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {isInitialLoad ? (
          <>
            <div className="h-[72px] rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
            <div className="h-[72px] rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
            <div className="h-[72px] rounded-xl bg-gray-900 border border-gray-800 animate-pulse hidden sm:block" />
          </>
        ) : (
          <>
            <StatCard label="Total contracts" value={contracts.length} />
            <StatCard
              label="Ready to trigger"
              value={readyCount}
              highlight={readyCount > 0}
            />
            <StatCard label="Waiting" value={contracts.length - readyCount} />
          </>
        )}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">
          Active Registrations
        </h2>
        <button
          onClick={refetch}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
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
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <p className="text-red-400 font-medium">Failed to load contracts</p>
          <p className="text-red-500/70 text-sm mt-1">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-red-800/50 hover:bg-red-700/50 text-red-300 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial loading skeletons — only shown when we have no data yet */}
      {isInitialLoad && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between gap-2">
                <div className="h-4 bg-gray-800 rounded w-48" />
                <div className="h-6 bg-gray-800 rounded-full w-16 shrink-0" />
              </div>
              <div className="h-3 bg-gray-800 rounded w-32" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-14 bg-gray-800 rounded-xl" />
                <div className="h-14 bg-gray-800 rounded-xl" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 h-10 bg-gray-800 rounded-xl" />
                <div className="flex-1 h-10 bg-gray-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isInitialLoad && !hasContracts && !error && (
        <div className="text-center py-20 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="font-medium">No active registrations found</p>
          <p className="text-sm mt-1">
            Deploy and register an automatable contract to get started.
          </p>
        </div>
      )}

      {/* Contract Grid — always rendered when we have contracts; no re-mount on refresh */}
      {hasContracts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.address}
              address={contract.address}
              balance={contract.balance}
              admin={contract.admin}
              upkeepNeeded={contract.upkeepNeeded}
              performData={contract.performData}
              expectedReward={contract.expectedReward}
              onTriggered={refetch}
            />
          ))}
        </div>
      )}

      <HowItWorks />

      <footer className="pt-8 border-t border-gray-800 text-center text-xs text-gray-600">
        Auto-refreshes every 15 s · Data sourced live from the RPC
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight
          ? "bg-emerald-950/30 border-emerald-800"
          : "bg-gray-900 border-gray-800"
      }`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${
          highlight ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
