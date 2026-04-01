"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Niche, OnboardingData, defaultAgentNames, nicheLabels, nicheEmojis } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlacesAutocomplete from "@/components/onboard/PlacesAutocomplete";
import { trackEvent } from "@/lib/analytics";
import { NICHE_PRODUCTION_READY } from "@/lib/niche-config";
import { agentNameIsAutoSet } from "@/lib/intake-transform";
import { Volume2 } from "lucide-react";

const FEMALE_DEFAULT = { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline" };

// Phase 7: Voice style picker — two curated options (style-first, not gender-first)
const VOICE_STYLES = [
  { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline", style: "Warm & Friendly" },
  { id: "b0e6b5c1-0be8-47c5-8e21-e5e11c6f4ab0", name: "Mark", style: "Confident & Clear" },
] as const;

const PLACES_TYPE_TO_NICHE: Record<string, Niche> = {
  auto_glass_shop: "auto_glass", car_repair: "auto_glass", car_wash: "auto_glass",
  hvac_contractor: "hvac", electrician: "hvac",
  plumber: "plumbing",
  dentist: "dental", dental_clinic: "dental",
  lawyer: "legal", legal_services: "legal",
  hair_care: "salon", beauty_salon: "salon", nail_salon: "salon", spa: "salon",
  real_estate_agency: "real_estate", real_estate: "real_estate",
  property_management_company: "property_management",
  restaurant: "restaurant", food: "restaurant", cafe: "restaurant", meal_takeaway: "restaurant",
  print_shop: "print_shop",
};

function detectNicheFromTypes(types: string[]): Niche | null {
  for (const t of types) {
    if (PLACES_TYPE_TO_NICHE[t]) return PLACES_TYPE_TO_NICHE[t];
  }
  return null;
}

function defaultAgentModeForNiche(niche: Niche): NonNullable<import('@/types/onboarding').OnboardingData['agentMode']> {
  if (niche === 'restaurant' || niche === 'print_shop') return 'info_hub'
  if (niche === 'voicemail') return 'voicemail_replacement'
  return 'lead_capture'
}

const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

/**
 * Condense a GBP hours array like ["Monday: 8:00 AM – 6:00 PM", "Tuesday: 8:00 AM – 6:00 PM", ...]
 * into a compact string like "Mon–Fri 8am–6pm, Sat 9am–2pm".
 * Falls back to a simple comma-joined string if parsing fails.
 */
function condenseHours(hours: string[]): string {
  // Parse each entry into { day, range }
  const parsed: { day: string; range: string }[] = [];
  for (const h of hours) {
    const colonIdx = h.indexOf(":");
    if (colonIdx === -1) return hours.join(", ");
    const day = h.slice(0, colonIdx).trim();
    const range = h.slice(colonIdx + 1).trim();
    parsed.push({ day, range });
  }
  if (parsed.length === 0) return hours.join(", ");

  // Group consecutive days that share the same range
  const groups: { days: string[]; range: string }[] = [];
  for (const { day, range } of parsed) {
    const last = groups[groups.length - 1];
    if (last && last.range === range) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], range });
    }
  }

  // Format a time range like "8:00 AM – 6:00 PM" → "8am–6pm"
  function fmtTime(t: string): string {
    const m = t.trim().match(/^(\d+)(?::(\d+))?\s*(AM|PM)$/i);
    if (!m) return t.trim();
    let h = parseInt(m[1]);
    const min = m[2] && m[2] !== "00" ? `:${m[2]}` : "";
    const period = m[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${h}${min}${period === "PM" || h >= 12 ? "pm" : "am"}`;
  }
  function fmtRange(r: string): string {
    // Split on em-dash or hyphen separator
    const parts = r.split(/\s*[–\-]\s*/);
    if (parts.length === 2) {
      return `${fmtTime(parts[0])}–${fmtTime(parts[1])}`;
    }
    return r.trim();
  }

  const segments = groups.map(({ days, range }) => {
    const abbr = days.map((d) => DAY_ABBR[d] || d);
    const dayStr = abbr.length === 1 ? abbr[0] : `${abbr[0]}–${abbr[abbr.length - 1]}`;
    return `${dayStr} ${fmtRange(range)}`;
  });

  return segments.join(", ");
}

function parseAddressParts(address: string): { city: string; state: string; streetAddress: string } {
  const parts = address.split(",").map((s) => s.trim());
  const provincePattern = /^([A-Z]{2})\b/;
  const provinceIdx = parts.findIndex((p) => provincePattern.test(p));
  if (provinceIdx >= 1) {
    const state = parts[provinceIdx].match(provincePattern)?.[1] || "";
    const city = parts[provinceIdx - 1] || "";
    const streetAddress = parts.slice(0, provinceIdx - 1).join(", ");
    return { city, state, streetAddress };
  }
  return { city: parts[1] || "", state: (parts[2] || "").split(" ")[0] || "", streetAddress: parts[0] || "" };
}

interface PendingPlace {
  name: string | null;
  address: string | null;
  phone: string | null;
  hours: string[] | null;
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  placeId: string;
  description: string | null;
  website: string | null;
}

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onGbpUsed?: () => void;
}

// Phase 7: Niche-adaptive placeholder text for caller reasons
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

export default function Step1GBP({ data, onUpdate, onGbpUsed }: Props) {
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [placesKey, setPlacesKey] = useState(0);
  const [gbpConfirmed, setGbpConfirmed] = useState(!!(data.placeId || data.businessName));
  const [showManual, setShowManual] = useState(!!(data.businessName && !data.placeId));
  const [nichePickerDismissed, setNichePickerDismissed] = useState(false);
  const [inferredNiche, setInferredNiche] = useState<Niche | null>(null);
  const [inferring, setInferring] = useState(false);
  const [inferDismissed, setInferDismissed] = useState(false);
  const inferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inferAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intelligenceAbortRef = useRef<AbortController | null>(null);

  // Phase 7: Play 3s voice preview on tap
  const playVoicePreview = useCallback((voiceId: string) => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(`/api/public/voice-preview/${voiceId}`);
      audio.play().catch(() => { /* silent fail — browser may block autoplay */ });
      audioRef.current = audio;
    } catch { /* silent */ }
  }, []);

  // Phase 7: Debounced TRIAGE_DEEP generation from caller reasons
  // Reuses the existing /api/onboard/infer-niche endpoint (D247 path)
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

  // Phase 7: Fire agent intelligence generation with ALL available context.
  // Runs in background — by the time user reaches Launch step, it's done.
  // This is the "smart agent from day 1" feature: Haiku generates TRIAGE_DEEP,
  // greeting, urgency keywords, and NEVER list from GBP + niche + services + reasons.
  const fireIntelligenceGeneration = useCallback((currentData: OnboardingData) => {
    if (intelligenceAbortRef.current) intelligenceAbortRef.current.abort();
    const controller = new AbortController();
    intelligenceAbortRef.current = controller;

    // Collect all available context
    const payload: Record<string, unknown> = {
      businessName: currentData.businessName || '',
      niche: currentData.niche || 'other',
      agentName: currentData.agentName || '',
      ownerName: currentData.ownerName || '',
      city: currentData.city || '',
      hours: currentData.businessHoursText || '',
      gbpDescription: currentData.gbpDescription || '',
      services: currentData.selectedServices || [],
      callerReasons: (currentData.callerReasons || []).filter((r: string) => r?.trim()),
      selectedPlan: currentData.selectedPlan || '',
    };

    // Include website scrape facts if available
    if (currentData.websiteScrapeResult) {
      const sr = currentData.websiteScrapeResult;
      payload.websiteFacts = sr.businessFacts?.filter((_: string, i: number) => sr.approvedFacts?.[i] !== false) || [];
      payload.websiteQa = sr.extraQa?.filter((_: { q: string; a: string }, i: number) => sr.approvedQa?.[i] !== false) || [];
    }

    fetch('/api/onboard/generate-agent-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json?.seed) return;
        const seed = json.seed as Record<string, string>;
        const updates: Partial<OnboardingData> = {};

        // Merge AI-generated fields into nicheCustomVariables
        const existingVars = currentData.nicheCustomVariables || {};
        const newVars: Record<string, string> = { ...existingVars };

        if (seed.TRIAGE_DEEP) newVars.TRIAGE_DEEP = seed.TRIAGE_DEEP;
        if (seed.GREETING_LINE) newVars.GREETING_LINE = seed.GREETING_LINE;
        if (seed.URGENCY_KEYWORDS) newVars.URGENCY_KEYWORDS = seed.URGENCY_KEYWORDS;
        if (seed.FORBIDDEN_EXTRA) {
          // Append to existing rather than replace
          newVars.FORBIDDEN_EXTRA = existingVars.FORBIDDEN_EXTRA
            ? existingVars.FORBIDDEN_EXTRA + '\n' + seed.FORBIDDEN_EXTRA
            : seed.FORBIDDEN_EXTRA;
        }

        updates.nicheCustomVariables = newVars;

        // Store the seed for display on the Launch step
        updates.agentIntelligenceSeed = seed;

        onUpdate(updates);
      })
      .catch(() => { /* non-blocking — niche defaults will handle it */ });
  }, [onUpdate]);

  // Apply a niche selection — shared by AI suggestion button and grid buttons
  function applyNiche(n: Niche) {
    const updates: Partial<OnboardingData> = { niche: n };
    if (agentNameIsAutoSet(data.agentName, data.niche)) {
      updates.agentName = defaultAgentNames[n];
    }
    if (data.agentMode === undefined) {
      updates.agentMode = defaultAgentModeForNiche(n);
    }
    onUpdate(updates);
    setNichePickerDismissed(true);
  }

  // AI niche inference — fires when business name changes and niche is still 'other'
  useEffect(() => {
    const name = data.businessName?.trim();
    if (!name || name.length < 3 || data.niche !== 'other') {
      setInferredNiche(null);
      return;
    }
    setInferredNiche(null);
    setInferDismissed(false);
    if (inferTimeoutRef.current) clearTimeout(inferTimeoutRef.current);
    if (inferAbortRef.current) inferAbortRef.current.abort();

    inferTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      inferAbortRef.current = controller;
      setInferring(true);
      try {
        const res = await fetch('/api/onboard/infer-niche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName: name }),
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.niche && json.niche !== 'other') {
            setInferredNiche(json.niche as Niche);
          } else if (json.customVariables) {
            // Store AI-generated variables for 'other' businesses — wired into prompt at build time
            onUpdate({ nicheCustomVariables: json.customVariables });
          }
        }
      } catch {
        // silent — AI inference is best-effort
      } finally {
        setInferring(false);
      }
    }, 800);

    return () => {
      if (inferTimeoutRef.current) clearTimeout(inferTimeoutRef.current);
      if (inferAbortRef.current) inferAbortRef.current.abort();
    };
  }, [data.businessName, data.niche]);

  const handleConfirm = () => {
    if (!pendingPlace) return;
    const updates: Partial<OnboardingData> = {};
    if (pendingPlace.name) updates.businessName = pendingPlace.name;
    if (pendingPlace.address) {
      const { city, state, streetAddress } = parseAddressParts(pendingPlace.address);
      if (city) updates.city = city;
      if (state) updates.state = state;
      if (streetAddress) updates.streetAddress = streetAddress;
    }
    if (pendingPlace.phone) updates.callbackPhone = pendingPlace.phone;
    if (pendingPlace.hours?.length) updates.businessHoursText = condenseHours(pendingPlace.hours);
    if (pendingPlace.photoUrl) updates.placesPhotoUrl = pendingPlace.photoUrl;
    if (pendingPlace.description) updates.gbpDescription = pendingPlace.description;
    if (pendingPlace.website && !data.websiteUrl) updates.websiteUrl = pendingPlace.website;
    if (pendingPlace.rating) updates.placesRating = pendingPlace.rating;
    if (pendingPlace.reviewCount) updates.placesReviewCount = pendingPlace.reviewCount;
    updates.placeId = pendingPlace.placeId;

    let detectedNiche: Niche = "other";
    if (pendingPlace.types.length > 0) {
      const detected = detectNicheFromTypes(pendingPlace.types);
      if (detected && NICHE_PRODUCTION_READY[detected]) detectedNiche = detected;
    }
    updates.niche = detectedNiche;

    // Set agentMode smart default if not yet explicitly set by user (step 3 not yet visited).
    if (data.agentMode === undefined) {
      updates.agentMode = defaultAgentModeForNiche(detectedNiche)
    }

    // Set agent name from niche only if the current name is empty or was auto-set by the system.
    // Preserves explicitly user-typed names even if they happen to match another niche's default.
    if (agentNameIsAutoSet(data.agentName, data.niche)) {
      updates.agentName = defaultAgentNames[detectedNiche];
    }

    // Set default voice
    if (!data.voiceId) { updates.voiceId = FEMALE_DEFAULT.id; updates.voiceName = FEMALE_DEFAULT.name; }

    onUpdate(updates);
    onGbpUsed?.();
    trackEvent("onboard_gbp_used", { niche: String(detectedNiche) });
    setGbpConfirmed(true);
    setPendingPlace(null);
    if (detectedNiche === 'other') setNichePickerDismissed(false);

    // Fire agent intelligence generation with all the GBP data we just collected
    fireIntelligenceGeneration({ ...data, ...updates } as OnboardingData);
  };

  const handleManual = () => {
    setShowManual(true);
    const updates: Partial<OnboardingData> = {};
    if (!data.niche) updates.niche = "other";
    if (!data.voiceId) { updates.voiceId = FEMALE_DEFAULT.id; updates.voiceName = FEMALE_DEFAULT.name; }
    if (!data.agentName) updates.agentName = defaultAgentNames["other"];
    onUpdate(updates);
    trackEvent("onboard_manual_fallback", { niche: data.niche || "none" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Find your business on Google</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search your Google listing and we&apos;ll fill everything in automatically.
        </p>
      </div>

      {/* GBP search — hidden after confirmation */}
      <AnimatePresence>
        {!gbpConfirmed && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <PlacesAutocomplete
              key={placesKey}
              initialValue={data.businessName}
              onSelect={(result) =>
                setPendingPlace({
                  name: result.name, address: result.address, phone: result.phone,
                  hours: result.hours, photoUrl: result.photoUrl, rating: result.rating,
                  reviewCount: result.reviewCount, types: result.types ?? [], placeId: result.placeId,
                  description: result.editorialSummary, website: result.website,
                })
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm card */}
      <AnimatePresence>
        {pendingPlace && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-card overflow-hidden shadow-sm"
          >
            {pendingPlace.photoUrl && (
              <div className="h-28 overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingPlace.photoUrl}
                  alt={pendingPlace.name ?? "Business"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-foreground leading-snug">{pendingPlace.name}</p>
                {pendingPlace.rating && (
                  <div className="flex items-center gap-1 shrink-0">
                    <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-foreground">{pendingPlace.rating.toFixed(1)}</span>
                    {pendingPlace.reviewCount && (
                      <span className="text-xs text-muted-foreground">({pendingPlace.reviewCount})</span>
                    )}
                  </div>
                )}
              </div>
              {pendingPlace.address && (
                <p className="text-sm text-muted-foreground mt-0.5">{pendingPlace.address}</p>
              )}
              {pendingPlace.description && (
                <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">&ldquo;{pendingPlace.description}&rdquo;</p>
              )}
              {pendingPlace.website && (
                <p className="text-xs text-indigo-500 mt-1 truncate">{pendingPlace.website}</p>
              )}
              <div className="flex items-center gap-2 mt-4">
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Use this business ✨
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setPendingPlace(null); setPlacesKey((k) => k + 1); }}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Not the right one
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmed business card */}
      <AnimatePresence>
        {gbpConfirmed && data.businessName && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{data.businessName}</p>
                  {data.city && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      {data.city}{data.state ? `, ${data.state}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGbpConfirmed(false);
                  setShowManual(false);
                  onUpdate({ placeId: undefined });
                  setPlacesKey((k) => k + 1);
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
              >
                Change
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Niche picker — shown when GBP niche couldn't be auto-detected */}
      <AnimatePresence>
        {(gbpConfirmed || (showManual && !!data.businessName)) && data.niche === 'other' && !nichePickerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="space-y-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">What kind of business is this?</p>
              <p className="text-xs text-muted-foreground mt-0.5">We couldn&apos;t detect your industry automatically — pick one so we build the right agent.</p>
            </div>
            {/* AI niche suggestion */}
            {inferring && !inferredNiche && (
              <p className="text-xs text-muted-foreground animate-pulse">Analyzing your business...</p>
            )}
            {inferredNiche && !inferDismissed && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{nicheEmojis[inferredNiche]}</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">AI suggests</p>
                    <p className="text-sm font-semibold text-foreground">{nicheLabels[inferredNiche]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyNiche(inferredNiche)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Use this
                  </button>
                  <button
                    type="button"
                    onClick={() => setInferDismissed(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Not right
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(NICHE_PRODUCTION_READY) as Niche[])
                .filter((n) => NICHE_PRODUCTION_READY[n] && n !== 'other')
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyNiche(n)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-background hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-sm text-left transition-colors cursor-pointer"
                  >
                    <span className="text-base">{nicheEmojis[n]}</span>
                    <span className="font-medium text-foreground leading-tight">{nicheLabels[n]}</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setNichePickerDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Skip — my business is unique
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual fallback — only before confirmation */}
      <AnimatePresence>
        {!gbpConfirmed && !pendingPlace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              onClick={handleManual}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-primary transition-all cursor-pointer text-center bg-transparent"
            >
              No Google listing? Fill in manually →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual business name input */}
      <AnimatePresence>
        {showManual && !gbpConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <Label htmlFor="businessName">Business name <span className="text-red-500">*</span></Label>
            <Input
              id="businessName"
              value={data.businessName}
              onChange={(e) => onUpdate({ businessName: e.target.value })}
              placeholder="Acme Services"
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent name — shown after business is confirmed (GBP or manual) */}
      <AnimatePresence>
        {(gbpConfirmed || (showManual && data.businessName)) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.08 }}
            className="space-y-4 pt-4 border-t border-border"
          >
            {/* Business name — editable after GBP import so user isn't locked to listing name */}
            {gbpConfirmed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="space-y-1.5"
              >
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={data.businessName}
                  onChange={(e) => onUpdate({ businessName: e.target.value })}
                  placeholder="Acme Services"
                />
                <p className="text-xs text-muted-foreground">Imported from Google — edit freely.</p>
              </motion.div>
            )}

            {/* Agent name */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="space-y-1.5"
            >
              <Label htmlFor="agentName">Agent name</Label>
              <Input
                id="agentName"
                value={data.agentName}
                onChange={(e) => onUpdate({ agentName: e.target.value })}
                placeholder="e.g. Mark, Ashley, Jordan"
              />
              <p className="text-xs text-muted-foreground">What your agent introduces itself as on calls.</p>
            </motion.div>

            {/* Phase 7: Voice style picker — style labels, not gender */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="space-y-2"
            >
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
            </motion.div>

            {/* Phase 7: Caller reasons — visible optional inputs (40-60% engagement vs 15-25% collapsed) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
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
                    if (filled.length > 0) {
                      fireIntelligenceGeneration(data);
                    }
                  }}
                  placeholder={getReasonPlaceholder(data.niche, i)}
                  className="text-sm"
                />
              ))}
              <p className="text-xs text-muted-foreground italic">
                <span className="text-muted-foreground/70">Optional</span> — if skipped, your agent uses smart defaults for your industry.
              </p>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
