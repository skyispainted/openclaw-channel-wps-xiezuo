import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWpsXiezuoRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getWpsXiezuoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WPS Xiezuo runtime not initialized");
  }
  return runtime;
}