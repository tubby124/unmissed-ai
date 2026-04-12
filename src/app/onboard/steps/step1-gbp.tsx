"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Niche, OnboardingData, defaultAgentNames, nicheLabels, nicheEmojis } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlacesAutocomplete from "@/components/onboard/PlacesAutocomplete";
import { trackEvent } from "@/lib/analytics";
import { NICHE_PRODUCTION_READY } from "@/lib/niche-config";
import { agentNameIsAutoSet } from "@/lib/intake-transform";

const FEMALE_DEFAULT = { id: "aa601962-1cbd-4bbd-9d96-3c7a93c3414a", name: "Jacqueline" };

const PLACES_TYPE_TO_NICHE: Record<string, Niche> = {
  // auto glass
  auto_glass_shop: "auto_glass", car_repair: "auto_glass", car_wash: "auto_glass",
  // hvac / emergency dispatch
  hvac_contractor: "hvac", electrician: "hvac",
  locksmith: "hvac", electrical_contractor: "hvac", pest_control: "hvac",
  roofing_contractor: "hvac", moving_company: "hvac",
  // plumbing
  plumber: "plumbing",
  // dental / appointment + emergency split
  dentist: "dental", dental_clinic: "dental",
  physiotherapist: "dental", veterinarian: "dental", animal_hospital: "dental", optometrist: "dental",
  // legal / consultation intake
  lawyer: "legal", legal_services: "legal",
  accounting: "legal", financial_planner: "legal", insurance_agency: "legal", notary_public: "legal",
  // salon / appointment booking
  hair_care: "salon", beauty_salon: "salon", nail_salon: "salon", spa: "salon",
  barber_shop: "salon", chiropractor: "salon", massage_therapist: "salon",
  gym: "salon", fitness_center: "salon", yoga_studio: "salon",
  // real estate
  real_estate_agency: "real_estate", real_estate: "real_estate",
  // property management / tenant triage
  property_management_company: "property_management",
  storage: "property_management", self_storage: "property_management",
  storage_facility: "property_management", commercial_real_estate_agency: "property_management",
  // restaurant
  restaurant: "restaurant", food: "restaurant", cafe: "restaurant", meal_takeaway: "restaurant",
  // print shop
  print_shop: "print_shop",
};

function detectNicheFromTypes(types: string[]): Niche | null {
  for (const t of types) {
    if (PLACES_TYPE_TO_NICHE[t]) return PLACES_TYPE_TO_NICHE[t];
  }
  return null;
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

  // Derive predicted agent name from pending place for the CTA button
  const getPendingAgentName = (): string => {
    if (!pendingPlace) return data.agentName || "your agent";
    const detected = detectNicheFromTypes(pendingPlace.types);
    if (detected && NICHE_PRODUCTION_READY[detected]) return defaultAgentNames[detected];
    return defaultAgentNames["other"];
  };

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
    if (pendingPlace.hours?.length) updates.businessHoursText = pendingPlace.hours.join(", ");
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

  const pendingAgentName = getPendingAgentName();

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
                  Train {pendingAgentName} ✨
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
        {gbpConfirmed && data.niche === 'other' && !nichePickerDismissed && (
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
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(NICHE_PRODUCTION_READY) as Niche[])
                .filter((n) => NICHE_PRODUCTION_READY[n] && n !== 'other')
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      const updates: Partial<OnboardingData> = { niche: n };
                      if (agentNameIsAutoSet(data.agentName, data.niche)) {
                        updates.agentName = defaultAgentNames[n];
                      }
                      onUpdate(updates);
                      setNichePickerDismissed(true);
                    }}
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

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
