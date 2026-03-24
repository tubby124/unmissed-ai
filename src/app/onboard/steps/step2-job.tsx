"use client";

import { motion } from "motion/react";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const JOB_OPTIONS: {
  id: NonNullable<OnboardingData["agentJob"]>;
  icon: string;
  title: string;
  description: string;
  callHandlingMode: OnboardingData["callHandlingMode"];
}[] = [
  {
    id: "message_taker",
    icon: "📋",
    title: "Take messages",
    description: "Answers every call, collects the caller's info, and texts you a summary",
    callHandlingMode: "triage",
  },
  {
    id: "receptionist",
    icon: "💬",
    title: "Answer questions",
    description: "Handles FAQs, explains your services, and qualifies callers before they reach you",
    callHandlingMode: "triage",
  },
  {
    id: "booking_agent",
    icon: "📅",
    title: "Book & schedule",
    description: "Books appointments directly and transfers urgent callers to your phone",
    callHandlingMode: "full_service",
  },
];

export default function Step2Job({ data, onUpdate }: Props) {
  const selected = data.agentJob;
  const agentName = data.agentName || "your agent";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          What should {agentName} do?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the main job. You can fine-tune capabilities in the next step.
        </p>
      </div>

      <div className="space-y-3">
        {JOB_OPTIONS.map(({ id, icon, title, description, callHandlingMode }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onUpdate({ agentJob: id, callHandlingMode })}
              className={`w-full text-left flex items-start gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                  : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
              }`}
            >
              {/* Radio indicator */}
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "border-indigo-600" : "border-muted-foreground/40"
                }`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full bg-indigo-600"
                  />
                )}
              </div>

              <span className="text-2xl shrink-0 mt-0.5">{icon}</span>

              <div>
                <p
                  className={`text-sm font-semibold ${
                    isSelected ? "text-indigo-900 dark:text-indigo-200" : "text-foreground"
                  }`}
                >
                  {title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
