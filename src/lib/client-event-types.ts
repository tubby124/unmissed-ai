import type {
  ClientEventInput,
  ClientEventSeverity,
  ClientEventVisibility,
} from '@/lib/client-events'

export type ClientEventType =
  | 'prompt.version_inserted'
  | 'tools.synced'
  | 'tool.invoked'

export type ClientEventGroup = 'prompt' | 'runtime'

export interface ClientEventRegistryEntry {
  eventType: ClientEventType
  group: ClientEventGroup
  defaultSeverity: ClientEventSeverity
  allowedVisibility: ClientEventVisibility[]
  requiredIdentifiers: Array<
    'clientId' |
    'clientSlug' |
    'promptVersionId' |
    'callLogId' |
    'ultravoxCallId' |
    'harnessFindingId'
  >
  requiredDetails: string[]
  highCardinality: boolean
}

export const CLIENT_EVENT_REGISTRY: Record<ClientEventType, ClientEventRegistryEntry> = {
  'prompt.version_inserted': {
    eventType: 'prompt.version_inserted',
    group: 'prompt',
    defaultSeverity: 'notice',
    allowedVisibility: ['admin_only', 'system_only'],
    requiredIdentifiers: ['clientId', 'promptVersionId'],
    requiredDetails: ['version', 'char_count'],
    highCardinality: false,
  },
  'tools.synced': {
    eventType: 'tools.synced',
    group: 'runtime',
    defaultSeverity: 'info',
    allowedVisibility: ['admin_only', 'system_only'],
    requiredIdentifiers: ['clientId', 'clientSlug'],
    requiredDetails: [],
    highCardinality: false,
  },
  'tool.invoked': {
    eventType: 'tool.invoked',
    group: 'runtime',
    defaultSeverity: 'info',
    allowedVisibility: ['admin_only', 'system_only'],
    requiredIdentifiers: ['clientId'],
    requiredDetails: ['tool_name'],
    highCardinality: true,
  },
}

export interface ClientEventValidationResult {
  ok: boolean
  error?: string
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

export function validateClientEventInput(event: ClientEventInput): ClientEventValidationResult {
  const entry = CLIENT_EVENT_REGISTRY[event.eventType as ClientEventType]
  if (!entry) return { ok: true }

  if (event.eventGroup !== entry.group) {
    return {
      ok: false,
      error: `${event.eventType} must use event_group=${entry.group}`,
    }
  }

  const visibility = event.visibility ?? 'admin_only'
  if (!entry.allowedVisibility.includes(visibility)) {
    return {
      ok: false,
      error: `${event.eventType} does not allow visibility=${visibility}`,
    }
  }

  for (const identifier of entry.requiredIdentifiers) {
    if (!hasValue(event[identifier])) {
      return {
        ok: false,
        error: `${event.eventType} requires ${identifier}`,
      }
    }
  }

  for (const detail of entry.requiredDetails) {
    if (!hasValue(event.details?.[detail])) {
      return {
        ok: false,
        error: `${event.eventType} requires details.${detail}`,
      }
    }
  }

  return { ok: true }
}
