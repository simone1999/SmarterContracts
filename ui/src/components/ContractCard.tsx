"use client";

import { formatEther } from "viem";
import Link from "next/link";
import { TriggerButton } from "./TriggerButton";

interface ContractCardProps {
  address: `0x${string}`;
  balance: bigint;
  admin: string;
  upkeepNeeded: boolean | null;
  performData: `0x${string}` | null;
  expectedReward: bigint | null;
  onTriggered?: () => void;
}

export function ContractCard({
  address,
  balance,
  admin,
  upkeepNeeded,
  performData,
  expectedReward,
  onTriggered,
}: ContractCardProps) {
  const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/contract/${address}`}
            className="font-mono text-sm text-violet-400 hover:text-violet-300 transition-colors break-all"
          >
            {address}
          </Link>
          <p className="text-xs text-gray-500 mt-1">
            Admin:{" "}
            <span className="font-mono text-gray-400">{shortAddr(admin)}</span>
          </p>
        </div>

        <StatusBadge upkeepNeeded={upkeepNeeded} />
      </div>

      {/* Balance + Expected reward */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Balance
          </p>
          <p className="font-mono font-semibold text-white text-sm">
            {parseFloat(formatEther(balance)).toFixed(5)}{" "}
            <span className="text-gray-400 font-normal text-xs">0G</span>
          </p>
        </div>

        <div
          className={`rounded-xl px-3 py-2.5 ${
            upkeepNeeded && expectedReward !== null
              ? "bg-emerald-950/40 border border-emerald-900"
              : "bg-gray-800/50"
          }`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            You earn
          </p>
          {upkeepNeeded === false ? (
            <p className="text-sm text-gray-600 font-medium">Not ready</p>
          ) : expectedReward !== null ? (
            <p className="font-mono font-semibold text-emerald-400 text-sm">
              +{parseFloat(formatEther(expectedReward)).toFixed(5)}{" "}
              <span className="text-emerald-600 font-normal text-xs">0G</span>
            </p>
          ) : upkeepNeeded ? (
            <p className="text-sm text-gray-500 font-medium">Simulating…</p>
          ) : (
            <p className="text-sm text-gray-600 font-medium">—</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <TriggerButton
          contractAddress={address}
          performData={performData ?? "0x"}
          upkeepNeeded={upkeepNeeded}
          balance={balance}
          onTriggered={onTriggered}
        />
        <Link
          href={`/contract/${address}`}
          className="flex-1 text-center text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl py-2.5 transition-colors"
        >
          History
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ upkeepNeeded }: { upkeepNeeded: boolean | null }) {
  if (upkeepNeeded === null) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        Unknown
      </span>
    );
  }

  if (upkeepNeeded) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Ready
      </span>
    );
  }

  return (
    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-400 border border-amber-800">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Waiting
    </span>
  );
}
