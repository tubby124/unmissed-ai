"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";

type ScheduleMode = "24_7" | "business_hours" | "custom";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const SCHEDULE_OPTIONS: { mode: ScheduleMode; label: string; description: string; icon: string }[] = [
  {
    mode: "24_7",
    label: "24/7 available",
    description: "Your agent answers every call, day or night",
    icon: "🌙",
  },
  {
    mode: "business_hours",
    label: "Business hours",
    description: "Answers during your set hours, takes messages after",
    icon: "🕘",
  },
  {
    mode: "custom",
    label: "Custom schedule",
    description: "Describe your hours in your own words",
    icon: "✏️",
  },
];

function getCurrentMode(data: OnboardingData): ScheduleMode {
  if (data.scheduleMode) return data.scheduleMode;
  if (data.businessHoursText === "24/7, always available") return "24_7";
  if (data.businessHoursText) return "business_hours";
  return "24_7";
}

export default function Step4Schedule({ data, onUpdate }: Props) {
  const currentMode = getCurrentMode(data);

  const handleModeChange = (mode: ScheduleMode) => {
    if (mode === "24_7") {
      onUpdate({ scheduleMode: mode, businessHoursText: "24/7, always available" });
    } else if (mode === "business_hours") {
      onUpdate({
        scheduleMode: mode,
        businessHoursText: data.businessHoursText && data.businessHoursText !== "24/7, always available"
          ? data.businessHoursText
          : "Mon–Fri 9am–5pm",
      });
    } else {
      onUpdate({
        scheduleMode: mode,
        businessHoursText: data.businessHoursText && data.businessHoursText !== "24/7, always available"
          ? data.businessHoursText
          : "",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">When do you want calls answered?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your agent tells callers when you&apos;re available.
        </p>
      </div>

      <div className="space-y-2">
        {SCHEDULE_OPTIONS.map(({ mode, label, description, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleModeChange(mode)}
            className={`w-full text-left flex items-start gap-3 rounded-xl border-2 p-4 transition-all cursor-pointer ${
              currentMode === mode
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-border hover:border-indigo-300 dark:hover:border-indigo-700"
            }`}
          >
            {/* Radio indicator */}
            <div
              className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                currentMode === mode ? "border-indigo-600" : "border-muted-foreground/40"
              }`}
            >
              {currentMode === mode && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-indigo-600"
                />
              )}
            </div>

            <span className="text-lg shrink-0 mt-0.5">{icon}</span>

            <div>
              <p
                className={`text-sm font-semibold ${
                  currentMode === mode ? "text-indigo-900 dark:text-indigo-200" : "text-foreground"
                }`}
              >
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Hours input — slides in for business_hours or custom */}
      <AnimatePresence>
        {(currentMode === "business_hours" || currentMode === "custom") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <label htmlFor="businessHoursText" className="text-sm font-medium text-foreground">
              {currentMode === "business_hours" ? "Your hours" : "Describe your schedule"}
            </label>
            <Input
              id="businessHoursText"
              value={
                data.businessHoursText && data.businessHoursText !== "24/7, always available"
                  ? data.businessHoursText
                  : ""
              }
              onChange={(e) => onUpdate({ businessHoursText: e.target.value })}
              placeholder={
                currentMode === "business_hours"
                  ? "Mon–Fri 9am–5pm, Sat 10am–2pm"
                  : "e.g. Mon–Thu 8am–6pm, Fri 8am–4pm, weekends by appointment"
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
