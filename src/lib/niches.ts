import type { LucideIcon } from "lucide-react"
import {
  Car,
  Building2,
  Thermometer,
  Droplets,
  Smile,
  Scale,
  Home,
} from "lucide-react"

export interface Niche {
  id: string
  label: string
  /** Full display label for footer/marketing contexts */
  fullLabel: string
  href: string
  icon: LucideIcon
  stat: string
  leadCardNiche: string
  live?: boolean
}

export const NICHES: Niche[] = [
  {
    id: "auto-glass",
    label: "Auto Glass",
    fullLabel: "Auto Glass Shops",
    href: "/for-auto-glass",
    icon: Car,
    stat: "Avg $400/job",
    leadCardNiche: "auto-glass",
    live: true,
  },
  {
    id: "property-mgmt",
    label: "Property Mgmt",
    fullLabel: "Property Management",
    href: "/for-realtors",
    icon: Building2,
    stat: "Avg $1,200/unit/yr",
    leadCardNiche: "realty",
    live: true,
  },
  {
    id: "hvac",
    label: "HVAC",
    fullLabel: "HVAC Companies",
    href: "/for-hvac",
    icon: Thermometer,
    stat: "Avg $350/call",
    leadCardNiche: "hvac",
  },
  {
    id: "plumbing",
    label: "Plumbing",
    fullLabel: "Plumbers",
    href: "/for-plumbing",
    icon: Droplets,
    stat: "Avg $280/job",
    leadCardNiche: "plumbing",
  },
  {
    id: "dental",
    label: "Dental",
    fullLabel: "Dental Offices",
    href: "/for-dental",
    icon: Smile,
    stat: "Avg $800/new patient",
    leadCardNiche: "dental",
  },
  {
    id: "legal",
    label: "Legal",
    fullLabel: "Law Firms",
    href: "/for-legal",
    icon: Scale,
    stat: "Avg $3,000/retainer",
    leadCardNiche: "legal",
  },
  {
    id: "realty",
    label: "Real Estate",
    fullLabel: "Real Estate Agents",
    href: "/for-realtors",
    icon: Home,
    stat: "Avg $12,000/deal",
    leadCardNiche: "realty",
  },
]

/** Subset for navbar/footer — only niches with unique pages */
export const NAV_NICHES = NICHES.filter(n => n.id !== "property-mgmt")
