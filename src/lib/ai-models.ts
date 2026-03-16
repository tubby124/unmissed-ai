export type ModelTier = 'essentials' | 'recommended'

export interface AIModel {
  id: string
  name: string
  provider: string
  tier: ModelTier
  costPer1kTokens: number // OUR cost in cents per 1k tokens (blended avg from OpenRouter)
  description: string
  isChineseInfra: boolean
}

// ── Pricing strategy ──────────────────────────────────────────────────────────
// Free models (costPer1kTokens === 0): clients pay CLIENT_FREE_COST per 1k tokens
// Paid models: clients pay costPer1kTokens * CLIENT_MARKUP
// Admin: unlimited credits, sees real OR cost
export const CLIENT_MARKUP = 150
export const CLIENT_FREE_COST = 0.01 // cents per 1k tokens for "free" models

export const AI_MODELS: AIModel[] = [
  // ── Essentials (free on OpenRouter — we charge 0.01¢/1k) ──────────────────
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Free, fast, great for everyday questions',
    isChineseInfra: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Free, strong reasoning, Chinese-infra',
    isChineseInfra: true,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    provider: 'Google',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Free, lightweight, quick answers',
    isChineseInfra: false,
  },

  // ── Recommended (cheap on OR — 150x markup for clients) ───────────────────
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    tier: 'recommended',
    costPer1kTokens: 0.03, // OR: $0.1/M in, $0.4/M out → 0.03¢/1k → client: 4.5¢/1k
    description: 'Ultra-fast, multimodal, great for quick analysis',
    isChineseInfra: false,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    tier: 'recommended',
    costPer1kTokens: 0.05, // OR: $0.2/M in, $0.77/M out → 0.05¢/1k → client: 7.5¢/1k
    description: 'Strong reasoning, Chinese-infra',
    isChineseInfra: true,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'recommended',
    costPer1kTokens: 0.3,  // OR: $1/M in, $5/M out → 0.3¢/1k → client: 45¢/1k
    description: 'Fast, smart, best value for business use',
    isChineseInfra: false,
  },
]

export interface CreditPack {
  id: string
  label: string
  cents: number
  priceCad: number
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_500', label: '$5 Credit Pack', cents: 500, priceCad: 5 },
  { id: 'pack_1000', label: '$10 Credit Pack', cents: 1000, priceCad: 10 },
  { id: 'pack_2500', label: '$25 Credit Pack', cents: 2500, priceCad: 25 },
]

export const TIER_LABELS: Record<ModelTier, string> = {
  essentials: 'Essentials',
  recommended: 'Recommended',
}

export const TIER_ORDER: ModelTier[] = ['essentials', 'recommended']

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id)
}

export function getModelsByTier(tier: ModelTier): AIModel[] {
  return AI_MODELS.filter(m => m.tier === tier)
}

export function isFreeTier(model: AIModel): boolean {
  return model.costPer1kTokens === 0
}

/** Our actual cost in cents (what OpenRouter charges us) */
export function estimateCost(model: AIModel, totalTokens: number): number {
  return Math.ceil((totalTokens / 1000) * model.costPer1kTokens)
}

/** Client-facing cost per 1k tokens in cents */
export function getClientCostPer1k(model: AIModel): number {
  return isFreeTier(model) ? CLIENT_FREE_COST : model.costPer1kTokens * CLIENT_MARKUP
}

/** Client-facing cost in cents for a given token count */
export function estimateClientCost(model: AIModel, totalTokens: number): number {
  return Math.ceil((totalTokens / 1000) * getClientCostPer1k(model))
}
