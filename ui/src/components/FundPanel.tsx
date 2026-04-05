"use client";

import { useState, useEffect } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { REGISTRY_ADDRESS } from "@/lib/config";
import { REGISTRY_ABI } from "@/lib/abi";

interface FundPanelProps {
  contractAddress: `0x${string}`;
  onFunded: () => void;
}

export function FundPanel({ contractAddress, onFunded }: FundPanelProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [amount, setAmount] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess && txHash) onFunded();
  }, [isSuccess, txHash, onFunded]);

  function validate(val: string): bigint | null {
    try {
      const parsed = parseEther(val as `${number}`);
      if (parsed <= 0n) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function handleFund() {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    const wei = validate(amount);
    if (wei === null) {
      setInputError("Enter a valid amount greater than 0");
      return;
    }
    setInputError(null);

    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "fund",
        args: [contractAddress],
        value: wei,
      });
      setTxHash(hash);
      setAmount("");
    } catch {
      // user rejected or tx failed
    }
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setInputError(null);
            }}
            disabled={isBusy}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 disabled:opacity-50 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
            0G
          </span>
        </div>

        <button
          onClick={handleFund}
          disabled={isBusy || isSuccess}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            isSuccess
              ? "bg-emerald-600 text-white cursor-default"
              : "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          }`}
        >
          {isBusy && (
            <svg
              className="animate-spin h-4 w-4 text-white/70 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          )}
          {isSuccess
            ? "Funded!"
            : isPending
            ? "Confirm…"
            : isConfirming
            ? "Confirming…"
            : !isConnected
            ? "Connect"
            : "Top Up"}
        </button>
      </div>

      {inputError && (
        <p className="text-xs text-red-400">{inputError}</p>
      )}
    </div>
  );
}
