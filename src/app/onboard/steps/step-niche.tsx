"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { OnboardingData, Niche } from "@/types/onboarding";
import { BaseStepProps } from "@/app/onboard/config/steps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volume2 } from "lucide-react";

// Niche components
import AutoGlassNiche from "./niches/auto-glass";
import PlumbingNiche from "./niches/plumbing";
import HvacNiche from "./niches/hvac";
import PropertyManagementNiche from "./niches/property-management";
import RestaurantNiche from "./niches/restaurant";
import DentalNiche from "./niches/dental";
import LegalNiche from "./niches/legal";
import SalonNiche from "./niches/salon";
import RealEstateNiche from "./niches/real-estate";
import OutboundIsaRealtorNiche from "./niches/outbound-isa-realtor";
import VoicemailNiche from "./niches/voicemail";

// Map niche key → component
const NICHE_COMPONENTS: Partial<Record<Niche, React.ComponentType<{
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}>>> = {
  auto_glass: AutoGlassNiche,
  plumbing: PlumbingNiche,
  hvac: HvacNiche,
  property_management: PropertyManagementNiche,
  restaurant: RestaurantNiche,
  dental: DentalNiche,
  legal: LegalNiche,
  salon: SalonNiche,
  real_estate: RealEstateNiche,
  outbound_isa_realtor: OutboundIsaRealtorNiche,
  voicemail: VoicemailNiche,
};

// Voice picker — two curated options (style-first, not gender-first)
const VOICE_STYLES = [
  { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline", style: "Warm & Friendly" },
  { id: "b0e6b5c1-0be8-47c5-8e21-e5e11c6f4ab0", name: "Mark", style: "Confident & Clear" },
] as const;

// Niche-adaptive placeholder text for caller reasons
const REASON_PLACEHOLDERS: Record<string, string[]> = {
  auto_glass: ["Windshield crack or chip repair", "Insurance claim question", "Mobile service availability"],
  hvac: ["AC not cooling / furnace not heating", "Annual maintenance booking", "Emergency after-hours repair"],
  plumbing: ["Leaking pipe or faucet", "Drain clog or backup", "Water heater issue"],
  dental: ["Book a cleaning or checkup", "Toothache or emergency", "Insurance coverage question"],
  property_management: ["Maintenance request", "Rent payment question", "Lease inquiry"],
  restaurant: ["Make a reservation", "Catering or large group", "Menu or allergy question"],
  real_estate: ["Looking to buy a home", "Want to list my property", "Market value question"],
  salon: ["Book a haircut or color", "Price inquiry", "Availability this week"],
  other: ["Get a quote or estimate", "Book an appointment", "Hours or location question"],
};

function getReasonPlaceholder(niche: string | null, index: number): string {
  const placeholders = REASON_PLACEHOLDERS[niche || "other"] ?? REASON_PLACEHOLDERS.other;
  return placeholders[index] ?? "";
}

export default function StepNiche({ data, onUpdate }: BaseStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intelligenceAbortRef = useRef<AbortController | null>(null);

  // Track whether voice is set — used to show picker only when needed
  const [voiceReady] = useState(() => !!data.voiceId);

  // Serialize services to stable string for dep comparison
  const servicesKey = JSON.stringify((data.nicheAnswers?.services as string[]) ?? []);

  // Play 3s voice preview on tap
  const playVoicePreview = useCallback((voiceId: string) => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(`/api/public/voice-preview/${voiceId}`);
      audio.play().catch(() => { /* silent fail — browser may block autoplay */ });
      audioRef.current = audio;
    } catch { /* silent */ }
  }, []);

  // Debounced TRIAGE_DEEP generation from caller reasons via infer-niche
  const debouncedTriageGenerate = useCallback((reasons: string[]) => {
    if (triageTimerRef.current) clearTimeout(triageTimerRef.current);
    const filled = reasons.filter((r) => r.trim());
    if (filled.length === 0) return;
    triageTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/onboard/infer-niche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: data.businessName || 'Business',
            callerReasons: filled,
            knownNiche: data.niche || 'other',
            urgencyWords: data.urgencyWords || '',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.customVariables?.TRIAGE_DEEP) {
            onUpdate({ nicheCustomVariables: { ...data.nicheCustomVariables, TRIAGE_DEEP: json.customVariables.TRIAGE_DEEP } });
          }
        }
      } catch { /* non-blocking */ }
    }, 1200);
  }, [data.businessName, data.niche, data.urgencyWords, data.nicheCustomVariables, onUpdate]);

  // D391 — Re-trigger intelligence generation after chip selection + voice + caller reasons.
  // Step 1 fired Haiku with only callerReasons (services were empty then).
  // Now that niche chips are filled, re-run with services so TRIAGE_DEEP is niche-specific.
  useEffect(() => {
    const services = (data.nicheAnswers?.services as string[]) ?? [];
    if (!services.length) return;
    if (!data.businessName || !data.niche) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (intelligenceAbortRef.current) intelligenceAbortRef.current.abort();
      const controller = new AbortController();
      intelligenceAbortRef.current = controller;

      const payload: Record<string, unknown> = {
        businessName: data.businessName,
        niche: data.niche,
        agentName: data.agentName || "",
        ownerName: data.ownerName || "",
        city: data.city || "",
        hours: data.businessHoursText || "",
        gbpDescription: data.gbpDescription || "",
        services,
        callerReasons: (data.callerReasons || []).filter((r: string) => r?.trim()),
        calendarEnabled: data.callHandlingMode === 'full_service' || data.agentMode === 'appointment_booking',
      };

      if (data.websiteScrapeResult) {
        const sr = data.websiteScrapeResult;
        payload.websiteFacts = sr.businessFacts?.filter((_: string, i: number) => sr.approvedFacts?.[i] !== false) ?? [];
        payload.websiteQa = sr.extraQa?.filter((_: { q: string; a: string }, i: number) => sr.approvedQa?.[i] !== false) ?? [];
      }

      fetch("/api/onboard/generate-agent-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!json?.seed) return;
          const seed = json.seed as Record<string, string>;
          const existingVars = data.nicheCustomVariables || {};
          const newVars: Record<string, string> = { ...existingVars };

          // Production niches have hand-crafted TRIAGE_DEEP — don't overwrite with Haiku generic output
          const NICHE_DEFAULTS_HAVE_TRIAGE = ['auto_glass', 'property_management', 'outbound_isa_realtor'];
          if (seed.TRIAGE_DEEP && !NICHE_DEFAULTS_HAVE_TRIAGE.includes(data.niche || 'other')) newVars.TRIAGE_DEEP = seed.TRIAGE_DEEP;
          if (seed.GREETING_LINE) newVars.GREETING_LINE = seed.GREETING_LINE;
          if (seed.URGENCY_KEYWORDS) newVars.URGENCY_KEYWORDS = seed.URGENCY_KEYWORDS;
          if (seed.FORBIDDEN_EXTRA) {
            newVars.FORBIDDEN_EXTRA = existingVars.FORBIDDEN_EXTRA
              ? existingVars.FORBIDDEN_EXTRA + "\n" + seed.FORBIDDEN_EXTRA
              : seed.FORBIDDEN_EXTRA;
          }

          onUpdate({ nicheCustomVariables: newVars, agentIntelligenceSeed: seed });
        })
        .catch(() => { /* non-blocking */ });
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesKey, data.businessName, data.niche]);

  // Prop bridge: niche files use onChange(key, value); step registry uses onUpdate(Partial<OnboardingData>)
  const onChange = (key: string, value: string | string[] | boolean) => {
    onUpdate({ nicheAnswers: { ...data.nicheAnswers, [key]: value } });
  };

  const niche = data.niche;
  const NicheComponent = niche ? NICHE_COMPONENTS[niche] : undefined;

  if (!niche) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No niche selected. Go back and pick your business type.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Niche-specific chip/form fields */}
      {NicheComponent ? (
        <NicheComponent data={data} onChange={onChange} />
      ) : (
        <div className="text-sm text-gray-500 py-4">
          Your niche ({niche}) doesn&apos;t have a setup form yet. You can continue — your agent will use smart defaults.
        </div>
      )}

      {/* Voice style picker */}
      <div className="space-y-2 pt-4 border-t border-border">
        <Label>Voice style</Label>
        <div className="grid grid-cols-2 gap-3">
          {VOICE_STYLES.map((v) => {
            const isSelected = data.voiceId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  onUpdate({ voiceId: v.id, voiceName: v.name });
                  playVoicePreview(v.id);
                }}
                className={[
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer min-h-[88px]",
                  isSelected
                    ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                    : "border-border bg-card hover:border-indigo-300",
                ].join(" ")}
              >
                <span className="text-sm font-bold text-foreground">{v.style}</span>
                <span className="text-xs text-muted-foreground">{v.name}</span>
                <Volume2 className="w-3.5 h-3.5 text-muted-foreground absolute top-2 right-2" />
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tap to preview. More voices available in your dashboard.
        </p>
      </div>

      {/* Caller reasons */}
      <div className="space-y-2">
        <div>
          <Label>Top reasons people call</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            These help your agent sound like it knows your business.
          </p>
        </div>
        {[0, 1, 2].map((i) => (
          <Input
            key={i}
            value={data.callerReasons?.[i] ?? ""}
            onChange={(e) => {
              const reasons = [...(data.callerReasons || ["", "", ""])];
              reasons[i] = e.target.value;
              onUpdate({ callerReasons: reasons });
              debouncedTriageGenerate(reasons);
            }}
            onBlur={() => {
              // Re-fire full intelligence generation when user finishes a reason
              const filled = (data.callerReasons || []).filter((r: string) => r?.trim());
              if (filled.length > 0 && data.businessName && data.niche) {
                if (intelligenceAbortRef.current) intelligenceAbortRef.current.abort();
                const controller = new AbortController();
                intelligenceAbortRef.current = controller;

                const payload: Record<string, unknown> = {
                  businessName: data.businessName,
                  niche: data.niche,
                  agentName: data.agentName || "",
                  ownerName: data.ownerName || "",
                  city: data.city || "",
                  hours: data.businessHoursText || "",
                  gbpDescription: data.gbpDescription || "",
                  services: (data.nicheAnswers?.services as string[]) ?? [],
                  callerReasons: filled,
                  calendarEnabled: data.callHandlingMode === 'full_service' || data.agentMode === 'appointment_booking',
                };

                if (data.websiteScrapeResult) {
                  const sr = data.websiteScrapeResult;
                  payload.websiteFacts = sr.businessFacts?.filter((_: string, idx: number) => sr.approvedFacts?.[idx] !== false) ?? [];
                  payload.websiteQa = sr.extraQa?.filter((_: { q: string; a: string }, idx: number) => sr.approvedQa?.[idx] !== false) ?? [];
                }

                fetch("/api/onboard/generate-agent-intelligence", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                  signal: controller.signal,
                })
                  .then((res) => (res.ok ? res.json() : null))
                  .then((json) => {
                    if (!json?.seed) return;
                    const seed = json.seed as Record<string, string>;
                    const existingVars = data.nicheCustomVariables || {};
                    const newVars: Record<string, string> = { ...existingVars };
                    const NICHE_DEFAULTS_HAVE_TRIAGE = ['auto_glass', 'property_management', 'outbound_isa_realtor'];
                    if (seed.TRIAGE_DEEP && !NICHE_DEFAULTS_HAVE_TRIAGE.includes(data.niche || 'other')) newVars.TRIAGE_DEEP = seed.TRIAGE_DEEP;
                    if (seed.GREETING_LINE) newVars.GREETING_LINE = seed.GREETING_LINE;
                    if (seed.URGENCY_KEYWORDS) newVars.URGENCY_KEYWORDS = seed.URGENCY_KEYWORDS;
                    if (seed.FORBIDDEN_EXTRA) {
                      newVars.FORBIDDEN_EXTRA = existingVars.FORBIDDEN_EXTRA
                        ? existingVars.FORBIDDEN_EXTRA + "\n" + seed.FORBIDDEN_EXTRA
                        : seed.FORBIDDEN_EXTRA;
                    }
                    onUpdate({ nicheCustomVariables: newVars, agentIntelligenceSeed: seed });
                  })
                  .catch(() => { /* non-blocking */ });
              }
            }}
            placeholder={getReasonPlaceholder(data.niche, i)}
            className="text-sm"
          />
        ))}
        <p className="text-xs text-muted-foreground italic">
          <span className="text-muted-foreground/70">Optional</span> — if skipped, your agent uses smart defaults for your industry.
        </p>
      </div>
    </div>
  );
}
