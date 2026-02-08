import type { ComponentType } from 'react';

interface TileProps {
  title: string;
  data: Record<string, unknown>;
  isRunning: boolean;
  success?: boolean;
  error?: string;
  progress?: string;
}

const registry = new Map<string, ComponentType<TileProps>>();

/** Register a custom tile renderer for a specific tool name */
export function registerTile(toolName: string, component: ComponentType<TileProps>): void {
  registry.set(toolName, component);
}

/** Remove a registered tile renderer */
export function unregisterTile(toolName: string): void {
  registry.delete(toolName);
}

/** Look up a custom tile renderer (returns undefined for built-in fallback) */
export function getTileRenderer(toolName: string): ComponentType<TileProps> | undefined {
  return registry.get(toolName);
}

/** Get all registered custom tile names */
export function getRegisteredTiles(): string[] {
  return Array.from(registry.keys());
}

export type { TileProps };
