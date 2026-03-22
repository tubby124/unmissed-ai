import { BRAND_NAME } from '@/lib/brand'

const prefix = BRAND_NAME.replace('.', '-')

export const STORAGE_KEYS = {
  THEME: `${prefix}-theme`,
  SETUP: `${prefix}-setup-v1`,
  ONBOARD_DRAFT: `${prefix}-onboard-draft`,
  TOUR_COMPLETED: `${prefix}_tour_completed`,
  ONBOARD_INTAKE_ID: `${prefix}_onboard_intake_id`,
} as const
