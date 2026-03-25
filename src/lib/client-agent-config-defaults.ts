import type { VoicePresetId, ScheduleMode, CallHandlingMode } from '@/types/client-agent-config'

export const DEFAULT_TIMEZONE = 'America/Edmonton'
export const DEFAULT_VOICE_PRESET: VoicePresetId = 'casual_friendly'
export const DEFAULT_AFTER_HOURS_BEHAVIOR = 'take_message'
export const DEFAULT_AGENT_NAME = 'Sam'
export const DEFAULT_MONTHLY_MINUTE_LIMIT = 500
export const DEFAULT_SCHEDULE_MODE: ScheduleMode = 'business_hours'
export const DEFAULT_CALL_HANDLING_MODE: CallHandlingMode = 'triage'
