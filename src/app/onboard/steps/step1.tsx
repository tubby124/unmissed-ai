"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Car, Flame, Wrench, Stethoscope, Scale, Scissors,
  Home, Building2, PhoneCall, Voicemail, HelpCircle, UtensilsCrossed, Printer,
  type LucideIcon,
} from "lucide-react";
import { Niche, nicheLabels, OnboardingData, defaultAgentNames } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NICHE_PRODUCTION_READY } from '@/lib/niche-config'
import PlacesAutocomplete from '@/components/onboard/PlacesAutocomplete'

const DEFAULT_AGENT_NAME_SET = new Set(Object.values(defaultAgentNames))

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const nicheIcons: Record<Niche, LucideIcon> = {
  auto_glass: Car,
  hvac: Flame,
  plumbing: Wrench,
  dental: Stethoscope,
  legal: Scale,
  salon: Scissors,
  real_estate: Home,
  property_management: Building2,
  outbound_isa_realtor: PhoneCall,
  voicemail: Voicemail,
  restaurant: UtensilsCrossed,
  print_shop: Printer,
  other: HelpCircle,
};

// Maps Google Places types[] → default servicesOffered text
const PLACES_TYPE_TO_SERVICES: Partial<Record<string, string>> = {
  car_repair: 'Auto repair, windshield replacement, glass services',
  dentist: 'General dentistry, cleanings, fillings, extractions',
  hair_care: 'Haircuts, styling, coloring, treatments',
  plumber: 'Plumbing repair, drain cleaning, pipe installation',
  electrician: 'Electrical repair, installation, inspections',
  locksmith: 'Lock installation, emergency lockout, key cutting',
  lawyer: 'Legal consultation, case representation, document drafting',
  real_estate_agency: 'Buying, selling, and renting properties',
  restaurant: 'Dine-in, takeout, and catering services',
  gym: 'Personal training, group classes, fitness coaching',
  spa: 'Massage therapy, facials, body treatments',
  veterinary_care: 'Pet exams, vaccinations, surgery',
}

function detectServicesFromTypes(types: string[]): string | null {
  for (const t of types) {
    if (PLACES_TYPE_TO_SERVICES[t]) return PLACES_TYPE_TO_SERVICES[t]!
  }
  return null
}

// Maps Google Places types[] → our Niche values
const PLACES_TYPE_TO_NICHE: Record<string, Niche> = {
  // Auto glass / car repair
  auto_glass_shop: 'auto_glass',
  car_repair: 'auto_glass',
  car_wash: 'auto_glass',
  // HVAC
  hvac_contractor: 'hvac',
  // Plumbing
  plumber: 'plumbing',
  // Dental
  dentist: 'dental',
  dental_clinic: 'dental',
  // Legal
  lawyer: 'legal',
  legal_services: 'legal',
  // Salon / beauty
  hair_care: 'salon',
  beauty_salon: 'salon',
  nail_salon: 'salon',
  spa: 'salon',
  // Real estate
  real_estate_agency: 'real_estate',
  real_estate: 'real_estate',
  // Property management
  property_management_company: 'property_management',
  // Restaurant / food
  restaurant: 'restaurant',
  food: 'restaurant',
  cafe: 'restaurant',
  meal_takeaway: 'restaurant',
  // Print shop
  print_shop: 'print_shop',
  // Electrician → hvac (closest bucket)
  electrician: 'hvac',
}

function detectNicheFromTypes(types: string[]): Niche | null {
  for (const t of types) {
    if (PLACES_TYPE_TO_NICHE[t]) return PLACES_TYPE_TO_NICHE[t]
  }
  return null
}

function parseAddressParts(address: string): { city: string; state: string; streetAddress: string } {
  // Google formatted_address: "123 Main St, Saskatoon, SK S7L 0V5, Canada"
  const parts = address.split(",").map((s) => s.trim());
  const streetAddress = parts[0] || "";
  const city = parts[1] || "";
  // Province/state is usually the 3rd part before postal code: "SK S7L 0V5"
  const stateChunk = parts[2] || "";
  const state = stateChunk.split(" ")[0] || "";
  return { city, state, streetAddress };
}

const NICHE_SUBTEXT: Partial<Record<Niche, string>> = {
  auto_glass: "Tell us about your auto glass shop.",
  hvac: "Tell us about your HVAC company.",
  plumbing: "Tell us about your plumbing business.",
  dental: "Tell us about your dental clinic.",
  legal: "Tell us about your law office.",
  salon: "Tell us about your salon or spa.",
  real_estate: "Tell us about your real estate business.",
  property_management: "Tell us about your property management company.",
  outbound_isa_realtor: "Tell us about your real estate team.",
  restaurant: "Tell us about your restaurant.",
  print_shop: "Tell us about your print shop.",
  voicemail: "Tell us about your business.",
  other: "Tell us about your business.",
};

const NICHE_INSIGHTS: Partial<Record<Niche, string[]>> = {
  auto_glass: [
    "Triage windshield chips vs. full replacements",
    "Collect vehicle make, model, and insurance info",
    "Route urgent mobile dispatch calls",
  ],
  hvac: [
    "Qualify heating/cooling emergencies vs. routine service",
    "Collect system type, age, and issue description",
    "Book service windows and route after-hours calls",
  ],
  plumbing: [
    "Triage emergency leaks vs. scheduled repairs",
    "Collect address, issue type, and urgency level",
    "Route after-hours emergency calls appropriately",
  ],
  dental: [
    "Qualify new patient inquiries vs. emergencies",
    "Collect patient name, concern, and preferred time",
    "Handle appointment requests and insurance questions",
  ],
  legal: [
    "Qualify case type and urgency level",
    "Collect contact info and matter description",
    "Route to the right practice area",
  ],
  salon: [
    "Handle appointment requests and availability questions",
    "Collect service type and stylist preference",
    "Manage waitlist and callback requests",
  ],
  real_estate: [
    "Qualify buyers, sellers, and rental inquiries",
    "Capture property address and timeline",
    "Book showing requests and callback times",
  ],
  property_management: [
    "Triage emergency maintenance vs. routine requests",
    "Collect unit number, issue type, and entry permission",
    "Route after-hours emergencies to on-call staff",
  ],
  print_shop: [
    "Capture job type, quantity, and deadline",
    "Handle file submission and artwork questions",
    "Route rush orders and quote requests",
  ],
  restaurant: [
    "Handle reservation requests and hours questions",
    "Capture party size and special requests",
    "Route catering inquiries to the right contact",
  ],
  voicemail: [
    "Capture caller name, number, and message",
    "Send SMS confirmation after every call",
    "Deliver messages instantly via Telegram",
  ],
  other: [
    "Capture caller name, phone, and reason for calling",
    "Send SMS follow-up after every call",
    "Route urgent calls to your callback number",
  ],
};

/** Returns the default agent name for a niche if the current name is uncustomized. */
function resolveAgentName(currentName: string, newNiche: Niche): string | undefined {
  if (!currentName || DEFAULT_AGENT_NAME_SET.has(currentName)) {
    return defaultAgentNames[newNiche]
  }
  return undefined
}

// Pending place data while user confirms "Is this your business?"
interface PendingPlace {
  name: string | null
  address: string | null
  phone: string | null
  hours: string[] | null
  photoUrl: string | null
  rating: number | null
  reviewCount: number | null
  types: string[]
  placeId: string
}

export default function Step1({ data, onUpdate }: Props) {
  const [autofilling, setAutofilling] = useState(false);
  const [googleFilled, setGoogleFilled] = useState(false);
  const [websiteFilled, setWebsiteFilled] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<PendingPlace | null>(null);
  const [placesKey, setPlacesKey] = useState(0);
  const [flashNiche, setFlashNiche] = useState<Niche | null>(null);

  const handleWebsiteBlur = useCallback(
    async (url: string) => {
      if (!url) return;

      // Normalize URL
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      setAutofilling(true);
      let placesFilledHours = false;

      try {
        // 1. Try Places API if we have a business name
        let placesAvailable = false;
        if (data.businessName) {
          try {
            const placesRes = await fetch(
              `/api/onboard/places-lookup?q=${encodeURIComponent(data.businessName)}&city=${encodeURIComponent(data.city || "")}`,
            );
            if (placesRes.ok) {
              const placesData = await placesRes.json();
              if (placesData.available && placesData.name) {
                placesAvailable = true;
                const updates: Partial<OnboardingData> = {};
                if (placesData.name) updates.businessName = placesData.name;
                if (placesData.address) {
                  const { city, state, streetAddress } = parseAddressParts(placesData.address);
                  if (city) updates.city = city;
                  if (state) updates.state = state;
                  if (streetAddress) updates.streetAddress = streetAddress;
                }
                if (placesData.phone) updates.callbackPhone = placesData.phone;
                if (placesData.hours && Array.isArray(placesData.hours)) {
                  updates.businessHoursText = placesData.hours.join(", ");
                  placesFilledHours = true;
                }
                if (Object.keys(updates).length > 0) onUpdate(updates);
              }
            }
          } catch {
            // Silently fall through to autofill
          }
        }

        // 2. Always run autofill for hours/services (fills gaps)
        if (!placesAvailable || (!data.businessHoursText && !placesFilledHours) || !data.servicesOffered) {
          try {
            const autofillRes = await fetch("/api/onboard/autofill", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: normalizedUrl }),
            });
            if (autofillRes.ok) {
              const autofillData = await autofillRes.json();
              const updates: Partial<OnboardingData> = {};
              if (autofillData.hours && !data.businessHoursText) {
                updates.businessHoursText = autofillData.hours;
              }
              if (autofillData.services && !data.servicesOffered) {
                updates.servicesOffered = autofillData.services;
              }
              if (autofillData.faqs && Array.isArray(autofillData.faqs) && !data.faqPairs.length) {
                updates.faqPairs = autofillData.faqs.slice(0, 3).map((faq: { question: string; answer: string }) => ({
                  question: faq.question || '',
                  answer: faq.answer || '',
                  source: 'scraped' as const,
                }));
              }
              if (Object.keys(updates).length > 0) {
                onUpdate(updates);
                setWebsiteFilled(true);
              }
            }
          } catch {
            // Silent — autofill is best-effort
          }
        }
      } finally {
        setAutofilling(false);
      }
    },
    [data.businessName, data.city, data.businessHoursText, data.servicesOffered, data.faqPairs, onUpdate],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Let&apos;s build your AI receptionist.</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {data.niche && NICHE_SUBTEXT[data.niche]
            ? NICHE_SUBTEXT[data.niche]
            : "Find your business and we'll fill in the details."}
        </p>
      </div>

      {/* Business search — Places autocomplete (optional helper) */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">
          Find your business <span className="text-xs font-normal text-muted-foreground">(optional — or fill in below)</span>
        </label>
        <PlacesAutocomplete
          key={placesKey}
          initialValue={data.businessName}
          onSelect={(result) => {
            // Hold in pending state — user must confirm "Is this your business?"
            setPendingPlace({
              name: result.name,
              address: result.address,
              phone: result.phone,
              hours: result.hours,
              photoUrl: result.photoUrl,
              rating: result.rating,
              reviewCount: result.reviewCount,
              types: result.types ?? [],
              placeId: result.placeId,
            })
          }}
        />
      </div>

      {/* "Is this your business?" confirm card */}
      <AnimatePresence>
        {pendingPlace && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
                <p className="text-base font-semibold text-foreground leading-snug">
                  {pendingPlace.name}
                </p>
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
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mt-3 mb-2.5">
                Is this your business?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updates: Partial<OnboardingData> = {}
                    if (pendingPlace.name) updates.businessName = pendingPlace.name
                    if (pendingPlace.address) {
                      const { city, state, streetAddress } = parseAddressParts(pendingPlace.address)
                      if (city) updates.city = city
                      if (state) updates.state = state
                      if (streetAddress) updates.streetAddress = streetAddress
                    }
                    if (pendingPlace.phone) updates.callbackPhone = pendingPlace.phone
                    if (pendingPlace.hours && Array.isArray(pendingPlace.hours)) {
                      updates.businessHoursText = pendingPlace.hours.join(', ')
                    }
                    if (pendingPlace.photoUrl) updates.placesPhotoUrl = pendingPlace.photoUrl
                    if (pendingPlace.rating) updates.placesRating = pendingPlace.rating
                    if (pendingPlace.reviewCount) updates.placesReviewCount = pendingPlace.reviewCount
                    updates.placeId = pendingPlace.placeId
                    if (pendingPlace.types.length > 0) {
                      const detected = detectNicheFromTypes(pendingPlace.types)
                      if (detected && NICHE_PRODUCTION_READY[detected]) {
                        updates.niche = detected
                        const newName = resolveAgentName(data.agentName, detected)
                        if (newName) updates.agentName = newName
                        setFlashNiche(detected)
                        setTimeout(() => setFlashNiche(null), 1500)
                      }
                      if (!data.servicesOffered) {
                        const services = detectServicesFromTypes(pendingPlace.types)
                        if (services) updates.servicesOffered = services
                      }
                    }
                    onUpdate(updates)
                    setGoogleFilled(true)
                    setWebsiteFilled(false)
                    setPendingPlace(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Yes, that&apos;s us
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingPlace(null)
                    setPlacesKey(k => k + 1) // remount search input
                  }}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Not the right one
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autofill confirmed badge */}
      {(googleFilled || websiteFilled) && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
            {googleFilled ? "Auto-filled from Google — check details below" : "Pulled info from your website — check details below"}
          </p>
        </div>
      )}

      {/* Flat niche chip grid */}
      <div className="space-y-2" role="group" aria-labelledby="niche-group-label">
        <p id="niche-group-label" className="text-sm font-semibold text-foreground">
          Select your industry
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(nicheIcons) as Niche[])
            .filter((niche) => NICHE_PRODUCTION_READY[niche])
            .map((niche) => {
              const NicheIcon = nicheIcons[niche];
              const isSelected = data.niche === niche;
              return (
                <button
                  key={niche}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    const updates: Partial<OnboardingData> = { niche }
                    const newName = resolveAgentName(data.agentName, niche)
                    if (newName) updates.agentName = newName
                    onUpdate(updates)
                  }}
                  className={`
                    flex items-center gap-2 px-3.5 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer
                    ${isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm shadow-indigo-100 dark:shadow-none"
                      : "border-border bg-card text-foreground hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                    }
                    ${flashNiche === niche ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
                  `}
                >
                  <NicheIcon
                    className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-600" : "text-muted-foreground/70"}`}
                  />
                  {nicheLabels[niche]}
                </button>
              );
            })}
        </div>
      </div>

      {/* Insight card — appears after niche selection */}
      <AnimatePresence>
        {data.niche && NICHE_INSIGHTS[data.niche] && (
          <motion.div
            key={data.niche}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/20 p-4"
          >
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">
              Your agent will handle
            </p>
            <ul className="space-y-1.5">
              {NICHE_INSIGHTS[data.niche]!.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-indigo-900 dark:text-indigo-200">
                  <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {bullet}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Website URL input */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label htmlFor="websiteUrl" className="text-sm font-medium text-foreground">
          Your website <span className="text-xs text-muted-foreground font-normal">(we&apos;ll use it to train your agent)</span>
        </Label>
        <div className="relative">
          <Input
            id="websiteUrl"
            type="url"
            placeholder="https://yourbusiness.com"
            value={data.websiteUrl}
            onChange={(e) => onUpdate({ websiteUrl: e.target.value })}
            onBlur={(e) => handleWebsiteBlur(e.target.value)}
          />
          {autofilling && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Looking up your business...
            </div>
          )}
        </div>
      </div>

      {/* ── Business details — confirm or fill ─────────────────────────────── */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {googleFilled ? "Confirm these details" : "Your details"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {googleFilled
              ? "Looks good? Edit anything that\u2019s off."
              : "Your agent will use this to introduce itself to callers."}
          </p>
        </div>

        {/* Business Name */}
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name <span className="text-red-500">*</span></Label>
          <Input
            id="businessName"
            value={data.businessName}
            onChange={(e) => onUpdate({ businessName: e.target.value })}
            placeholder="Acme Services"
          />
        </div>

        {/* Owner / Contact Name — real estate only */}
        {data.niche === "real_estate" && (
          <div className="space-y-1.5">
            <Label htmlFor="ownerName">Your name <span className="text-red-500">*</span></Label>
            <Input
              id="ownerName"
              value={data.ownerName}
              onChange={(e) => onUpdate({ ownerName: e.target.value })}
              placeholder="Jane Smith"
            />
          </div>
        )}

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="callbackPhone">Business phone <span className="text-red-500">*</span></Label>
          <Input
            id="callbackPhone"
            type="tel"
            value={data.callbackPhone}
            onChange={(e) => onUpdate({ callbackPhone: e.target.value })}
            placeholder="(306) 555-1234"
          />
          <p className="text-xs text-muted-foreground">The number callers will be told to call back on.</p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Contact email <span className="text-red-500">*</span></Label>
          <Input
            id="contactEmail"
            type="email"
            value={data.contactEmail}
            onChange={(e) => onUpdate({ contactEmail: e.target.value })}
            placeholder="you@business.com"
          />
          <p className="text-xs text-muted-foreground">Used for your dashboard login and notifications.</p>
        </div>

        {/* City — not needed for voicemail */}
        {data.niche !== "voicemail" && (
          <div className="space-y-1.5">
            <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
            <Input
              id="city"
              value={data.city}
              onChange={(e) => onUpdate({ city: e.target.value })}
              placeholder="Saskatoon"
            />
          </div>
        )}

        {/* Business Hours — not needed for voicemail */}
        {data.niche !== "voicemail" && (
          <div className="space-y-1.5">
            <Label htmlFor="businessHoursText">Business hours <span className="text-red-500">*</span></Label>
            <Input
              id="businessHoursText"
              value={data.businessHoursText}
              onChange={(e) => onUpdate({ businessHoursText: e.target.value })}
              placeholder="Mon-Fri 9am-5pm, Sat 10am-2pm"
            />
            <p className="text-xs text-muted-foreground">Your agent will tell callers when you&apos;re open.</p>
          </div>
        )}

        {/* Services — optional */}
        {data.niche !== "voicemail" && (
          <div className="space-y-1.5">
            <Label htmlFor="servicesOffered">Services offered <span className="text-muted-foreground/70 font-normal text-xs">(optional)</span></Label>
            <Input
              id="servicesOffered"
              value={data.servicesOffered}
              onChange={(e) => onUpdate({ servicesOffered: e.target.value })}
              placeholder="Windshield repair, chip repair, mobile service"
            />
          </div>
        )}
      </div>
    </div>
  );
}
