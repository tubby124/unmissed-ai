"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { OnboardingData, Niche } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, HelpCircle, CalendarCheck, PhoneForwarded, Check, MessageSquare, PhoneCall, Plus, X, Loader2 } from "lucide-react";

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

// D125 — Niche-aware service suggestions (checked by default)
const NICHE_SERVICE_SUGGESTIONS: Partial<Record<Niche, string[]>> = {
  plumbing: ['Drain cleaning', 'Water heater repair', 'Pipe repair', 'Leak detection', 'Toilet repair', 'Faucet installation', 'Emergency plumbing'],
  hvac: ['AC repair', 'Furnace repair', 'HVAC installation', 'Duct cleaning', 'Thermostat installation', 'Seasonal tune-up', 'Emergency HVAC'],
  auto_glass: ['Windshield replacement', 'Chip repair', 'Side window replacement', 'Rear window replacement', 'Mobile service', 'Insurance claims'],
  dental: ['Cleaning & exam', 'Teeth whitening', 'Fillings', 'Crowns', 'Root canal', 'Extractions', 'Invisalign', 'Dental implants'],
  legal: ['Free consultation', 'Real estate law', 'Family law', 'Personal injury', 'Estate planning', 'Business law', 'Immigration'],
  salon: ['Haircut', 'Color & highlights', 'Blowout', 'Keratin treatment', 'Manicure', 'Pedicure', 'Waxing', 'Eyebrow shaping'],
  real_estate: ['Buyer consultation', 'Seller consultation', 'Home valuation', 'Property tours', 'Investment properties', 'First-time buyer'],
  property_management: ['Tenant screening', 'Rent collection', 'Maintenance coordination', 'Lease renewals', 'Property inspections', 'Eviction assistance'],
  restaurant: ['Dine-in reservations', 'Takeout orders', 'Catering inquiries', 'Private events', 'Hours & location info'],
  print_shop: ['Business cards', 'Flyers & brochures', 'Banners & signs', 'Custom apparel', 'Rush printing', 'Design services'],
};

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

  // D125: initialise selectedServices from existing data (or niche suggestions all-checked)
  const nicheSuggestions = data.niche ? (NICHE_SERVICE_SUGGESTIONS[data.niche] ?? []) : [];
  const showServiceSection = nicheSuggestions.length > 0 && currentMode !== 'voicemail_replacement';

  // Ensure selectedServices has been initialised for this niche
  const selectedServices: string[] = data.selectedServices ?? nicheSuggestions;

  const toggleService = useCallback((name: string) => {
    const current = data.selectedServices ?? nicheSuggestions;
    const next = current.includes(name)
      ? current.filter((s) => s !== name)
      : [...current, name];
    onUpdate({ selectedServices: next });
  }, [data.selectedServices, nicheSuggestions, onUpdate]);

  // D125: custom service add
  const [customServiceInput, setCustomServiceInput] = useState('');
  const addCustomService = useCallback(() => {
    const trimmed = customServiceInput.trim();
    if (!trimmed) return;
    const current = data.selectedServices ?? nicheSuggestions;
    if (!current.includes(trimmed)) {
      onUpdate({ selectedServices: [...current, trimmed] });
    }
    setCustomServiceInput('');
  }, [customServiceInput, data.selectedServices, nicheSuggestions, onUpdate]);

  // D126: freeform service paste + parse
  const [freeformText, setFreeformText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const parseServices = useCallback(async () => {
    const text = freeformText.trim();
    if (!text) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/onboard/parse-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const json = await res.json() as { services: { name: string; description?: string; price?: string; duration_mins?: number | null }[] };
      const parsed = json.services ?? [];
      if (parsed.length === 0) return;

      // Add parsed service names to selectedServices (dedup)
      const current = data.selectedServices ?? nicheSuggestions;
      const newNames = parsed.map((s) => s.name).filter((n) => !current.includes(n));
      onUpdate({
        selectedServices: [...current, ...newNames],
        parsedServiceDrafts: [...(data.parsedServiceDrafts ?? []), ...parsed],
      });
      setFreeformText('');
    } catch {
      // silently ignore — user can still add services manually
    } finally {
      setIsParsing(false);
    }
  }, [freeformText, data.selectedServices, data.parsedServiceDrafts, nicheSuggestions, onUpdate]);

  // D127: FAQ text
  const callerFaqText = data.callerFaqText ?? ''

  // D247: Caller reasons — drives custom TRIAGE_DEEP generation
  const callerReasons: string[] = data.callerReasons ?? ['', '', '']
  const [isGeneratingTriage, setIsGeneratingTriage] = useState(false)
  const [triageGenerated, setTriageGenerated] = useState(false)

  const updateCallerReason = useCallback((index: number, value: string) => {
    const next = [...callerReasons]
    next[index] = value
    onUpdate({ callerReasons: next })
  }, [callerReasons, onUpdate])

  const generateTriage = useCallback(async () => {
    const filled = (data.callerReasons ?? []).map(r => r.trim()).filter(r => r.length > 0)
    if (filled.length === 0 || !data.businessName || !data.niche) return
    setIsGeneratingTriage(true)
    try {
      const res = await fetch('/api/onboard/infer-niche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          knownNiche: data.niche,
          callerReasons: filled,
          urgencyWords: data.urgencyWords?.trim() || undefined,
        }),
      })
      if (!res.ok) return
      const json = await res.json() as { niche?: string; customVariables?: Record<string, string> }
      const triage = json.customVariables?.TRIAGE_DEEP
      if (triage) {
        onUpdate({ nicheCustomVariables: { ...(data.nicheCustomVariables ?? {}), TRIAGE_DEEP: triage } })
        setTriageGenerated(true)
      }
    } catch { /* silently ignore */ } finally {
      setIsGeneratingTriage(false)
    }
  }, [data.callerReasons, data.businessName, data.niche, data.nicheCustomVariables, onUpdate]);

  // Debounced auto-trigger: fire generateTriage 800ms after callerReasons settles.
  // This ensures TRIAGE_DEEP is generated even if the user clicks Continue without
  // blurring the last input field first.
  const triageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const filled = (data.callerReasons ?? []).map(r => r.trim()).filter(r => r.length > 0)
    if (filled.length === 0) return
    if (triageTimerRef.current) clearTimeout(triageTimerRef.current)
    triageTimerRef.current = setTimeout(() => {
      void generateTriage()
    }, 800)
    return () => {
      if (triageTimerRef.current) clearTimeout(triageTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.callerReasons, data.urgencyWords])

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

      {/* ── D125/D126: Services your agent will know about ── */}
      <AnimatePresence>
        {showServiceSection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-border space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Services you offer
                </p>
                <p className="text-xs text-muted-foreground">
                  These are the services your agent will know about. Uncheck any that don&apos;t apply, and add your own.
                </p>
              </div>

              {/* Niche suggestion checkboxes */}
              <div className="flex flex-wrap gap-2">
                {nicheSuggestions.map((name) => {
                  const checked = selectedServices.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleService(name)}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                        checked
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                          : "border-border bg-card text-muted-foreground hover:border-indigo-300",
                      ].join(" ")}
                    >
                      {checked && <Check className="w-3 h-3 text-indigo-500 shrink-0" />}
                      {name}
                    </button>
                  );
                })}

                {/* Custom services added by user (not in niche suggestions) */}
                {selectedServices
                  .filter((s) => !nicheSuggestions.includes(s))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleService(name)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-xs font-medium transition-all cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-indigo-500 shrink-0" />
                      {name}
                      <X className="w-3 h-3 text-indigo-400 shrink-0" />
                    </button>
                  ))
                }
              </div>

              {/* Manual add */}
              <div className="flex items-center gap-2">
                <Input
                  value={customServiceInput}
                  onChange={(e) => setCustomServiceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomService(); } }}
                  placeholder="Add a service…"
                  className="h-8 text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={addCustomService}
                  disabled={!customServiceInput.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 h-8 text-xs font-medium text-muted-foreground hover:border-indigo-300 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {/* D126: Freeform paste */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  Or paste a description of what you offer — we&apos;ll do the work.
                </p>
                <Textarea
                  value={freeformText}
                  onChange={(e) => setFreeformText(e.target.value)}
                  onBlur={parseServices}
                  placeholder={`e.g. "We do oil changes from $65, brake repairs, tire rotations, and transmission work. Emergency towing available 24/7."`}
                  rows={2}
                  className="text-xs resize-none"
                />
                {isParsing && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Parsing your services…
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── D127: FAQ capture ── */}
      <AnimatePresence>
        {currentMode !== 'voicemail_replacement' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-border space-y-1.5">
              <Label htmlFor="callerFaqText" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What questions do callers ask most?
              </Label>
              <Textarea
                id="callerFaqText"
                value={callerFaqText}
                onChange={(e) => onUpdate({ callerFaqText: e.target.value })}
                placeholder={`e.g. "Do you offer free estimates? How long does a windshield replacement take? Do you accept insurance?"`}
                rows={2}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Your agent will know the answers — and be ready the moment it goes live.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── D247: Caller intent capture — drives custom TRIAGE_DEEP ── */}
      <AnimatePresence>
        {currentMode !== 'voicemail_replacement' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-border space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Why do people call you?
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The top reasons callers reach out — your agent will route each one properly.
                </p>
              </div>
              {[0, 1, 2].map((i) => (
                <Input
                  key={i}
                  value={callerReasons[i] ?? ''}
                  onChange={(e) => updateCallerReason(i, e.target.value)}
                  onBlur={generateTriage}
                  placeholder={
                    i === 0 ? 'e.g. "Need a windshield replaced"' :
                    i === 1 ? 'e.g. "Rock chip — want a price"' :
                               'e.g. "Insurance claim question"'
                  }
                  className="text-sm"
                />
              ))}
              {isGeneratingTriage && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Setting up your agent&apos;s call routing…
                </p>
              )}
              {triageGenerated && !isGeneratingTriage && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3" />
                  Call routing ready — your agent knows how to handle each caller type.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── D258/D259: Urgency signals + price range ── */}
      <AnimatePresence>
        {currentMode !== 'voicemail_replacement' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-border space-y-4">
              {/* Urgency words */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  What do callers say when it&apos;s urgent?
                </Label>
                <Input
                  value={data.urgencyWords ?? ''}
                  onChange={(e) => onUpdate({ urgencyWords: e.target.value })}
                  placeholder={`e.g. "not working, same day, emergency, can't wait"`}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Your agent will spot these phrases and route the call immediately — no back-and-forth.
                </p>
              </div>

              {/* Price range */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Typical price range <span className="font-normal normal-case">(optional)</span>
                </Label>
                <Input
                  value={data.priceRange ?? ''}
                  onChange={(e) => onUpdate({ priceRange: e.target.value })}
                  placeholder={`e.g. "$150–$400 for most repairs"`}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Gives callers a ballpark before they hang up — your agent stops saying &ldquo;I&apos;m not sure, someone will call you.&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
