"use client";

import { useEffect } from "react";
import { MessageSquare, Filter, Info } from "lucide-react";
import { OnboardingData, defaultAgentNames, Niche } from "@/types/onboarding";
import GenderVoicePicker from "@/components/onboard/GenderVoicePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step2Voice({ data, onUpdate }: Props) {
  const isVoicemail = data.niche === "voicemail";
  const selectedMode = data.callHandlingMode || (isVoicemail ? "message_only" : "triage");

  // Auto-select female voice as default if none chosen
  useEffect(() => {
    if (!data.voiceId) {
      onUpdate({ voiceId: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', voiceName: 'Jacqueline' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set voicemail to message_only
  useEffect(() => {
    if (isVoicemail && data.callHandlingMode !== "message_only") {
      onUpdate({ callHandlingMode: "message_only" });
    }
  }, [isVoicemail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill agent name from niche default if not yet set or still a default
  useEffect(() => {
    if (data.niche) {
      const nicheDefault = defaultAgentNames[data.niche as Niche];
      const isDefaultName = !data.agentName || Object.values(defaultAgentNames).includes(data.agentName);
      if (isDefaultName && nicheDefault && data.agentName !== nicheDefault) {
        onUpdate({ agentName: nicheDefault });
      }
    }
  }, [data.niche]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedName = data.niche ? defaultAgentNames[data.niche as Niche] : "Sam";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your agent&apos;s voice</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a voice that matches your brand. You can change it anytime.
        </p>
      </div>

      <GenderVoicePicker
        selectedVoiceId={data.voiceId}
        onSelect={(id, name) => onUpdate({ voiceId: id, voiceName: name })}
      />

      <div className="space-y-2 pt-2 border-t border-border">
        <Label htmlFor="agentName" className="flex items-center gap-1.5">
          Agent name
          <svg className="w-3.5 h-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Label>
        <Input
          id="agentName"
          placeholder={suggestedName}
          value={data.agentName}
          onChange={(e) => onUpdate({ agentName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground/70">
          Callers will hear: &quot;Hi, you&apos;ve reached {data.agentName || suggestedName} from [your business]&quot;
        </p>
      </div>

      {/* ── SMS follow-up ─────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">SMS follow-up</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically text callers after the call ends.
          </p>
        </div>

        <div
          onClick={() => onUpdate({ callerAutoText: !data.callerAutoText })}
          className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/30 transition-all"
        >
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
            onClick={(e) => { e.stopPropagation(); onUpdate({ callerAutoText: !data.callerAutoText }); }}
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
        </div>

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

      {/* ── Call handling mode ─────────────────────────────────────────────── */}
      {!isVoicemail ? (
        <div className="space-y-4 pt-4 border-t border-border">
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
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border p-4 mt-4">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Voicemail agents always take a message — no other handling needed.
          </p>
        </div>
      )}

      {/* ── After-hours ───────────────────────────────────────────────────── */}
      {!isVoicemail && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">After-hours calls</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              When someone calls outside your business hours, we&apos;ll take a message by default.
            </p>
          </div>

          <div
            onClick={() =>
              onUpdate({
                afterHoursBehavior:
                  data.afterHoursBehavior === "route_emergency" ? "standard" : "route_emergency",
              })
            }
            className="flex items-center justify-between rounded-xl border border-border p-4 cursor-pointer hover:bg-muted/30 transition-all"
          >
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
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({
                  afterHoursBehavior:
                    data.afterHoursBehavior === "route_emergency" ? "standard" : "route_emergency",
                });
              }}
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
          </div>

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

      {/* ── Voicemail menu (IVR) ──────────────────────────────────────────── */}
      {!isVoicemail && (
        <div className="space-y-3 pt-4 border-t border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">Voicemail menu</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Are your callers used to leaving you voicemail?
            </p>
          </div>

          <div
            onClick={() => onUpdate({ ivrEnabled: !data.ivrEnabled })}
            className="flex items-center justify-between rounded-xl border border-border p-4 cursor-pointer hover:bg-muted/30 transition-all"
          >
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground">
                Add a voicemail option before connecting to {data.agentName || "your agent"}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Callers hear: &quot;Press 1 to leave a voicemail, or stay on the line to speak with {data.agentName || "your agent"}.&quot;
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.ivrEnabled}
              onClick={(e) => { e.stopPropagation(); onUpdate({ ivrEnabled: !data.ivrEnabled }); }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                data.ivrEnabled ? "bg-indigo-600" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
                  data.ivrEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {data.ivrEnabled && (
            <div className="space-y-1.5 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 ml-2">
              <p className="text-xs font-medium text-foreground">Menu message</p>
              <textarea
                rows={3}
                value={data.ivrPrompt}
                onChange={(e) => onUpdate({ ivrPrompt: e.target.value })}
                className="w-full bg-muted/20 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500/40 transition-colors resize-y"
                placeholder={`Hi, you've reached ${data.businessName || 'your business'}. Press 1 to leave a voicemail, or stay on the line and ${data.agentName || 'our assistant'} will be with you.`}
              />
              <p className="text-xs text-muted-foreground/70">
                Leave blank for the default. Callers who press 1 leave a voicemail; callers who wait connect to {data.agentName || "your agent"}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
