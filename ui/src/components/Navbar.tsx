"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg shrink-0">
              <Image
                src="/logo.png"
                alt="Smarter Contracts logo"
                width={32}
                height={32}
                className="w-full h-full object-cover rounded-lg"
                priority
              />
            </div>
            <span className="font-semibold text-white text-lg group-hover:text-violet-400 transition-colors">
              Smarter Contracts
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-xs text-gray-500 font-mono">
              0G Mainnet
            </span>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
