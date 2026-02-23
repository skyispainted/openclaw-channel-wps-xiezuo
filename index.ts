import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { wpsXiezuoPlugin } from "./src/channel.js";
import { setWpsXiezuoRuntime } from "./src/runtime.js";

type Plugin = {
  id: string;
  name: string;
  description: string;
  configSchema: ReturnType<typeof emptyPluginConfigSchema>;
  register(api: OpenClawPluginApi): void;
};

/**
 * WPS协作插件
 */
const plugin: Plugin = {
  id: "wps-xiezuo",
  name: "WPS Xiezuo Channel",
  description: "WPS协作的 OpenClaw Channel 集成",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWpsXiezuoRuntime(api.runtime);
    api.registerChannel({ plugin: wpsXiezuoPlugin });
  },
};

export default plugin;