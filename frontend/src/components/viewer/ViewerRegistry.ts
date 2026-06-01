import type { ViewerConfig } from '@/types';

const registry = new Map<string, ViewerConfig>();

export function registerViewer(config: ViewerConfig): void {
  for (const fmt of config.formats) {
    registry.set(fmt.toLowerCase(), config);
  }
}

export function getViewer(format: string): ViewerConfig | undefined {
  return registry.get(format.toLowerCase());
}

export function hasViewer(format: string): boolean {
  return registry.has(format.toLowerCase());
}
