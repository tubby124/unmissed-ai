"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { OnboardingData, defaultAgentNames, Niche } from "@/types/onboarding";

const FEMALE_VOICE = { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline" };
const MALE_VOICE = { id: "b0e6b5c1-3100-44d5-8578-9015aa3023ae", name: "Mark" };

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

interface TeleprompterState {
  activeCard: "greeting" | "message" | null;
  wordIndex: number;
  words: string[];
}

export default function Step2VoicePreview({ data, onUpdate }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [teleprompter, setTeleprompter] = useState<TeleprompterState>({
    activeCard: null,
    wordIndex: 0,
    words: [],
  });
  const hasAutoPlayed = useRef(false);

  // Auto-select default voice if none chosen
  useEffect(() => {
    if (!data.voiceId) {
      onUpdate({ voiceId: FEMALE_VOICE.id, voiceName: FEMALE_VOICE.name });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill agent name from niche
  useEffect(() => {
    if (data.niche) {
      const nicheDefault = defaultAgentNames[data.niche as Niche];
      const isDefaultName = !data.agentName || Object.values(defaultAgentNames).includes(data.agentName);
      if (isDefaultName && nicheDefault && data.agentName !== nicheDefault) {
        onUpdate({ agentName: nicheDefault });
      }
    }
  }, [data.niche]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    if (wordTimerRef.current) {
      clearTimeout(wordTimerRef.current);
      wordTimerRef.current = null;
    }
    setTeleprompter({ activeCard: null, wordIndex: 0, words: [] });
  }, []);

  const animateWords = useCallback((words: string[], durationMs: number) => {
    if (words.length === 0) return;
    const msPerWord = Math.max(80, durationMs / words.length);

    const tick = (idx: number) => {
      setTeleprompter((prev) => ({ ...prev, wordIndex: idx }));
      if (idx < words.length - 1) {
        wordTimerRef.current = setTimeout(() => tick(idx + 1), msPerWord);
      }
    };
    tick(0);
  }, []);

  const playCard = useCallback(
    async (cardType: "greeting" | "message", voiceId: string | null) => {
      if (!voiceId) return;
      stopAudio();

      const businessName = data.businessName || "your business";
      const agentName = data.agentName || "your agent";
      const script =
        cardType === "greeting"
          ? `Hi, thanks for calling ${businessName}. I'm ${agentName}. How can I help you today?`
          : `I'll make sure ${data.ownerName || "the team"} gets your message right away. Can I get your name and number?`;

      const words = script.split(" ");
      setTeleprompter({ activeCard: cardType, wordIndex: 0, words });

      const audio = new Audio(`/api/public/voice-preview/${voiceId}`);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        const durationMs = audio.duration ? audio.duration * 1000 : words.length * 150;
        animateWords(words, durationMs);
      };

      audio.onended = () => {
        setTeleprompter((prev) => ({ ...prev, activeCard: null }));
      };
      audio.onerror = () => {
        stopAudio();
      };

      try {
        await audio.play();
      } catch {
        stopAudio();
      }
    },
    [data.businessName, data.agentName, data.ownerName, stopAudio, animateWords]
  );

  // Auto-play greeting card on mount
  useEffect(() => {
    if (!hasAutoPlayed.current && data.voiceId) {
      hasAutoPlayed.current = true;
      const timer = setTimeout(() => playCard("greeting", data.voiceId), 400);
      return () => clearTimeout(timer);
    }
  }, [data.voiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Replay greeting when voice changes (user picks a different voice)
  const prevVoiceRef = useRef(data.voiceId);
  useEffect(() => {
    if (data.voiceId && data.voiceId !== prevVoiceRef.current) {
      prevVoiceRef.current = data.voiceId;
      playCard("greeting", data.voiceId);
    }
  }, [data.voiceId, playCard]);

  const businessName = data.businessName || "your business";
  const agentName = data.agentName || "your agent";

  const PREVIEW_CARDS = [
    {
      id: "greeting" as const,
      label: "Welcome greeting",
      script: `Hi, thanks for calling ${businessName}. I'm ${agentName}. How can I help you today?`,
    },
    {
      id: "message" as const,
      label: "Message taking",
      script: `I'll make sure ${data.ownerName || "the team"} gets your message right away. Can I get your name and number?`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {agentName !== "your agent" ? `Hear ${agentName}'s voice` : "Choose your agent's voice"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a voice. Tap a card to replay it.
        </p>
      </div>

      {/* Preview scenario cards */}
      <div className="space-y-2">
        {PREVIEW_CARDS.map((card) => {
          const isActive = teleprompter.activeCard === card.id;
          const words = card.script.split(" ");

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => playCard(card.id, data.voiceId)}
              disabled={!data.voiceId}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                  : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Play/pause icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-950/60"
                  }`}
                >
                  {isActive ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5.14v14l11-7-11-7z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {card.label}
                  </p>

                  {/* Teleprompter script */}
                  <p className="text-sm leading-relaxed text-foreground/80 italic">
                    &ldquo;
                    {isActive && teleprompter.words.length > 0
                      ? teleprompter.words.map((word, i) => (
                          <motion.span
                            key={`${i}-${word}`}
                            initial={{ opacity: 0.25 }}
                            animate={{ opacity: i <= teleprompter.wordIndex ? 1 : 0.25 }}
                            transition={{ duration: 0.1 }}
                          >
                            {word}{" "}
                          </motion.span>
                        ))
                      : words.map((word, i) => (
                          <span key={i} className="opacity-70">
                            {word}{" "}
                          </span>
                        ))}
                    &rdquo;
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Male / Female toggle */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Voice gender</p>
        <div className="grid grid-cols-2 gap-3">
          {[FEMALE_VOICE, MALE_VOICE].map((voice) => {
            const isSelected = data.voiceId === voice.id;
            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => onUpdate({ voiceId: voice.id, voiceName: voice.name })}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <span className="text-2xl">{voice.id === FEMALE_VOICE.id ? "👩" : "👨"}</span>
                <span className={`text-sm font-semibold ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>
                  {voice.id === FEMALE_VOICE.id ? "Female" : "Male"}
                </span>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">More voice options available in your dashboard after setup.</p>
      </div>
    </div>
  );
}
