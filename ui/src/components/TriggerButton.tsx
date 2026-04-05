"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { REGISTRY_ADDRESS, MIN_PAYMENT_WEI } from "@/lib/config";
import { REGISTRY_ABI } from "@/lib/abi";
import { formatEther } from "viem";

interface TriggerButtonProps {
  contractAddress: `0x${string}`;
  performData: `0x${string}`;
  upkeepNeeded: boolean | null;
  balance: bigint;
  onTriggered?: () => void;
}

export function TriggerButton({
  contractAddress,
  performData,
  upkeepNeeded,
  balance,
  onTriggered,
}: TriggerButtonProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleTrigger = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "triggerUpkeep",
        args: [contractAddress, performData, MIN_PAYMENT_WEI],
      });
      setTxHash(hash);
    } catch {
      // user rejected or tx failed – swallow silently
    }
  };

  useEffect(() => {
    if (isSuccess) onTriggered?.();
  }, [isSuccess, onTriggered]);

  const hasBalance = balance >= MIN_PAYMENT_WEI;
  const canTrigger = upkeepNeeded && hasBalance;

  let label = "Trigger";
  if (!isConnected) label = "Connect to trigger";
  else if (isPending) label = "Confirm in wallet…";
  else if (isConfirming) label = "Confirming…";
  else if (isSuccess) label = "Triggered!";
  else if (!hasBalance)
    label = `Balance too low (${parseFloat(formatEther(balance)).toFixed(6)} 0G)`;
  else if (!upkeepNeeded) label = "Not ready";

  const isDisabled =
    isConnected &&
    (isPending || isConfirming || isSuccess || !canTrigger);

  return (
    <button
      onClick={handleTrigger}
      disabled={isDisabled}
      className={`
        flex-1 relative rounded-xl px-4 py-2.5 text-sm font-semibold transition-all
        ${
          isSuccess
            ? "bg-emerald-600 text-white cursor-default"
            : !isConnected || canTrigger
            ? "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            : "bg-gray-800 text-gray-500 cursor-not-allowed"
        }
        ${isPending || isConfirming ? "opacity-70 cursor-wait" : ""}
      `}
    >
      {(isPending || isConfirming) && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          <svg
            className="animate-spin h-4 w-4 text-white/70"
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
        </span>
      )}
      {label}
    </button>
  );
}
