"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const niches = [
  { id: "auto-glass", label: "🔧 Auto Glass", src: "" },
  { id: "hvac", label: "❄️ HVAC", src: "" },
  { id: "plumbing", label: "🚿 Plumbing", src: "" },
  { id: "legal", label: "⚖️ Legal", src: "" },
  { id: "salon", label: "✂️ Salon", src: "" },
];

const transcriptExcerpts: Record<string, Array<{ speaker: string; text: string }>> = {
  "auto-glass": [
    { speaker: "Agent", text: "Thank you for calling Windshield Hub — I'm your AI assistant. What can I help you with today?" },
    { speaker: "Caller", text: "Yeah hi, I've got a big crack in my windshield. Like 8 inches, right across the driver side." },
    { speaker: "Agent", text: "Oh no — that's definitely a safety concern, especially on the driver's side. Let me get the details so we can get you sorted out. What's the year, make and model of your vehicle?" },
    { speaker: "Caller", text: "It's a 2019 Ford F-150." },
    { speaker: "Agent", text: "Perfect. And do you know if your truck has ADAS — the advanced driver assistance system? That affects the calibration after the replacement." },
    { speaker: "Caller", text: "Uh, yeah I think it does. Lane assist and all that." },
    { speaker: "Agent", text: "Got it — we'll include calibration. What's the best number to reach you when someone calls back?" },
  ],
  "hvac": [
    { speaker: "Agent", text: "Thanks for calling — I'm the AI assistant for this HVAC company. What's going on today?" },
    { speaker: "Caller", text: "Our furnace isn't turning on and it's freezing in here. We've got kids at home." },
    { speaker: "Agent", text: "That's urgent — we'll get someone to you. Is this a complete no-heat situation or is it cycling on and off?" },
    { speaker: "Caller", text: "Completely off. Nothing." },
    { speaker: "Agent", text: "Understood. What's the address and what type of furnace do you have — gas or electric?" },
  ],
  "plumbing": [
    { speaker: "Agent", text: "Thanks for calling — this is the AI assistant. What's the emergency?" },
    { speaker: "Caller", text: "We've got a burst pipe in the basement. I shut off the main but there's water everywhere." },
    { speaker: "Agent", text: "Good call on shutting off the main — that was the right move. Can you tell me your address and is the water still rising?" },
  ],
  "legal": [
    { speaker: "Agent", text: "Thank you for calling — I'm the intake assistant for the firm. How can I help you today?" },
    { speaker: "Caller", text: "I was terminated two weeks ago and I think it might be wrongful dismissal." },
    { speaker: "Agent", text: "I understand — that's a stressful situation. To connect you with the right attorney, can I ask a few quick questions? Did your employer give you a written reason for termination?" },
  ],
  "salon": [
    { speaker: "Agent", text: "Hi, thanks for calling — I'm the booking assistant. Looking to make an appointment?" },
    { speaker: "Caller", text: "Yes, I'd like to get a full color and cut. I was referred by Sarah Martin." },
    { speaker: "Agent", text: "Wonderful, and welcome! Do you have a stylist preference, or would you like me to match you with someone based on your hair type and service?" },
  ],
};

export default function DemoAudioPlayer() {
  const [activeNiche, setActiveNiche] = useState("auto-glass");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentNiche = niches.find((n) => n.id === activeNiche)!;
  const transcript = transcriptExcerpts[activeNiche] || [];

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <section
      id="demo"
      className="py-20 px-4"
      style={{ backgroundColor: "#0D0D0D" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "#3B82F6" }}
          >
            Live Demo
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Hear it. This is your AI receptionist.
          </h2>
          <p className="text-gray-500 text-lg">
            Real call. Real agent. Real lead captured.
          </p>
        </div>

        {/* Niche tabs */}
        <div className="flex gap-2 flex-wrap justify-center mb-6">
          {niches.map((niche) => (
            <button
              key={niche.id}
              onClick={() => {
                setActiveNiche(niche.id);
                setIsPlaying(false);
                if (audioRef.current) audioRef.current.pause();
              }}
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
              style={
                activeNiche === niche.id
                  ? { backgroundColor: "#3B82F6", color: "white" }
                  : { backgroundColor: "#111111", color: "#9CA3AF", border: "1px solid #1F1F1F" }
              }
            >
              {niche.label}
            </button>
          ))}
        </div>

        {/* Player card */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
        >
          {/* Audio element (hidden) */}
          <audio
            ref={audioRef}
            src={currentNiche.src || undefined}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Play button + waveform visual */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={togglePlay}
              className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ backgroundColor: currentNiche.src ? "#3B82F6" : "#374151" }}
              disabled={!currentNiche.src}
              title={!currentNiche.src ? "Audio coming soon" : undefined}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <rect x="4" y="3" width="4" height="12" rx="1" />
                  <rect x="10" y="3" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M5 3.5l11 5.5-11 5.5V3.5z" />
                </svg>
              )}
            </button>

            {/* Fake waveform bars */}
            <div className="flex-1 flex items-center gap-0.5 h-12">
              {Array.from({ length: 48 }).map((_, i) => {
                const height = Math.sin(i * 0.4) * 50 + 50;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all"
                    style={{
                      height: `${Math.max(15, height)}%`,
                      backgroundColor: isPlaying ? "#3B82F6" : "#374151",
                      opacity: isPlaying ? 0.6 + Math.random() * 0.4 : 0.4,
                    }}
                  />
                );
              })}
            </div>

            <div className="text-gray-500 text-xs flex-shrink-0">
              {currentNiche.src ? "2:34" : "Coming soon"}
            </div>
          </div>

          {/* Transcript */}
          <div
            className="rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto"
            style={{ backgroundColor: "#0A0A0A" }}
          >
            <p className="text-gray-600 text-xs uppercase tracking-wider font-mono mb-2">
              Transcript excerpt
            </p>
            {transcript.map((line, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  line.speaker === "Agent" ? "" : "flex-row-reverse text-right"
                }`}
              >
                <div
                  className="flex-shrink-0 w-14 text-xs font-semibold pt-1"
                  style={{
                    color: line.speaker === "Agent" ? "#3B82F6" : "#9CA3AF",
                  }}
                >
                  {line.speaker}
                </div>
                <div
                  className="flex-1 rounded-xl px-3 py-2 text-sm"
                  style={{
                    backgroundColor:
                      line.speaker === "Agent" ? "#0D1A2E" : "#1A1A1A",
                    color: "#D1D5DB",
                  }}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs text-center mt-4">
            {currentNiche.src
              ? "Real call from our live deployment."
              : "Audio recording coming soon. Transcript above is from a real call."}
          </p>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/onboard"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-colors"
            style={{ backgroundColor: "#3B82F6" }}
          >
            This is what your customers hear. Get Mine Set Up →
          </Link>
        </div>
      </div>
    </section>
  );
}
