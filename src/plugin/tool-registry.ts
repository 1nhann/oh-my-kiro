/**
 * Tool Registry
 * Central registry for managing plugin tools
 *
 * Note: This registry is an optional utility for managing tools.
 * The main tool creation flow uses createTools() directly.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { ToolDef, ToolMetadata, ToolCategory } from "./types"

export class ToolRegistry {
  private tools = new Map<string, ToolMetadata>()
  private ctx: PluginInput | null = null

  /**
   * Set the plugin context for tool creation
   */
  setContext(ctx: PluginInput): void {
    this.ctx = ctx
  }

  /**
   * Get the current plugin context
   */
  getContext(): PluginInput | null {
    return this.ctx
  }

  /**
   * Register a tool with the registry
   */
  register(metadata: ToolMetadata): void {
    this.tools.set(metadata.name, metadata)
  }

  /**
   * Register multiple tools
   */
  registerMany(metadataList: ToolMetadata[]): void {
    metadataList.forEach(metadata => this.register(metadata))
  }

  /**
   * Get all registered tools as Tool instances
   * Requires context to be set before calling
   */
  getAllTools(): ToolDef[] {
    if (!this.ctx) {
      console.warn("[ToolRegistry] Context not set, returning empty tools array")
      return []
    }

    return Array.from(this.tools.values())
      .filter(meta => meta.enabled !== false)
      .map(meta => meta.factory(this.ctx!))
  }

  /**
   * Get tools by category
   * Requires context to be set before calling
   */
  getToolsByCategory(category: ToolCategory): ToolDef[] {
    if (!this.ctx) {
      console.warn("[ToolRegistry] Context not set, returning empty tools array")
      return []
    }

    return Array.from(this.tools.values())
      .filter(meta => meta.category === category && meta.enabled !== false)
      .map(meta => meta.factory(this.ctx!))
  }

  /**
   * Get a specific tool by name
   * Requires context to be set before calling
   */
  getTool(name: string): ToolDef | undefined {
    if (!this.ctx) {
      console.warn("[ToolRegistry] Context not set, cannot create tool")
      return undefined
    }

    const metadata = this.tools.get(name)
    return metadata && metadata.enabled !== false ? metadata.factory(this.ctx) : undefined
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Disable a tool by name
   */
  disable(name: string): void {
    const metadata = this.tools.get(name)
    if (metadata) {
      metadata.enabled = false
    }
  }

  /**
   * Enable a tool by name
   */
  enable(name: string): void {
    const metadata = this.tools.get(name)
    if (metadata) {
      metadata.enabled = true
    }
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Get all registered tool metadata (without creating instances)
   */
  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.tools.values())
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear()
  }
}
