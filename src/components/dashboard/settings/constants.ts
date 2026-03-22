// ─── Types ──────────────────────────────────────────────────────────────────

export interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string
  created_at: string
  is_active: boolean
  triggered_by_role?: string | null
  triggered_by_user_id?: string | null
  char_count?: number | null
  prev_char_count?: number | null
}

export type ImproveState = 'idle' | 'loading' | 'done' | 'error'

export interface ImproveResult {
  improved_prompt: string
  changes: Array<{ type: string; section: string; what: string; why: string; confidence: string }>
  call_count: number
  has_enough_data: boolean
}

export interface VoiceTabVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl: string
}

export type GodConfigEntry = {
  telegram_bot_token: string
  telegram_chat_id: string
  timezone: string
  twilio_number: string
  monthly_minute_limit: number
}

export type LearningStatus = {
  calls_since_last_analysis: number
  last_analyzed_at: string | null
  should_analyze: boolean
  trigger_reason: 'cadence' | 'friction_call' | 'unknown_status' | 'short_call' | 'frustrated' | null
  pending_report: {
    id: string
    recommendations_count: number
    top_recs: Array<{ title: string; rationale: string; priority: string }>
  } | null
}

export type SettingsTab = 'general' | 'sms' | 'voice' | 'notifications' | 'billing' | 'knowledge'

// ─── Constants ──────────────────────────────────────────────────────────────

export const TIMEZONES = [
  { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (LA)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'UTC', label: 'UTC' },
] as const

export const KNOWN_VOICES: Record<string, string> = {
  'aa601962-1cbd-4bbd-9d96-3c7a93c3414a': 'Jacqueline',
  'd766b9e3-69df-4727-b62f-cd0b6772c2ad': 'Nour',
  '3bde8dc5-67c8-4e3f-82e1-b4f8e5c5db1c': 'Mark',
  'b9de4a89-7971-4ac8-aeea-d86fd8543a1a': 'Emily',
}

import { MINUTE_RELOAD } from '@/lib/pricing'

export const RELOAD_OPTIONS = [
  { minutes: MINUTE_RELOAD.minutes,     price: MINUTE_RELOAD.price },      // 50 min, $10
  { minutes: MINUTE_RELOAD.minutes * 2, price: MINUTE_RELOAD.price * 2 },  // 100 min, $20
  { minutes: MINUTE_RELOAD.minutes * 3, price: MINUTE_RELOAD.price * 3 },  // 150 min, $30
] as const

export const TAB_DEFINITIONS: { id: SettingsTab; label: string; adminOnly: boolean; icon: string }[] = [
  { id: 'general',       label: 'Agent',     adminOnly: false, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
  { id: 'sms',           label: 'SMS',       adminOnly: false, icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'voice',         label: 'Voice',     adminOnly: false, icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2' },
  { id: 'notifications', label: 'Alerts',    adminOnly: false, icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
  { id: 'billing',       label: 'Billing',   adminOnly: false, icon: 'M2 10h20M22 10V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6Z' },
  { id: 'knowledge',     label: 'Knowledge', adminOnly: false, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z' },
]
