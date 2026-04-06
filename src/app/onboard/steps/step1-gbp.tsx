"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Niche, OnboardingData, defaultAgentNames, nicheLabels, nicheEmojis } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PlacesAutocomplete from "@/components/onboard/PlacesAutocomplete";
import { trackEvent } from "@/lib/analytics";
import { NICHE_PRODUCTION_READY } from "@/lib/niche-config";
import { agentNameIsAutoSet } from "@/lib/intake-transform";

const FEMALE_DEFAULT = { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline" };

const PLACES_TYPE_TO_NICHE: Record<string, Niche> = {
  auto_glass_shop: "auto_glass", car_repair: "auto_glass", car_wash: "auto_glass", glass_repair_service: "auto_glass",
  hvac_contractor: "hvac", electrician: "hvac", heating_contractor: "hvac", air_conditioning_contractor: "hvac", roofing_contractor: "hvac",
  plumber: "plumbing", drain_cleaning_service: "plumbing",
  dentist: "dental", dental_clinic: "dental", orthodontist: "dental", cosmetic_dentist: "dental",
  lawyer: "legal", legal_services: "legal", attorney: "legal",
  hair_care: "salon", beauty_salon: "salon", nail_salon: "salon", spa: "salon", barber_shop: "salon",
  real_estate_agency: "real_estate", real_estate: "real_estate",
  property_management_company: "property_management",
  apartment_rental_agency: "property_management", real_estate_rental_agency: "property_management", condominium_complex: "property_management",
  restaurant: "restaurant", food: "restaurant", cafe: "restaurant", meal_takeaway: "restaurant", bakery: "restaurant", bar: "restaurant", fast_food_restaurant: "restaurant",
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
            // Auto-apply the inferred niche — show a dismissible "wrong?" strip instead of requiring a click
            setInferredNiche(json.niche as Niche);
            applyNiche(json.niche as Niche);
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

            {/* Business address */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="space-y-1.5"
            >
              <Label htmlFor="businessAddress">
                Business address <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="businessAddress"
                value={data.businessAddress || ''}
                onChange={(e) => onUpdate({ businessAddress: e.target.value })}
                placeholder="123 Main St, Calgary, AB T2P 1J9"
              />
            </motion.div>

            {/* Website URL — shown when GBP had no website; helps train agent */}
            {!data.websiteUrl && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="space-y-1.5"
              >
                <Label htmlFor="websiteUrl">Website <span className="text-xs text-muted-foreground font-normal">(helps train your agent)</span></Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={data.websiteUrl || ''}
                  onChange={(e) => onUpdate({ websiteUrl: e.target.value })}
                  placeholder="https://yourbusiness.com"
                />
              </motion.div>
            )}

            {/* D393: Zero-data fallback — shown when no website AND no GBP description */}
            {!data.websiteUrl && !data.gbpDescription && (
              data.niche === 'property_management' ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                  className="space-y-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                >
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Your agent is pre-configured for property management calls — no website needed.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="pmManagerName" className="text-sm font-medium">
                      Property manager name{" "}
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-normal">(becomes the callback contact)</span>
                    </Label>
                    <Input
                      id="pmManagerName"
                      value={data.ownerName || ''}
                      onChange={(e) => onUpdate({ ownerName: e.target.value })}
                      placeholder="e.g. Ray, Alisha, Jordan"
                      className="text-sm"
                    />
                  </div>
                  {!data.city && (
                    <div className="space-y-1.5">
                      <Label htmlFor="pmCity" className="text-sm font-medium">
                        What city do you manage properties in?
                      </Label>
                      <Input
                        id="pmCity"
                        value={data.city || ''}
                        onChange={(e) => onUpdate({ city: e.target.value })}
                        placeholder="e.g. Calgary, Edmonton, Vancouver"
                        className="text-sm"
                      />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                  className="space-y-1.5 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                >
                  <Label htmlFor="manualDescription">
                    Tell us about your business{" "}
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-normal">(no website needed)</span>
                  </Label>
                  <Textarea
                    id="manualDescription"
                    value={data.manualDescription || ''}
                    onChange={(e) => onUpdate({ manualDescription: e.target.value })}
                    placeholder="Describe what you do in 2–3 sentences. What jobs do you take? What areas do you cover? What makes you different?"
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Your agent will use this to answer questions about your business.
                  </p>
                </motion.div>
              )
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
