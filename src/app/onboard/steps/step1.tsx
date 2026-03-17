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

interface Category {
  label: string;
  icon: LucideIcon;
  niches: Niche[];
}

const CATEGORIES: Category[] = [
  { label: "Services", icon: Wrench, niches: ["auto_glass", "hvac", "plumbing", "print_shop"] },
  { label: "Property", icon: Building2, niches: ["property_management", "real_estate"] },
  { label: "Beauty & Wellness", icon: Scissors, niches: ["salon"] },
  { label: "Food & Hospitality", icon: UtensilsCrossed, niches: ["restaurant"] },
  { label: "Other", icon: HelpCircle, niches: ["voicemail", "dental", "legal", "other"] },
];

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

export default function Step1({ data, onUpdate }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    // Auto-expand the category containing the already-selected niche
    if (data.niche) {
      const cat = CATEGORIES.find((c) => c.niches.includes(data.niche!));
      return cat?.label ?? null;
    }
    return null;
  });
  const [autofilling, setAutofilling] = useState(false);

  const toggleCategory = useCallback(
    (label: string) => {
      setExpandedCategory((prev) => (prev === label ? null : label));
    },
    [],
  );

  const handleWebsiteBlur = useCallback(
    async (url: string) => {
      if (!url) return;

      // Normalize URL
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      setAutofilling(true);

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
                }
                if (Object.keys(updates).length > 0) onUpdate(updates);
              }
            }
          } catch {
            // Silently fall through to autofill
          }
        }

        // 2. Always run autofill for hours/services (fills gaps)
        if (!placesAvailable || !data.businessHoursText || !data.servicesOffered) {
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
    [data.businessName, data.city, data.businessHoursText, data.servicesOffered, onUpdate],
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
        <label className="text-xs font-medium text-muted-foreground">
          Search your business <span className="text-muted-foreground/70 font-normal">(optional — auto-fills details)</span>
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
                // Auto-expand that category so the user sees the selection
                const cat = CATEGORIES.find((c) => c.niches.includes(detected))
                if (cat) setExpandedCategory(cat.label)
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

      {/* Category cards */}
      <div className="space-y-3">
        {CATEGORIES.map((category) => {
          const isExpanded = expandedCategory === category.label;
          const CategoryIcon = category.icon;
          const hasSelected = category.niches.includes(data.niche as Niche);

          return (
            <div key={category.label}>
              <button
                type="button"
                onClick={() => toggleCategory(category.label)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all cursor-pointer
                  ${hasSelected
                    ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100"
                    : isExpanded
                      ? "border-border/80 bg-muted/30"
                      : "border-border bg-card hover:border-border hover:bg-muted/30"
                  }
                `}
              >
                <CategoryIcon
                  className={`w-5 h-5 shrink-0 ${hasSelected ? "text-indigo-600" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-sm font-semibold ${hasSelected ? "text-indigo-900" : "text-foreground"}`}
                >
                  {category.label}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`ml-auto shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""} ${
                    hasSelected ? "text-indigo-400" : "text-muted-foreground/70"
                  }`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2 pt-3 pb-1 px-1">
                      {category.niches.filter(niche => NICHE_PRODUCTION_READY[niche]).map((niche) => {
                        const NicheIcon = nicheIcons[niche];
                        const isSelected = data.niche === niche;

                        return (
                          <button
                            key={niche}
                            type="button"
                            onClick={() => onUpdate({ niche })}
                            className={`
                              flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer
                              ${isSelected
                                ? "border-indigo-600 bg-indigo-100 text-indigo-900"
                                : "border-border bg-card text-foreground hover:border-border hover:bg-muted/30"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Website URL input */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label htmlFor="websiteUrl">Website URL <span className="text-muted-foreground/70 font-normal text-xs">(optional)</span></Label>
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
