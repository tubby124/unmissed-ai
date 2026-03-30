"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, HelpCircle, CalendarCheck, PhoneForwarded, Check, MessageSquare, PhoneCall } from "lucide-react";

type AgentModeId = 'voicemail_replacement' | 'lead_capture' | 'info_hub' | 'appointment_booking';

interface AgentModeOption {
  id: AgentModeId;
  label: string;
  tagline: string;
  description: string;
  quote: string;
  included: string[];
  icon: React.ReactNode;
}

const AGENT_MODE_OPTIONS: AgentModeOption[] = [
  {
    id: 'voicemail_replacement',
    icon: <Inbox className="w-5 h-5" />,
    label: 'Take a message and pass it along',
    tagline: '— simple & fast',
    description: 'Greet the caller, collect a brief message, and close. No triage, no back-and-forth.',
    quote: '"Hi — what\'s your name and what\'s the message? I\'ll make sure they get it."',
    included: ['Caller name + callback number', 'Brief message', 'Instant notification to you'],
  },
  {
    id: 'lead_capture',
    icon: <MessageSquare className="w-5 h-5" />,
    label: 'Capture caller details so I can follow up',
    tagline: '— most popular',
    description: 'Ask what the caller needs, collect their contact info, and route to callback.',
    quote: '"What brings you in today? And who should we follow up with?"',
    included: ['Caller name + number', 'Reason for calling', 'Triage + callback routing'],
  },
  {
    id: 'info_hub',
    icon: <HelpCircle className="w-5 h-5" />,
    label: 'Answer questions about my business',
    tagline: '— always-on FAQ',
    description: 'Answer common questions using your knowledge base before collecting contact info.',
    quote: '"Great question — we\'re open Mon–Fri 9–5, and here\'s what we offer..."',
    included: ['Hours, services, pricing answers', 'FAQ from your website', 'Contact info collected at end'],
  },
  {
    id: 'appointment_booking',
    icon: <CalendarCheck className="w-5 h-5" />,
    label: 'Help callers book appointments',
    tagline: '— drive bookings',
    description: 'Focus on scheduling. Collect preferred date/time and contact info.',
    quote: '"What day works for you? Let me check what\'s available."',
    included: ['Preferred date + time', 'Caller name + number', 'Calendar booking (if connected)'],
  },
];

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step3Capabilities({ data, onUpdate }: Props) {
  const currentMode: AgentModeId = data.agentMode ?? 'lead_capture';
  const forwardingEnabled = data.callForwardingEnabled ?? false;
  const ivrEnabled = data.ivrEnabled ?? false;
  // Pro plan or no plan selected yet (trial/pre-selection) — both get full access
  const isPro = data.selectedPlan === "pro" || data.selectedPlan === null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          What should {data.agentName || "your agent"} focus on?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the goal that fits your business. You can refine this later.
        </p>
      </div>

      {/* Mode cards */}
      <div className="space-y-3">
        {AGENT_MODE_OPTIONS.map((mode) => {
          const isSelected = currentMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              type="button"
              onClick={() => onUpdate({ agentMode: mode.id })}
              whileTap={{ scale: 0.98 }}
              className={[
                "w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer relative overflow-hidden",
                isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                  : "border-border bg-card hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Icon circle */}
                <div className={[
                  "mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}>
                  {mode.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {mode.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {mode.tagline}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {mode.description}
                  </p>

                  {/* Expanded details when selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="mt-2 text-xs italic text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg px-3 py-2">
                          {mode.quote}
                        </p>
                        <ul className="mt-2 space-y-0.5">
                          {mode.included.map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        {mode.id === 'appointment_booking' && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                            You&apos;ll connect your Google Calendar from your dashboard to activate booking.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Green glow indicator when selected */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <span className="relative flex size-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-3 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" />
                    </span>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* ── Add-ons ── */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Add-ons
        </p>

        {/* Call forwarding toggle */}
        <div
          className={[
            "rounded-xl border p-4 transition-all",
            forwardingEnabled && isPro
              ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-border bg-card",
            !isPro ? "opacity-60" : "",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <PhoneForwarded className="w-4 h-4 text-indigo-500" />
                  Call Forwarding
                </span>
                {!isPro && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    Pro plan
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Transfer urgent calls to your phone — available after activation.
              </p>
            </div>
            {/* Toggle */}
            <button
              type="button"
              disabled={!isPro}
              onClick={() =>
                isPro && onUpdate({ callForwardingEnabled: !forwardingEnabled })
              }
              className={[
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                forwardingEnabled && isPro
                  ? "bg-indigo-600"
                  : "bg-muted",
                !isPro ? "cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              aria-checked={forwardingEnabled && isPro}
              role="switch"
            >
              <span
                className={[
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
                  forwardingEnabled && isPro ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Forwarding number — slides in when toggled */}
          <AnimatePresence>
            {forwardingEnabled && isPro && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="emergencyPhone">Forwarding number</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    value={data.emergencyPhone}
                    onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
                    placeholder="(306) 555-1234"
                  />
                  <p className="text-xs text-muted-foreground">
                    Urgent calls will be transferred here.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* IVR phone menu toggle */}
        <div
          className={[
            "mt-3 rounded-xl border p-4 transition-all",
            ivrEnabled
              ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-border bg-card",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-indigo-500" />
                  Phone Menu (IVR)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Callers hear a short menu first: press 1 to leave a voicemail, press 2 to speak with your agent.
              </p>
            </div>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => onUpdate({ ivrEnabled: !ivrEnabled })}
              className={[
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer",
                ivrEnabled ? "bg-indigo-600" : "bg-muted",
              ].join(" ")}
              aria-checked={ivrEnabled}
              role="switch"
            >
              <span
                className={[
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
                  ivrEnabled ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Custom IVR prompt — slides in when toggled */}
          <AnimatePresence>
            {ivrEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="ivrPrompt">Menu message <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="ivrPrompt"
                    value={data.ivrPrompt}
                    onChange={(e) => onUpdate({ ivrPrompt: e.target.value })}
                    placeholder="Thanks for calling! Press 1 to leave a voicemail, or press 2 to speak with our assistant."
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the default message. You can edit this any time from your dashboard.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
