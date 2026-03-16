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
    description: 'Fast, great for everyday questions',
    isChineseInfra: false,
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 405B',
    provider: 'Nous',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Largest free model, deep reasoning',
    isChineseInfra: false,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B',
    provider: 'NVIDIA',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'NVIDIA 120B, strong general performance',
    isChineseInfra: false,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1',
    provider: 'Mistral',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Fast European model, great quality',
    isChineseInfra: false,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    provider: 'Google',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Lightweight Google model, quick answers',
    isChineseInfra: false,
  },
  {
    id: 'google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B',
    provider: 'Google',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Ultra-light, fastest responses',
    isChineseInfra: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    tier: 'essentials',
    costPer1kTokens: 0,
    description: 'Strong reasoning, Chinese-infra',
    isChineseInfra: true,
  },

  // ── Recommended (cheap on OR — 150x markup for clients) ───────────────────
  {
    id: 'microsoft/phi-4',
    name: 'Phi 4',
    provider: 'Microsoft',
    tier: 'recommended',
    costPer1kTokens: 0.01, // client: 1.5¢/1k
    description: 'Compact, fast, strong reasoning',
    isChineseInfra: false,
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    name: 'Mistral Small 3.2',
    provider: 'Mistral',
    tier: 'recommended',
    costPer1kTokens: 0.012, // client: 1.8¢/1k
    description: 'Latest Mistral, excellent quality-to-cost',
    isChineseInfra: false,
  },
  {
    id: 'google/gemini-2.0-flash-lite-001',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'Google',
    tier: 'recommended',
    costPer1kTokens: 0.019, // client: 2.85¢/1k
    description: 'Lightest Gemini, ultra cheap',
    isChineseInfra: false,
  },
  {
    id: 'meta-llama/llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    tier: 'recommended',
    costPer1kTokens: 0.019, // client: 2.85¢/1k
    description: 'Latest Llama 4, great all-rounder',
    isChineseInfra: false,
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    tier: 'recommended',
    costPer1kTokens: 0.0225, // client: 3.38¢/1k
    description: 'Smallest GPT-5, fast and capable',
    isChineseInfra: false,
  },
  {
    id: 'openai/gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'OpenAI',
    tier: 'recommended',
    costPer1kTokens: 0.025, // client: 3.75¢/1k
    description: 'Proven nano model, reliable',
    isChineseInfra: false,
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'recommended',
    costPer1kTokens: 0.025, // client: 3.75¢/1k
    description: 'Latest Gemini lite, multimodal',
    isChineseInfra: false,
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    tier: 'recommended',
    costPer1kTokens: 0.025, // client: 3.75¢/1k
    description: 'Fast multimodal, great for analysis',
    isChineseInfra: false,
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    tier: 'recommended',
    costPer1kTokens: 0.0375, // client: 5.63¢/1k
    description: 'Larger Llama 4, deeper analysis',
    isChineseInfra: false,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'recommended',
    costPer1kTokens: 0.0375, // client: 5.63¢/1k
    description: 'Proven OpenAI model, reliable',
    isChineseInfra: false,
  },
  {
    id: 'x-ai/grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xAI',
    tier: 'recommended',
    costPer1kTokens: 0.04, // client: 6¢/1k
    description: 'Fast reasoning, concise answers',
    isChineseInfra: false,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    tier: 'recommended',
    costPer1kTokens: 0.0485, // client: 7.28¢/1k
    description: 'Strong reasoning, Chinese-infra',
    isChineseInfra: true,
  },
  {
    id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    tier: 'recommended',
    costPer1kTokens: 0.1, // client: 15¢/1k
    description: 'Smart mid-tier, great for business',
    isChineseInfra: false,
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    tier: 'recommended',
    costPer1kTokens: 0.1125, // client: 16.88¢/1k
    description: 'Latest GPT-5 mini, strong reasoning',
    isChineseInfra: false,
  },
  {
    id: 'deepseek/deepseek-r1-0528',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    tier: 'recommended',
    costPer1kTokens: 0.13, // client: 19.5¢/1k
    description: 'Deep reasoning model, Chinese-infra',
    isChineseInfra: true,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'recommended',
    costPer1kTokens: 0.3, // client: 45¢/1k
    description: 'Best quality for business analysis',
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
