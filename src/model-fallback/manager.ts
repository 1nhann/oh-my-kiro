/**
 * Model Fallback Manager
 * Manages model fallback chain for resilience
 */

import type {
  FallbackChainConfig,
  FallbackResult,
  FallbackAttempt,
  ModelConfig,
  ModelProvider,
} from "./types"
import { DEFAULT_FALLBACK_CONFIG } from "./types"

/**
 * Error types that should trigger fallback
 */
const FALLBACK_ERROR_PATTERNS = [
  /rate.?limit/i,
  /overloaded/i,
  /timeout/i,
  /service.?unavailable/i,
  /internal.?error/i,
  /context.?length.?exceeded/i,
  /too.?many.?requests/i,
  /capacity/i,
  /temporarily.?unavailable/i,
]

/**
 * Check if an error should trigger fallback
 */
function shouldTriggerFallback(error: string, config: FallbackChainConfig): boolean {
  return FALLBACK_ERROR_PATTERNS.some((pattern) => pattern.test(error))
}

/**
 * Sort models by priority
 */
function sortByPriority<T extends { priority: number; enabled: boolean }>(
  items: T[]
): T[] {
  return items
    .filter((item) => item.enabled)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Create model fallback manager
 */
export function createModelFallbackManager(config: FallbackChainConfig = DEFAULT_FALLBACK_CONFIG) {
  // Health status tracking
  const providerHealth = new Map<string, { healthy: boolean; lastCheck: Date; error?: string }>()
  const modelHealth = new Map<string, { healthy: boolean; lastCheck: Date; error?: string }>()

  // Fallback history
  const fallbackHistory: Array<{
    sessionId: string
    timestamp: Date
    attempts: FallbackAttempt[]
    usedFallback: boolean
  }> = []

  /**
   * Get ordered models for fallback
   */
  function getOrderedModels(): ModelConfig[] {
    const sortedModels = sortByPriority(config.models)

    // Filter out unhealthy models (with a cooldown period)
    const now = Date.now()
    const cooldownPeriod = 5 * 60 * 1000 // 5 minutes

    return sortedModels.filter((model) => {
      const health = modelHealth.get(model.id)
      if (!health) return true

      // If unhealthy, check if cooldown period has passed
      if (!health.healthy) {
        const timeSinceLastCheck = now - health.lastCheck.getTime()
        return timeSinceLastCheck > cooldownPeriod
      }

      return true
    })
  }

  /**
   * Get ordered providers for fallback
   */
  function getOrderedProviders(): ModelProvider[] {
    return sortByPriority(config.providers)
  }

  /**
   * Mark a model as unhealthy
   */
  function markModelUnhealthy(modelId: string, error: string): void {
    modelHealth.set(modelId, {
      healthy: false,
      lastCheck: new Date(),
      error,
    })
  }

  /**
   * Mark a model as healthy
   */
  function markModelHealthy(modelId: string): void {
    modelHealth.set(modelId, {
      healthy: true,
      lastCheck: new Date(),
    })
  }

  /**
   * Mark a provider as unhealthy
   */
  function markProviderUnhealthy(providerId: string, error: string): void {
    providerHealth.set(providerId, {
      healthy: false,
      lastCheck: new Date(),
      error,
    })
  }

  /**
   * Mark a provider as healthy
   */
  function markProviderHealthy(providerId: string): void {
    providerHealth.set(providerId, {
      healthy: true,
      lastCheck: new Date(),
    })
  }

  /**
   * Execute a function with fallback chain
   */
  async function executeWithFallback<T>(
    fn: (model: ModelConfig) => Promise<T>,
    sessionId: string,
    preferredModel?: string
  ): Promise<FallbackResult<T>> {
    const attempts: FallbackAttempt[] = []
    let usedFallback = false

    // Get ordered models
    const orderedModels = getOrderedModels()

    // If preferred model is specified, try it first
    let modelsToTry = [...orderedModels]
    if (preferredModel) {
      const preferred = orderedModels.find((m) => m.id === preferredModel)
      if (preferred) {
        modelsToTry = [
          preferred,
          ...orderedModels.filter((m) => m.id !== preferredModel),
        ]
      }
    }

    // Limit attempts
    const maxAttempts = Math.min(config.maxAttempts, modelsToTry.length)

    for (let i = 0; i < maxAttempts; i++) {
      const model = modelsToTry[i]
      const startTime = Date.now()

      const attempt: FallbackAttempt = {
        attempt: i + 1,
        model: model.id,
        provider: model.provider,
        success: false,
        timestamp: new Date(),
      }

      try {
        const result = await fn(model)
        attempt.success = true
        attempt.responseTime = Date.now() - startTime
        attempts.push(attempt)

        // Mark as healthy
        markModelHealthy(model.id)
        markProviderHealthy(model.provider)

        return {
          result,
          usedFallback,
          attempts,
          finalModel: model.id,
          finalProvider: model.provider,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        attempt.error = errorMessage
        attempt.responseTime = Date.now() - startTime
        attempts.push(attempt)

        // Check if this error should trigger fallback
        if (!shouldTriggerFallback(errorMessage, config)) {
          // Non-retryable error, don't fallback
          markModelUnhealthy(model.id, errorMessage)
          break
        }

        // Mark as unhealthy and try next model
        markModelUnhealthy(model.id, errorMessage)
        usedFallback = true

        // Wait before retry if configured
        if (config.retryDelay > 0 && i < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, config.retryDelay))
        }
      }
    }

    // All attempts failed
    fallbackHistory.push({
      sessionId,
      timestamp: new Date(),
      attempts,
      usedFallback,
    })

    return {
      usedFallback,
      attempts,
    }
  }

  /**
   * Get next model in fallback chain
   */
  function getNextModel(currentModel: string): ModelConfig | undefined {
    const models = getOrderedModels()
    const currentIndex = models.findIndex((m) => m.id === currentModel)

    if (currentIndex === -1 || currentIndex >= models.length - 1) {
      return undefined
    }

    return models[currentIndex + 1]
  }

  /**
   * Get best model for a task
   */
  function getBestModel(
    requirements?: {
      vision?: boolean
      tools?: boolean
      minContextWindow?: number
    }
  ): ModelConfig | undefined {
    const models = getOrderedModels()

    return models.find((model) => {
      if (requirements?.vision && !model.capabilities.vision) return false
      if (requirements?.tools && !model.capabilities.tools) return false
      if (requirements?.minContextWindow && model.contextWindow < requirements.minContextWindow) {
        return false
      }
      return true
    })
  }

  /**
   * Get health status
   */
  function getHealthStatus(): {
    providers: Record<string, { healthy: boolean; error?: string }>
    models: Record<string, { healthy: boolean; error?: string }>
  } {
    const providers: Record<string, { healthy: boolean; error?: string }> = {}
    const models: Record<string, { healthy: boolean; error?: string }> = {}

    for (const [id, health] of providerHealth) {
      providers[id] = { healthy: health.healthy, error: health.error }
    }

    for (const [id, health] of modelHealth) {
      models[id] = { healthy: health.healthy, error: health.error }
    }

    return { providers, models }
  }

  /**
   * Get fallback statistics
   */
  function getStats(): {
    totalFallbacks: number
    successRate: number
    mostUsedFallbackModel: string | undefined
  } {
    const totalFallbacks = fallbackHistory.filter((h) => h.usedFallback).length
    const successfulAttempts = fallbackHistory
      .flatMap((h) => h.attempts)
      .filter((a) => a.success).length
    const totalAttempts = fallbackHistory.flatMap((h) => h.attempts).length

    // Find most used fallback model
    const modelUsage: Record<string, number> = {}
    for (const history of fallbackHistory) {
      for (let i = 1; i < history.attempts.length; i++) {
        const model = history.attempts[i].model
        modelUsage[model] = (modelUsage[model] || 0) + 1
      }
    }

    const mostUsed = Object.entries(modelUsage).sort((a, b) => b[1] - a[1])[0]

    return {
      totalFallbacks,
      successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 1,
      mostUsedFallbackModel: mostUsed?.[0],
    }
  }

  return {
    config,
    getOrderedModels,
    getOrderedProviders,
    executeWithFallback,
    getNextModel,
    getBestModel,
    markModelHealthy,
    markModelUnhealthy,
    markProviderHealthy,
    markProviderUnhealthy,
    getHealthStatus,
    getStats,
  }
}

export type ModelFallbackManager = ReturnType<typeof createModelFallbackManager>
