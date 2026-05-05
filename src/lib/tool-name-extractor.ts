export const UNKNOWN_TOOL_SHAPE_PREFIX = '__UNKNOWN_TOOL_SHAPE_'

export interface UnknownToolShape {
  index: number
  source: string
  tool: unknown
}

interface ToolNameExtractorOptions {
  source?: string
  index?: number
  onUnknown?: (unknown: UnknownToolShape) => void
  logUnknown?: boolean
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function reportUnknown(tool: unknown, options: ToolNameExtractorOptions): void {
  const unknown: UnknownToolShape = {
    index: options.index ?? -1,
    source: options.source ?? 'tool-name-extractor',
    tool,
  }

  options.onUnknown?.(unknown)

  if (options.logUnknown === false) return

  console.warn(
    `[tool-name-extractor] Unknown tool wire shape in ${unknown.source} at index ${unknown.index}: ${safeJson(tool)}`,
  )
}

export function extractToolName(
  tool: unknown,
  options: ToolNameExtractorOptions = {},
): string | null {
  if (!tool || typeof tool !== 'object') {
    reportUnknown(tool, options)
    return null
  }

  const obj = tool as {
    toolName?: unknown
    nameOverride?: unknown
    temporaryTool?: {
      modelToolName?: unknown
      nameOverride?: unknown
    }
  }

  if (nonEmptyString(obj.toolName)) return obj.toolName
  if (nonEmptyString(obj.nameOverride)) return obj.nameOverride
  if (nonEmptyString(obj.temporaryTool?.modelToolName)) {
    return obj.temporaryTool.modelToolName
  }
  if (nonEmptyString(obj.temporaryTool?.nameOverride)) {
    return obj.temporaryTool.nameOverride
  }

  reportUnknown(tool, options)
  return null
}

export function normalizeToolNames(
  tools: unknown[] | null | undefined,
  options: Omit<ToolNameExtractorOptions, 'index'> = {},
): string[] {
  if (!Array.isArray(tools)) return []

  const names: string[] = []
  tools.forEach((tool, index) => {
    const name = extractToolName(tool, { ...options, index })
    names.push(name ?? `${UNKNOWN_TOOL_SHAPE_PREFIX}${index}__`)
  })

  return names.sort()
}
