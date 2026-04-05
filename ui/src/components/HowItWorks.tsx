"use client";

import { useState } from "react";

// ── layout constants ─────────────────────────────────────────────────────────
const CX = 100;  // Contract lifeline x
const RX = 350;  // Registry lifeline x
const SX = 600;  // Solver lifeline x
const G  = 7;    // gap from lifeline center to arrow tip/tail

// ── colour palette ───────────────────────────────────────────────────────────
const C_BLUE    = "#60a5fa";
const C_VIOLET  = "#a78bfa";
const C_EMERALD = "#34d399";
const C_SLATE   = "#475569";

// ── arrowhead markers ────────────────────────────────────────────────────────
function Defs() {
  const mkr = (id: string, fill: string) => (
    <marker key={id} id={id}
      viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="5" markerHeight="5" orient="auto"
    >
      <path d="M 0 1 L 9 5 L 0 9 z" fill={fill} />
    </marker>
  );
  return (
    <defs>
      {mkr("ah-b", C_BLUE)}
      {mkr("ah-v", C_VIOLET)}
      {mkr("ah-e", C_EMERALD)}
      {mkr("ah-s", C_SLATE)}
    </defs>
  );
}

// ── message arrow + label ────────────────────────────────────────────────────
interface MsgProps {
  y: number; x1: number; x2: number;
  label: string; color: string; dashed?: boolean;
}
function Msg({ y, x1, x2, label, color, dashed = false }: MsgProps) {
  const goRight  = x1 < x2;
  const ax1      = goRight ? x1 + G : x1 - G;
  const ax2      = goRight ? x2 - G : x2 + G;
  const mid      = (x1 + x2) / 2;
  const markerId = color === C_BLUE ? "ah-b" : color === C_VIOLET ? "ah-v"
                 : color === C_EMERALD ? "ah-e" : "ah-s";
  const stroke   = dashed ? C_SLATE : color;
  const textFill = dashed ? "#64748b" : color;

  return (
    <g>
      <line x1={ax1} y1={y} x2={ax2} y2={y}
        stroke={stroke} strokeWidth="1.5"
        strokeDasharray={dashed ? "5,3" : undefined}
        markerEnd={`url(#${markerId})`}
      />
      <text x={mid} y={y - 5} fill={textFill}
        fontSize="10" textAnchor="middle"
        fontFamily="ui-monospace, monospace">
        {label}
      </text>
    </g>
  );
}

// ── phase background band ────────────────────────────────────────────────────
function Phase({ y, h, fill, label, labelColor }: {
  y: number; h: number; fill: string; label: string; labelColor: string;
}) {
  return (
    <g>
      <rect x="44" y={y} width="636" height={h} rx="6" fill={fill} opacity="0.35" />
      <text x="52" y={y + 12} fill={labelColor}
        fontSize="8" fontWeight="700" letterSpacing="0.10em">
        {label}
      </text>
    </g>
  );
}

// ── actor box ────────────────────────────────────────────────────────────────
function Actor({ x, label, fill, stroke, textColor }: {
  x: number; label: string; fill: string; stroke: string; textColor: string;
}) {
  return (
    <g>
      <rect x={x - 80} y="4" width="160" height="34" rx="7"
        fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={x} y="25" fill={textColor}
        fontSize="11" fontWeight="600" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

// ── divider note ─────────────────────────────────────────────────────────────
function Note({ y, text, color }: { y: number; text: string; color: string }) {
  return (
    <text x={350} y={y} fill={color}
      fontSize="8.5" textAnchor="middle" fontStyle="italic">
      {text}
    </text>
  );
}

// ── main diagram ─────────────────────────────────────────────────────────────
function Diagram() {
  const LL_END = 308;

  return (
    <>
      <Defs />

      {/* Phase backgrounds */}
      <Phase y={44}  h={28}  fill="#1e3a5f" label="SETUP"                          labelColor="#93c5fd" />
      <Phase y={78}  h={122} fill="#1e1047" label="MONITOR · off-chain · free"     labelColor="#c4b5fd" />
      <Phase y={206} h={106} fill="#022c22" label="EXECUTE · on-chain · costs gas" labelColor="#6ee7b7" />

      {/* Actor boxes */}
      <Actor x={CX} label="Contract" fill="#1e3a5f" stroke={C_BLUE}    textColor="#93c5fd" />
      <Actor x={RX} label="Registry" fill="#2e1065" stroke={C_VIOLET}  textColor="#c4b5fd" />
      <Actor x={SX} label="Solver"   fill="#064e3b" stroke={C_EMERALD} textColor="#6ee7b7" />

      {/* Lifelines */}
      {([[CX, C_BLUE], [RX, C_VIOLET], [SX, C_EMERALD]] as const).map(([x, clr]) => (
        <line key={x} x1={x} y1="38" x2={x} y2={LL_END}
          stroke={clr} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.35" />
      ))}

      {/* Phase 1 — Setup */}
      <Msg y={62}  x1={CX} x2={RX} color={C_BLUE}    label="register{value}(admin)" />

      {/* Phase 2 — Monitor */}
      <Msg y={98}  x1={SX} x2={RX} color={C_EMERALD} label="checkUpkeep(addr)" />
      <Msg y={126} x1={RX} x2={CX} color={C_VIOLET}  label="checkUpkeep()" />
      <Msg y={154} x1={CX} x2={RX} color={C_BLUE}    label="return (upkeepNeeded, performData)" dashed />
      <Msg y={181} x1={RX} x2={SX} color={C_VIOLET}  label="return (upkeepNeeded, performData)" dashed />
      <Note y={196} color="#7c3aed" text="↓  continues only if upkeepNeeded  ↓" />

      {/* Phase 3 — Execute */}
      <Msg y={222} x1={SX} x2={RX} color={C_EMERALD} label="triggerUpkeep(addr, performData, minPayment)" />
      <Msg y={250} x1={RX} x2={CX} color={C_VIOLET}  label="performUpkeep(performData)" />
      <Msg y={278} x1={CX} x2={RX} color={C_BLUE}    label="return payment (wei)" dashed />
      <Msg y={304} x1={RX} x2={SX} color={C_EMERALD} label="transfer(payment) → solver" />
    </>
  );
}

// ── exported component ───────────────────────────────────────────────────────
export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-900/60 hover:bg-gray-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-violet-400 shrink-0" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-base font-semibold text-white">How it works</span>
          <span className="hidden sm:inline-block text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">
            sequence diagram
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-800 bg-gray-950/50 px-4 sm:px-6 py-4">
          {/* Compact legend */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
            {[
              { cls: "bg-blue-500/20 border-blue-500/40 text-blue-300",     lbl: "Contract" },
              { cls: "bg-violet-500/20 border-violet-500/40 text-violet-300", lbl: "Registry" },
              { cls: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300", lbl: "Solver (you)" },
            ].map(({ cls, lbl }) => (
              <span key={lbl}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${cls}`}>
                {lbl}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <svg className="w-6 h-3" viewBox="0 0 24 6">
                <line x1="0" y1="3" x2="20" y2="3" stroke="#475569"
                  strokeWidth="1.5" strokeDasharray="4,2" />
              </svg>
              return value
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl bg-gray-950 border border-gray-800">
            <svg
              viewBox="0 0 700 316"
              className="w-full min-w-[500px]"
              role="img"
              aria-label="EVM Automation sequence diagram"
            >
              <Diagram />
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
