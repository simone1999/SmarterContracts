"use client";

import { useState, useEffect } from "react";
import { formatEther, parseEther } from "viem";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { REGISTRY_ADDRESS } from "@/lib/config";
import { REGISTRY_ABI } from "@/lib/abi";

interface AdminPanelProps {
  contractAddress: `0x${string}`;
  balance: bigint;
  onAction: () => void;
}

export function AdminPanel({
  contractAddress,
  balance,
  onAction,
}: AdminPanelProps) {
  return (
    <div className="bg-gray-900 border border-amber-900/50 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-950 text-amber-400 border border-amber-800">
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
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Admin
        </span>
        <h3 className="font-semibold text-white">Management</h3>
      </div>

      <WithdrawSection
        contractAddress={contractAddress}
        balance={balance}
        onWithdrawn={onAction}
      />

      <div className="border-t border-gray-800" />

      <CancelSection contractAddress={contractAddress} onCancelled={onAction} />
    </div>
  );
}

/* ─── Withdraw ─────────────────────────────────────────────────────────────── */

function WithdrawSection({
  contractAddress,
  balance,
  onWithdrawn,
}: {
  contractAddress: `0x${string}`;
  balance: bigint;
  onWithdrawn: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess && txHash) onWithdrawn();
  }, [isSuccess, txHash, onWithdrawn]);

  function validate(val: string): bigint | null {
    try {
      const parsed = parseEther(val as `${number}`);
      if (parsed <= 0n) return null;
      if (parsed > balance) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function handleWithdraw() {
    const wei = validate(amount);
    if (wei === null) {
      setInputError(
        `Enter an amount between 0 and ${parseFloat(formatEther(balance)).toFixed(6)}`
      );
      return;
    }
    setInputError(null);

    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "withdraw",
        args: [contractAddress, wei],
      });
      setTxHash(hash);
      setAmount("");
    } catch {
      // rejected
    }
  }

  const isBusy = isPending || isConfirming;
  const balanceEth = parseFloat(formatEther(balance)).toFixed(6);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-300">Withdraw balance</p>
        <button
          type="button"
          onClick={() => {
            setAmount(formatEther(balance));
            setInputError(null);
          }}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Max ({balanceEth} 0G)
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setInputError(null);
            }}
            disabled={isBusy || isSuccess}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 disabled:opacity-50 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
            0G
          </span>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={isBusy || isSuccess || balance === 0n}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            isSuccess
              ? "bg-emerald-600 text-white cursor-default"
              : "bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
            ? "Done!"
            : isPending
            ? "Confirm…"
            : isConfirming
            ? "Confirming…"
            : "Withdraw"}
        </button>
      </div>

      {inputError && <p className="text-xs text-red-400">{inputError}</p>}
    </div>
  );
}

/* ─── Cancel Registration ───────────────────────────────────────────────────── */

function CancelSection({
  contractAddress,
  onCancelled,
}: {
  contractAddress: `0x${string}`;
  onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirmingTx, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) onCancelled();
  }, [isSuccess, txHash, onCancelled]);

  async function handleCancel() {
    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "cancelRegistration",
        args: [contractAddress],
      });
      setTxHash(hash);
      setConfirming(false);
    } catch {
      setConfirming(false);
    }
  }

  const isBusy = isPending || isConfirmingTx;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-300">Cancel registration</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Deactivates the contract and refunds the full remaining balance to
          your wallet. This cannot be undone.
        </p>
      </div>

      {!confirming && !isBusy && !isSuccess && (
        <button
          onClick={() => setConfirming(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-red-800 text-red-400 hover:bg-red-950/40 transition-colors"
        >
          Cancel registration…
        </button>
      )}

      {confirming && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-red-400 font-medium">Are you sure?</span>
          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-60 flex items-center gap-2"
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
            Yes, cancel it
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
          >
            Keep it
          </button>
        </div>
      )}

      {isBusy && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg
            className="animate-spin h-4 w-4 text-red-400"
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
          {isPending ? "Waiting for wallet…" : "Cancelling…"}
        </div>
      )}

      {isSuccess && (
        <p className="text-sm text-emerald-400 font-medium">
          Registration cancelled — balance refunded.
        </p>
      )}
    </div>
  );
}
