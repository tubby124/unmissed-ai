export type RuntimeSyncStatus = 'success' | 'error' | 'unknown'

export interface RuntimeToolState {
  deployed: { tools: string[] }
  syncStatus: RuntimeSyncStatus
}

export interface ToolBackedCapabilities {
  hasKnowledge: boolean
  hasBooking: boolean
  hasSms: boolean
  hasTransfer: boolean
}

export interface RuntimeToolTruth {
  usingRuntime: boolean
  effective: ToolBackedCapabilities
  notLive: ToolBackedCapabilities
}

const EMPTY_FLAGS: ToolBackedCapabilities = {
  hasKnowledge: false,
  hasBooking: false,
  hasSms: false,
  hasTransfer: false,
}

export function capabilitiesFromRuntimeTools(tools: string[]): ToolBackedCapabilities {
  const set = new Set(tools)
  return {
    hasKnowledge: set.has('queryKnowledge'),
    hasBooking:
      set.has('transitionToBookingStage') ||
      set.has('checkCalendarAvailability') ||
      set.has('bookAppointment'),
    hasSms: set.has('sendTextMessage'),
    hasTransfer: set.has('transferCall'),
  }
}

export function resolveRuntimeToolTruth(
  dbCapabilities: ToolBackedCapabilities,
  runtimeState: RuntimeToolState | null,
): RuntimeToolTruth {
  if (!runtimeState || runtimeState.syncStatus === 'unknown') {
    return {
      usingRuntime: false,
      effective: dbCapabilities,
      notLive: EMPTY_FLAGS,
    }
  }

  const runtimeCapabilities = capabilitiesFromRuntimeTools(runtimeState.deployed.tools)

  return {
    usingRuntime: true,
    effective: runtimeCapabilities,
    notLive: {
      hasKnowledge: dbCapabilities.hasKnowledge && !runtimeCapabilities.hasKnowledge,
      hasBooking: dbCapabilities.hasBooking && !runtimeCapabilities.hasBooking,
      hasSms: dbCapabilities.hasSms && !runtimeCapabilities.hasSms,
      hasTransfer: dbCapabilities.hasTransfer && !runtimeCapabilities.hasTransfer,
    },
  }
}
