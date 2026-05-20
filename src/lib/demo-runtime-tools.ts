import { buildDemoTools, buildKnowledgeTools, type UltravoxTool } from '@/lib/ultravox'

export interface DemoRuntimeToolCapabilities {
  hasPhoneMedium: boolean
  hasCallerPhone: boolean
  calendarEnabled: boolean
  transferEnabled: boolean
  knowledgeEnabled: boolean
}

export function buildDemoRuntimeTools(
  slug: string,
  caps: DemoRuntimeToolCapabilities,
): UltravoxTool[] {
  const tools = buildDemoTools(slug, caps)
  if (caps.knowledgeEnabled) tools.push(...buildKnowledgeTools(slug))
  return tools
}

export function formatDemoToolList(tools: object[]): string {
  const names = tools
    .map(getDemoToolName)
    .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)

  return names.length > 0 ? names.join(', ') : 'none'
}

function getDemoToolName(tool: object): string | undefined {
  const entry = tool as {
    toolName?: unknown
    temporaryTool?: {
      modelToolName?: unknown
    }
  }

  if (typeof entry.temporaryTool?.modelToolName === 'string') {
    return entry.temporaryTool.modelToolName
  }
  if (typeof entry.toolName === 'string') return entry.toolName
  return undefined
}
