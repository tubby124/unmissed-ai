"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

interface TranscriptLine {
  role: "agent" | "user";
  text: string;
  startTime?: number;
  endTime?: number;
}

interface CallOutcome {
  caller: string;
  status: "HOT" | "WARM" | "COLD";
  intent: string;
  nextStep: string;
  duration: string;
  agentName: string;
}

interface Niche {
  id: string;
  label: string;
  agentName: string;
  audioUrl?: string;
  duration?: number;
  summary: string;
  transcript: TranscriptLine[];
  outcome?: CallOutcome;
}

const niches: Niche[] = [
  {
    id: "auto-glass",
    label: "Auto Glass",
    agentName: "Mark",
    audioUrl:
      "https://qwhvblomlgeapzhnuwlb.supabase.co/storage/v1/object/public/recordings/3b8fda2d-6be8-4b56-9d0b-1cd5d4923db8.mp3",
    duration: 98,
    summary: "2026 BYD windshield + ADAS calibration — weekday callback confirmed",
    transcript: [
      { role: "agent", text: "windshield hub auto glass, this is mark — how can i help ya today?", startTime: 0.865, endTime: 5.585 },
      { role: "user", text: "Hey, Mark. Looking to get my windshield replaced.", startTime: 6.816, endTime: 9.472 },
      { role: "agent", text: "gotcha, yeah we can definitely help with that. what year, make, and model is it?", startTime: 10.245, endTime: 15.825 },
      { role: "user", text: "It's a BYD twenty twenty six.", startTime: 17.984, endTime: 20.8 },
      { role: "agent", text: "do you know if it's got that lane assist camera up by the mirror?", startTime: 29.925, endTime: 32.805 },
      { role: "user", text: "That Chinese car, of course it has that.", startTime: 34.24, endTime: 36.416 },
      { role: "agent", text: "right on, that means we'll need to calibrate it. when were ya looking to bring it in?", startTime: 37.365, endTime: 54.525 },
      { role: "user", text: "As soon as possible, whenever is available.", startTime: 56.48, endTime: 58.944 },
      { role: "agent", text: "i'll get the boss to check the schedule and call ya back to confirm. this the best number to reach ya?", startTime: 72.365, endTime: 80.505 },
      { role: "user", text: "Yes. The best.", startTime: 81.952, endTime: 82.688 },
      { role: "agent", text: "alright, i'll talk to the boys and we'll give ya a call back shortly.", startTime: 83.625, endTime: 90.405 },
      { role: "user", text: "Okay. Bye.", startTime: 90.08, endTime: 90.528 },
      { role: "agent", text: "talk soon eh.", startTime: 91.745, endTime: 92.485 },
    ],
    outcome: {
      caller: "Customer",
      status: "WARM",
      intent: "Windshield replacement — 2026 BYD + ADAS calibration needed",
      nextStep: "Callback to confirm weekday booking slot",
      duration: "1:38",
      agentName: "Mark",
    },
  },
  {
    id: "property-mgmt",
    label: "Property Mgmt",
    agentName: "Jade",
    audioUrl:
      "https://qwhvblomlgeapzhnuwlb.supabase.co/storage/v1/object/public/recordings/b5e7ba6e-014d-4981-9097-e39403f70e47.mp3",
    duration: 84,
    summary: "Active dishwasher leak — Jacob, 4705 81st St NW — flagged HOT, callback dispatched",
    transcript: [
      { role: "agent", text: "Urban Vibe Properties — this is Jade, an AI assistant. How can i help ya today?", startTime: 0.565, endTime: 6.725 },
      { role: "user", text: "I'm looking to speak with a property manager — my unit is having a lot of problems right now.", startTime: 6.432, endTime: 15.904 },
      { role: "agent", text: "gotcha — Ray's our property manager. he's tied up right now. what's your name?", startTime: 16.685, endTime: 21.425 },
      { role: "agent", text: "got it, Jacob. and what's your unit number or address?", startTime: 24.485, endTime: 28.325 },
      { role: "user", text: "4705 81st Street Northwest.", startTime: 29.536, endTime: 33.024 },
      { role: "agent", text: "and what's going on with the unit?", startTime: 33.805, endTime: 40.425 },
      { role: "user", text: "the dishwasher is literally leaking, and I don't know how to turn it off.", startTime: 41.728, endTime: 45.632 },
      { role: "agent", text: "oh no — is it actively leaking right now, like a lot of water?", startTime: 46.385, endTime: 50.765 },
      { role: "user", text: "Yes.", startTime: 51.808, endTime: 52.224 },
      { role: "agent", text: "okay, flagging this urgent — try to avoid the area and put a towel down. what's the best number to reach ya?", startTime: 53.025, endTime: 62.505 },
      { role: "user", text: "Just call me back at (306) 850-7687.", startTime: 63.712, endTime: 67.84 },
      { role: "agent", text: "got it. Ray's on this right away. talk soon.", startTime: 69.065, endTime: 76.845 },
    ],
    outcome: {
      caller: "Jacob",
      status: "HOT",
      intent: "Active dishwasher leak — 4705 81st St NW, water on floor",
      nextStep: "Ray dispatched immediately — callback to (306) 850-7687",
      duration: "1:24",
      agentName: "Jade",
    },
  },
  {
    id: "hvac",
    label: "HVAC",
    agentName: "Agent",
    summary: "No-heat emergency — gas furnace, kids at home — tech dispatched same-day",
    transcript: [
      { role: "agent", text: "Thanks for calling — I'm the AI assistant for this HVAC company. What's going on today?" },
      { role: "user", text: "Our furnace isn't turning on and it's freezing in here. We've got kids at home." },
      { role: "agent", text: "That's urgent — we'll get someone to you. Is this a complete no-heat situation or is it cycling on and off?" },
      { role: "user", text: "Completely off. Nothing." },
      { role: "agent", text: "Understood. What's the address and what type of furnace do you have — gas or electric?" },
      { role: "user", text: "Gas. 4821 River Drive. Please hurry." },
      { role: "agent", text: "Got it — flagging this as urgent. A tech will call you back within the hour to confirm arrival." },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    agentName: "Agent",
    summary: "Wrongful dismissal inquiry — intake completed, attorney callback scheduled",
    transcript: [
      { role: "agent", text: "Thank you for calling — I'm the intake assistant for the firm. How can I help you today?" },
      { role: "user", text: "I was terminated two weeks ago and I think it might be wrongful dismissal." },
      { role: "agent", text: "I understand — that's a stressful situation. To connect you with the right attorney, can I ask a few quick questions? Did your employer give you a written reason for termination?" },
      { role: "user", text: "No. They said it was 'restructuring' but I was the only one let go." },
      { role: "agent", text: "That's important context. How long were you employed there, and do you have any documentation — emails, performance reviews?" },
      { role: "user", text: "Six years. And yes, my last review was outstanding." },
      { role: "agent", text: "Got it — six years, outstanding review, verbal-only reason. I'll have an attorney call you back today. Best number is the one you're calling from?" },
    ],
  },
  {
    id: "realtor",
    label: "Realtor",
    agentName: "Agent",
    summary: "Pre-approval ready buyer — 3BR under $550K, showing request booked",
    transcript: [
      { role: "agent", text: "Hi, thanks for calling — I'm the AI assistant for this real estate team. Looking to buy or sell?" },
      { role: "user", text: "Buy. We're pre-approved and ready to move fast. Looking for a 3-bed under $550K." },
      { role: "agent", text: "Perfect timing — there are a few listings that just came up in that range. Are you flexible on neighbourhood, or is there a specific area you're targeting?" },
      { role: "user", text: "Southeast side, good school zone." },
      { role: "agent", text: "Got it — I'll pull those listings and have the agent reach out today. Do you have any firm timeline or is this open-ended?" },
      { role: "user", text: "We'd like to be in before school starts. So by August." },
      { role: "agent", text: "That's very workable. I'll have the agent call you back within the hour with some options." },
    ],
  },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function DemoAudioPlayer() {
  const [activeNiche, setActiveNiche] = useState("auto-glass");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  const niche = niches.find((n) => n.id === activeNiche)!;
  const hasAudio = !!niche.audioUrl;

  const syncTranscript = useCallback(() => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);

    const idx = niche.transcript.findIndex(
      (line) =>
        line.startTime !== undefined &&
        line.endTime !== undefined &&
        t >= line.startTime &&
        t <= line.endTime
    );

    if (idx !== -1 && idx !== activeLineIdx) {
      setActiveLineIdx(idx);
      const el = bubbleRefs.current[idx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    if (niche.outcome && t > (niche.duration ?? 98) * 0.3) {
      setShowOutcome(true);
    }

    rafRef.current = requestAnimationFrame(syncTranscript);
  }, [activeNiche, activeLineIdx, niche]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(syncTranscript);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, syncTranscript]);

  const switchNiche = (id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setActiveNiche(id);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setActiveLineIdx(null);
    setShowOutcome(false);
    bubbleRefs.current = [];
  };

  const togglePlay = () => {
    if (!audioRef.current || !hasAudio) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
    if (niche.outcome && t > (niche.duration ?? 98) * 0.3) {
      setShowOutcome(true);
    }
  };

  return (
    <section id="demo" className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <style>{`
        @keyframes soundbar {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        .soundbar-1 { animation: soundbar 0.8s ease-in-out infinite; }
        .soundbar-2 { animation: soundbar 0.8s ease-in-out infinite 0.25s; }
        .soundbar-3 { animation: soundbar 0.8s ease-in-out infinite 0.5s; }
        .demo-progress::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
        }
        .demo-progress::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          border: none;
          cursor: pointer;
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--color-primary)" }}>
            Live Demo
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
            Hear it. This is your AI receptionist.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
            Demo call. Real agent. Real lead captured.
          </p>
        </div>

        {/* Niche tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {niches.map((n) => (
            <div key={n.id} className="relative flex-shrink-0">
              <button
                onClick={() => switchNiche(n.id)}
                className="relative px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                style={
                  activeNiche === n.id
                    ? { backgroundColor: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.3)" }
                    : { backgroundColor: "transparent", color: "#71717A", border: "1px solid #27272A" }
                }
              >
                {n.label}
                {!n.audioUrl && (
                  <span className="ml-1.5 text-xs" style={{ color: "#52525B" }}>·</span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* iPhone frame */}
        <div className="flex flex-col items-center">
          {/* Hidden audio */}
          {hasAudio && (
            <audio
              ref={audioRef}
              src={niche.audioUrl}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
              onEnded={() => {
                setIsPlaying(false);
                setActiveLineIdx(null);
                if (niche.outcome) setShowOutcome(true);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          <div
            style={{
              width: 304,
              background: "#1C1C1E",
              borderRadius: 48,
              border: "8px solid #1C1C1E",
              padding: 2,
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            {/* Screen */}
            <div style={{ background: "#000", borderRadius: 40, overflow: "hidden" }}>

              {/* Status bar */}
              <div
                style={{
                  background: "#111",
                  padding: "10px 16px 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #222",
                }}
              >
                <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 600 }}>
                  {niche.agentName} · {niche.label}
                </span>
                <span
                  style={{
                    background: "rgba(16,185,129,0.15)",
                    color: "#34D399",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    letterSpacing: "0.03em",
                  }}
                >
                  Demo call
                </span>
              </div>

              {/* Timer */}
              {hasAudio && (
                <div style={{ background: "#000", padding: "5px 16px 3px", textAlign: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "monospace" }}>
                    {formatTime(currentTime)} / {formatTime(duration || niche.duration || 0)}
                  </span>
                </div>
              )}

              {/* Bubbles */}
              <div
                ref={transcriptRef}
                style={{
                  padding: "10px 12px 8px",
                  overflowY: "auto",
                  maxHeight: 340,
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  background: "#000",
                }}
              >
                {niche.transcript.map((line, i) => {
                  const isActive = activeLineIdx === i;
                  const isAgent = line.role === "agent";
                  return (
                    <motion.div
                      key={`${activeNiche}-${i}`}
                      ref={(el) => { bubbleRefs.current[i] = el; }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      style={{ display: "flex", justifyContent: isAgent ? "flex-start" : "flex-end" }}
                    >
                      <div
                        style={{
                          maxWidth: "78%",
                          padding: "8px 12px",
                          borderRadius: isAgent ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                          background: isActive
                            ? isAgent ? "#6366F1" : "#D1D5DB"
                            : isAgent ? "#4F46E5" : "#E5E7EB",
                          color: isAgent ? "#fff" : "#111827",
                          fontSize: 13,
                          lineHeight: 1.45,
                          transition: "background 0.2s",
                        }}
                      >
                        {line.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Home indicator */}
              <div style={{ background: "#000", padding: "10px 0 8px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: 120, height: 4, background: "rgba(255,255,255,0.22)", borderRadius: 2 }} />
              </div>
            </div>
          </div>

          {/* Outcome card */}
          <AnimatePresence>
            {showOutcome && niche.outcome && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full overflow-hidden mt-3"
                style={{ maxWidth: 304 }}
              >
                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: niche.outcome.status === "HOT" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                    border: `1px solid ${niche.outcome.status === "HOT" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                    borderLeft: `3px solid ${niche.outcome.status === "HOT" ? "#EF4444" : "#F59E0B"}`,
                  }}
                >
                  <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#64748B" }}>
                    AI captured this lead:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: niche.outcome.status === "HOT" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: niche.outcome.status === "HOT" ? "#F87171" : "#FCD34D",
                      }}
                    >
                      {niche.outcome.status}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "#94A3B8" }}>{niche.outcome.caller}</span>
                    <span className="text-xs" style={{ color: "#64748B" }}>· {niche.outcome.duration}</span>
                  </div>
                  <p className="text-sm mb-1" style={{ color: "#94A3B8" }}>{niche.outcome.intent}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
                    <span style={{ color: niche.outcome.status === "HOT" ? "#F87171" : "#FCD34D" }}>→</span>
                    {niche.outcome.nextStep}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio player */}
          {hasAudio && (
            <div
              className="w-full mt-3 rounded-xl px-4 py-3"
              style={{
                maxWidth: 304,
                backgroundColor: "#0F172A",
                border: "1px solid #1E293B",
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="flex-shrink-0 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="#111">
                          <rect x="2" y="2" width="4" height="10" rx="1" />
                          <rect x="8" y="2" width="4" height="10" rx="1" />
                        </svg>
                      </div>
                      <div className="flex items-end gap-0.5 h-4">
                        <div className="soundbar-1 w-1 rounded-full" style={{ backgroundColor: "#818CF8" }} />
                        <div className="soundbar-2 w-1 rounded-full" style={{ backgroundColor: "#818CF8" }} />
                        <div className="soundbar-3 w-1 rounded-full" style={{ backgroundColor: "#818CF8" }} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                      style={{ backgroundColor: "#F1F5F9" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="#111">
                        <path d="M3 2l9 5-9 5V2z" />
                      </svg>
                    </div>
                  )}
                </button>

                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || niche.duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="demo-progress w-full h-1.5 rounded-full cursor-pointer appearance-none"
                    style={{
                      background: `linear-gradient(to right, #818CF8 ${((currentTime / (duration || niche.duration || 100)) * 100).toFixed(1)}%, #27272A ${((currentTime / (duration || niche.duration || 100)) * 100).toFixed(1)}%)`,
                      outline: "none",
                    }}
                  />
                  <p className="text-xs" style={{ color: "#64748B" }}>
                    {niche.agentName} · Demo recording
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/onboard"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "var(--color-cta)" }}
          >
            This is what your customers hear. Get Mine Set Up →
          </Link>
        </div>
      </div>
    </section>
  );
}
