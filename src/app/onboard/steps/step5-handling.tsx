"use client";

import { useEffect } from "react";
import { MessageSquare, Filter, Info } from "lucide-react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const HANDLING_MODES = [
  {
    id: "message_only" as const,
    label: "Take a message",
    description: "Collect the caller's name, number, and reason for calling. Simple and fast.",
    Icon: MessageSquare,
    badge: null,
  },
  {
    id: "triage" as const,
    label: "Smart receptionist",
    description: "Ask industry-specific questions, qualify the caller, then route for callback.",
    Icon: Filter,
    badge: "Recommended",
  },
] as const;

const TRIAGE_NICHE_DESCRIPTIONS: Record<string, string> = {
  auto_glass: "Collect vehicle info, damage type, and insurance details",
  property_management: "Classify urgency (emergency/routine), collect unit number and issue",
  dental: "Collect patient name, concern type, and preferred appointment time",
  legal: "Collect case type, urgency, and contact details",
};

export default function Step5Handling({ data, onUpdate }: Props) {
  const isVoicemail = data.niche === "voicemail";
  const selectedMode = data.callHandlingMode || (isVoicemail ? "message_only" : "triage");

  useEffect(() => {
    if (isVoicemail && data.callHandlingMode !== "message_only") {
      onUpdate({ callHandlingMode: "message_only" });
    }
  }, [isVoicemail]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      {/* H2 heading */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">How should your agent handle calls?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how your agent manages each call.
        </p>
      </div>

      {/* Section A — SMS follow-up (moved to top) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">SMS follow-up</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically text callers after the call ends.
          </p>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/30 transition-all">
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">
              Send follow-up SMS to callers
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              A short confirmation text is sent after each call with your callback info.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data.callerAutoText}
            onClick={() => onUpdate({ callerAutoText: !data.callerAutoText })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              data.callerAutoText ? "bg-indigo-600" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
                data.callerAutoText ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>

        {data.callerAutoText && (
          <div className="rounded-lg bg-muted/30 border border-border p-3">
            <p className="text-xs text-muted-foreground italic">
              &quot;Thanks for calling {data.businessName || "[your business]"}! We&apos;ll get back to you shortly.&quot;
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Customize in Settings after activation.
            </p>
          </div>
        )}
      </div>

      {/* Section B — Call handling mode (2 cards) */}
      {!isVoicemail ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Call handling mode</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose how much your agent does on each call.
            </p>
          </div>

          <div className="space-y-3">
            {HANDLING_MODES.map((mode) => {
              const isSelected = selectedMode === mode.id;
              const nicheTriageDesc =
                mode.id === "triage" && data.niche
                  ? TRIAGE_NICHE_DESCRIPTIONS[data.niche]
                  : undefined;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdate({ callHandlingMode: mode.id })}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600/20"
                      : "border-border hover:border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${
                        isSelected ? "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <mode.Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isSelected ? "text-indigo-900 dark:text-indigo-200" : "text-foreground"
                          }`}
                        >
                          {mode.label}
                        </span>
                        {mode.badge && (
                          <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                            {mode.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{mode.description}</p>
                      {nicheTriageDesc && (
                        <p className="text-xs text-muted-foreground/70 mt-1">{nicheTriageDesc}</p>
                      )}
                    </div>
                    <div
                      className={`mt-1 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-indigo-600" : "border-border/80"
                      }`}
                    >
                      {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border p-4">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Voicemail agents always take a message — no other handling needed.
          </p>
        </div>
      )}

      {/* Section C — After-hours (yes/no emergency toggle) */}
      {!isVoicemail && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">After-hours calls</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              When someone calls outside your business hours, we&apos;ll take a message by default.
            </p>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border p-4 cursor-pointer hover:bg-muted/30 transition-all">
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground">
                Route emergencies to a different number
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Urgent after-hours calls will be offered a transfer to your emergency line.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.afterHoursBehavior === "route_emergency"}
              onClick={() =>
                onUpdate({
                  afterHoursBehavior:
                    data.afterHoursBehavior === "route_emergency" ? "standard" : "route_emergency",
                })
              }
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                data.afterHoursBehavior === "route_emergency" ? "bg-indigo-600" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
                  data.afterHoursBehavior === "route_emergency" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          {data.afterHoursBehavior === "route_emergency" && (
            <div className="space-y-2 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 ml-2">
              <Label htmlFor="emergencyPhone" className="text-sm font-medium text-foreground">Emergency routing number</Label>
              <Input
                id="emergencyPhone"
                type="tel"
                placeholder="(403) 555-9999"
                value={data.emergencyPhone}
                onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground/70">
                Callers will be offered a transfer to this number during after-hours.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
