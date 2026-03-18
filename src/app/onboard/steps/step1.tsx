"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Car, Flame, Wrench, Stethoscope, Scale, Scissors,
  Home, Building2, PhoneCall, Voicemail, HelpCircle, UtensilsCrossed, Printer,
  type LucideIcon,
} from "lucide-react";
import { Niche, nicheLabels, OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NICHE_PRODUCTION_READY } from '@/lib/niche-config'
import PlacesAutocomplete from '@/components/onboard/PlacesAutocomplete'

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

export default function Step1({ data, onUpdate }: Props) {
  const [autofilling, setAutofilling] = useState(false);

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
              if (Object.keys(updates).length > 0) onUpdate(updates);
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
        <h2 className="text-2xl font-bold text-foreground">What type of business are you?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your agent will be customized with industry-specific knowledge.
        </p>
      </div>

      {/* Business search — Places autocomplete */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">
          Search your business to get started
        </label>
        <PlacesAutocomplete
          initialValue={data.businessName}
          onSelect={(result) => {
            const updates: Partial<OnboardingData> = {}
            if (result.name) updates.businessName = result.name
            if (result.address) {
              const { city, state, streetAddress } = parseAddressParts(result.address)
              if (city) updates.city = city
              if (state) updates.state = state
              if (streetAddress) updates.streetAddress = streetAddress
            }
            if (result.phone) updates.callbackPhone = result.phone
            if (result.hours && Array.isArray(result.hours)) {
              updates.businessHoursText = result.hours.join(', ')
            }
            if (result.photoUrl) updates.placesPhotoUrl = result.photoUrl
            if (result.rating) updates.placesRating = result.rating
            if (result.reviewCount) updates.placesReviewCount = result.reviewCount
            if (result.placeId) updates.placeId = result.placeId
            // Auto-detect niche from Places types[]
            if (result.types && Array.isArray(result.types)) {
              const detected = detectNicheFromTypes(result.types)
              if (detected && NICHE_PRODUCTION_READY[detected]) {
                updates.niche = detected
              }
              // Auto-fill servicesOffered if not already set
              if (!data.servicesOffered) {
                const services = detectServicesFromTypes(result.types)
                if (services) updates.servicesOffered = services
              }
            }
            if (Object.keys(updates).length > 0) onUpdate(updates)
          }}
        />
      </div>

      {/* Flat niche chip grid */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Select your industry
        </label>
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
                  onClick={() => onUpdate({ niche })}
                  className={`
                    flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer
                    ${isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm shadow-indigo-100 dark:shadow-none"
                      : "border-border bg-card text-foreground hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                    }
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
    </div>
  );
}
