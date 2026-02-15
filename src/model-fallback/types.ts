/**
 * Model Fallback Types
 * Types for model fallback chain configuration
 */

/**
 * Model provider configuration
 */
export interface ModelProvider {
  /** Provider ID (e.g., "anthropic", "openai", "gemini") */
  id: string
  /** Display name */
  name: string
  /** Whether provider is enabled */
  enabled: boolean
  /** Priority in fallback chain (lower = higher priority) */
  priority: number
  /** Health check status */
  healthy?: boolean
  /** Last error if any */
  lastError?: string
}

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Model ID */
  id: string
  /** Display name */
  name: string
  /** Provider ID */
  provider: string
  /** Model type */
  type: "chat" | "completion" | "embedding"
  /** Context window size */
  contextWindow: number
  /** Whether model is enabled */
  enabled: boolean
  /** Priority in fallback chain */
  priority: number
  /** Cost tier (1=cheap, 2=medium, 3=expensive) */
  costTier: 1 | 2 | 3
  /** Capabilities */
  capabilities: {
    vision: boolean
    tools: boolean
    streaming: boolean
  }
}

/**
 * Fallback chain configuration
 */
export interface FallbackChainConfig {
  /** Enable fallback chain */
  enabled: boolean
  /** Maximum fallback attempts before giving up */
  maxAttempts: number
  /** Retry delay in ms */
  retryDelay: number
  /** Fallback strategy */
  strategy: "priority" | "round-robin" | "random"
  /** Models to use for fallback */
  models: ModelConfig[]
  /** Providers to use for fallback */
  providers: ModelProvider[]
  /** Error types that trigger fallback */
  triggerErrors: string[]
}

/**
 * Default fallback chain configuration
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackChainConfig = {
  enabled: true,
  maxAttempts: 3,
  retryDelay: 1000,
  strategy: "priority",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      provider: "anthropic",
      type: "chat",
      contextWindow: 200000,
      enabled: true,
      priority: 1,
      costTier: 2,
      capabilities: { vision: true, tools: true, streaming: true },
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      type: "chat",
      contextWindow: 200000,
      enabled: true,
      priority: 2,
      costTier: 2,
      capabilities: { vision: true, tools: true, streaming: true },
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      type: "chat",
      contextWindow: 128000,
      enabled: true,
      priority: 3,
      costTier: 2,
      capabilities: { vision: true, tools: true, streaming: true },
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini",
      type: "chat",
      contextWindow: 1000000,
      enabled: true,
      priority: 4,
      costTier: 2,
      capabilities: { vision: true, tools: true, streaming: true },
    },
  ],
  providers: [
    { id: "anthropic", name: "Anthropic", enabled: true, priority: 1 },
    { id: "openai", name: "OpenAI", enabled: true, priority: 2 },
    { id: "gemini", name: "Google Gemini", enabled: true, priority: 3 },
  ],
  triggerErrors: [
    "rate_limit",
    "overloaded",
    "timeout",
    "service_unavailable",
    "internal_error",
    "context_length_exceeded",
  ],
}

/**
 * Fallback attempt record
 */
export interface FallbackAttempt {
  /** Attempt number */
  attempt: number
  /** Model used */
  model: string
  /** Provider used */
  provider: string
  /** Whether attempt succeeded */
  success: boolean
  /** Error if failed */
  error?: string
  /** Timestamp */
  timestamp: Date
  /** Response time in ms */
  responseTime?: number
}

/**
 * Fallback result
 */
export interface FallbackResult<T> {
  /** Final result */
  result?: T
  /** Whether fallback was used */
  usedFallback: boolean
  /** All attempts made */
  attempts: FallbackAttempt[]
  /** Final model used */
  finalModel?: string
  /** Final provider used */
  finalProvider?: string
}
