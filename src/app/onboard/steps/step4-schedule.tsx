"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Clock, Sun, PenLine } from "lucide-react";

type ScheduleMode = "24_7" | "business_hours" | "custom";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const SCHEDULE_OPTIONS: { mode: ScheduleMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    mode: "24_7",
    label: "24/7 available",
    description: "Your agent answers every call, day or night",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    mode: "business_hours",
    label: "Business hours",
    description: "Answers during your set hours, takes messages after",
    icon: <Sun className="w-5 h-5" />,
  },
  {
    mode: "custom",
    label: "Custom schedule",
    description: "Describe your hours in your own words",
    icon: <PenLine className="w-5 h-5" />,
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
        {SCHEDULE_OPTIONS.map(({ mode, label, description, icon }) => {
          const isSelected = currentMode === mode;
          return (
            <motion.button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              whileTap={{ scale: 0.98 }}
              className={[
                "w-full text-left flex items-start gap-3 rounded-xl border-2 p-4 transition-all cursor-pointer relative",
                isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                  : "border-border hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm",
              ].join(" ")}
            >
              {/* Icon */}
              <div className={[
                "mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                isSelected ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
              ].join(" ")}>
                {icon}
              </div>

              <div>
                <p className={`text-sm font-semibold ${
                  isSelected ? "text-indigo-900 dark:text-indigo-200" : "text-foreground"
                }`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>

              {/* Glow indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" />
                  </span>
                </div>
              )}
            </motion.button>
          );
        })}
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
