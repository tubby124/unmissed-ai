import { SlidingWindowRateLimiter } from './rate-limiter'

export const globalDemoBudget = new SlidingWindowRateLimiter(100, 60 * 60_000)

export const GLOBAL_DEMO_KEY = '__global_demo__'
