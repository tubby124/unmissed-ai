"use client";

import { useState } from "react";
import Link from "next/link";

function formatCurrency(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export default function RoiCalculator() {
  const [callsPerWeek, setCallsPerWeek] = useState(30);
  const [jobValue, setJobValue] = useState(400);
  const [missRate, setMissRate] = useState(62);

  const missedPerWeek = Math.round(callsPerWeek * (missRate / 100));
  const lostPerWeek = missedPerWeek * jobValue;
  const lostPerMonth = lostPerWeek * 4.33;
  const agentCost = 247;
  const roi = Math.round((lostPerMonth - agentCost) / agentCost * 100);

  return (
    <section
      id="roi"
      className="py-20 px-4"
      style={{ backgroundColor: "#0D0D0D" }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            ROI Calculator
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Find out what missed calls are costing you.
          </h2>
          <p className="text-gray-500">
            Move the sliders to see your real number.
          </p>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8"
          style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
        >
          {/* Slider: calls per week */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 text-sm font-medium">
                Calls per week
              </label>
              <span className="text-white font-bold text-lg">{callsPerWeek}</span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={callsPerWeek}
              onChange={(e) => setCallsPerWeek(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-1">
              <span>1</span>
              <span>200</span>
            </div>
          </div>

          {/* Slider: job value */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 text-sm font-medium">
                Average job value
              </label>
              <span className="text-white font-bold text-lg">
                ${jobValue.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={jobValue}
              onChange={(e) => setJobValue(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-1">
              <span>$50</span>
              <span>$5,000</span>
            </div>
          </div>

          {/* Slider: miss rate */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 text-sm font-medium">
                Current miss rate
              </label>
              <span className="text-white font-bold text-lg">{missRate}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={missRate}
              onChange={(e) => setMissRate(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-1">
              <span>10%</span>
              <span>100% (all calls missed)</span>
            </div>
          </div>

          {/* Results */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{ backgroundColor: "#0A0A0A", border: "1px solid #1F1F1F" }}
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-500 text-xs mb-1">Calls missed/week</p>
                <p className="text-2xl font-bold text-white">{missedPerWeek}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Lost revenue/week</p>
                <p className="text-2xl font-bold" style={{ color: "#EF4444" }}>
                  {formatCurrency(lostPerWeek)}
                </p>
              </div>
            </div>
            <div
              className="rounded-lg p-4 text-center"
              style={{ backgroundColor: "#111111" }}
            >
              <p className="text-gray-400 text-sm mb-1">
                You&apos;re losing approximately
              </p>
              <p
                className="text-4xl font-black mb-1"
                style={{ color: "#EF4444" }}
              >
                {formatCurrency(lostPerMonth)}/month
              </p>
              <p className="text-gray-500 text-xs">to missed calls</p>
            </div>
            <div
              className="mt-3 rounded-lg p-3 flex items-center justify-between"
              style={{ backgroundColor: "#0D1F0D" }}
            >
              <div>
                <p className="text-green-400 text-sm font-semibold">
                  unmissed.ai Pro Plan
                </p>
                <p className="text-gray-500 text-xs">${agentCost}/month</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold text-lg">
                  {roi > 999 ? "1000%+" : `${roi}%`} ROI
                </p>
                <p className="text-gray-500 text-xs">payback in week 1</p>
              </div>
            </div>
          </div>

          <Link
            href="/onboard"
            className="block w-full text-center py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
            style={{ backgroundColor: "#3B82F6" }}
          >
            Stop the bleeding — Get My Agent Set Up →
          </Link>
          <p className="text-center text-gray-600 text-xs mt-2">
            No contracts · Cancel anytime · Agent live within 24 hours
          </p>
        </div>

        {/* noscript fallback */}
        <noscript>
          <div
            className="mt-4 rounded-xl p-5 text-center"
            style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
          >
            <p className="text-gray-300 text-sm">
              Example: 30 calls/week × 62% miss rate × $400/job ={" "}
              <strong className="text-red-400">$32,136/month lost</strong>.
              Your agent costs $247/month. ROI: week 1.
            </p>
          </div>
        </noscript>
      </div>
    </section>
  );
}
