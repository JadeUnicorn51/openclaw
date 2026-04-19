import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const electron = require("electron") as typeof import("electron");
const { contextBridge, ipcRenderer } = electron;

type DesktopConfig = {
  agents?: {
    defaults?: {
      workspace?: unknown;
    };
  };
  gateway?: {
    mode?: unknown;
    auth?: {
      mode?: unknown;
      token?: unknown;
    };
  };
  [key: string]: unknown;
};

type DesktopBootstrapContext = {
  configPath: string;
  stateDir: string;
  workspaceDir: string;
  gatewayToken: string | null;
  needsSetup: boolean;
};

function resolveConfigPath(): string {
  const explicit = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(os.homedir(), ".openclaw", "openclaw.json");
}

function readDesktopConfig(configPath: string): DesktopConfig {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as DesktopConfig;
  } catch {
    return {};
  }
}

function pruneEmptyObjects(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => pruneEmptyObjects(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value)
    .map(([key, entry]) => [key, pruneEmptyObjects(entry)] as const)
    .filter(([, entry]) => {
      if (entry == null) {
        return false;
      }
      if (typeof entry !== "object" || Array.isArray(entry)) {
        return true;
      }
      return Object.keys(entry).length > 0;
    });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function stripDesktopBootstrapKeys(parsed: DesktopConfig): Record<string, unknown> {
  const next: DesktopConfig = {
    ...parsed,
    agents: parsed.agents
      ? {
          ...parsed.agents,
          defaults: parsed.agents.defaults
            ? {
                ...parsed.agents.defaults,
              }
            : undefined,
        }
      : undefined,
    gateway: parsed.gateway
      ? {
          ...parsed.gateway,
          auth: parsed.gateway.auth
            ? {
                ...parsed.gateway.auth,
              }
            : undefined,
        }
      : undefined,
  };

  if (next.agents?.defaults && "workspace" in next.agents.defaults) {
    delete next.agents.defaults.workspace;
  }
  if (next.gateway && "mode" in next.gateway) {
    delete next.gateway.mode;
  }
  if (next.gateway?.auth) {
    delete next.gateway.auth.mode;
    delete next.gateway.auth.token;
  }

  return (pruneEmptyObjects(next) as Record<string, unknown> | undefined) ?? {};
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveDesktopBootstrapContext(): DesktopBootstrapContext {
  const configPath = resolveConfigPath();
  const parsed = readDesktopConfig(configPath);
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || path.dirname(configPath);
  const workspaceDir =
    normalizeString(parsed.agents?.defaults?.workspace) || path.join(stateDir, "workspace");
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envToken) {
    return {
      configPath,
      stateDir,
      workspaceDir,
      gatewayToken: envToken,
      needsSetup: Object.keys(stripDesktopBootstrapKeys(parsed)).length === 0,
    };
  }

  return {
    configPath,
    stateDir,
    workspaceDir,
    gatewayToken: normalizeString(parsed.gateway?.auth?.token),
    needsSetup: Object.keys(stripDesktopBootstrapKeys(parsed)).length === 0,
  };
}

function resolveGatewayTokenScopes(): string[] {
  if (typeof location === "undefined" || !location.host) {
    return [];
  }
  const wsProtocol =
    location.protocol === "https:"
      ? "wss:"
      : location.protocol === "http:"
        ? "ws:"
        : null;
  if (!wsProtocol) {
    return [];
  }
  const normalizedPath =
    location.pathname === "/" ? "" : location.pathname.replace(/\/+$/, "") || location.pathname;
  const scopes = [`${wsProtocol}//${location.host}`];
  if (normalizedPath) {
    scopes.push(`${wsProtocol}//${location.host}${normalizedPath}`);
  }
  return scopes;
}

function seedGatewayTokenSessionStorage(token: string | null): void {
  if (!token || typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }
  for (const scope of resolveGatewayTokenScopes()) {
    window.sessionStorage.setItem(`openclaw.control.token.v1:${scope}`, token);
  }
}

const desktopBootstrap = resolveDesktopBootstrapContext();
seedGatewayTokenSessionStorage(desktopBootstrap.gatewayToken);

contextBridge.exposeInMainWorld("openclawDesktop", {
  isDesktop: true,
  platform: process.platform,
  gatewayToken: desktopBootstrap.gatewayToken,
  configPath: desktopBootstrap.configPath,
  stateDir: desktopBootstrap.stateDir,
  workspaceDir: desktopBootstrap.workspaceDir,
  needsSetup: desktopBootstrap.needsSetup,
});

contextBridge.exposeInMainWorld("openclawDesktopApi", {
  showWindow: () => ipcRenderer.invoke("desktop.window.show"),
  hideWindow: () => ipcRenderer.invoke("desktop.window.hide"),
  isWindowVisible: () => ipcRenderer.invoke("desktop.window.isVisible") as Promise<boolean>,
  openExternal: (url: string) => ipcRenderer.invoke("desktop.shell.openExternal", url),
  quit: () => ipcRenderer.invoke("desktop.app.quit"),
  listWorkspaces: () =>
    ipcRenderer.invoke("desktop.workspace.list") as Promise<{
      activeWorkspaceId: string;
      workspaces: Array<{
        id: string;
        name: string;
        path: string;
        createdAtMs: number;
        updatedAtMs: number;
      }>;
    }>,
  createWorkspace: (name: string) =>
    ipcRenderer.invoke("desktop.workspace.create", name) as Promise<{
      id: string;
      name: string;
      path: string;
      createdAtMs: number;
      updatedAtMs: number;
    }>,
  switchWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke("desktop.workspace.switch", workspaceId) as Promise<{
      workspace: {
        id: string;
        name: string;
        path: string;
        createdAtMs: number;
        updatedAtMs: number;
      };
      requiresRestart: boolean;
    }>,
  deleteWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke("desktop.workspace.delete", workspaceId) as Promise<{
      activeWorkspaceId: string;
      workspaces: Array<{
        id: string;
        name: string;
        path: string;
        createdAtMs: number;
        updatedAtMs: number;
      }>;
    }>,
});

declare global {
  interface Window {
    openclawDesktop?: {
      isDesktop: boolean;
      platform: string;
      gatewayToken?: string | null;
      configPath?: string;
      stateDir?: string;
      workspaceDir?: string;
      needsSetup?: boolean;
    };
    openclawDesktopApi?: {
      showWindow: () => Promise<void>;
      hideWindow: () => Promise<void>;
      isWindowVisible: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      quit: () => Promise<void>;
      listWorkspaces: () => Promise<{
        activeWorkspaceId: string;
        workspaces: Array<{
          id: string;
          name: string;
          path: string;
          createdAtMs: number;
          updatedAtMs: number;
        }>;
      }>;
      createWorkspace: (name: string) => Promise<{
        id: string;
        name: string;
        path: string;
        createdAtMs: number;
        updatedAtMs: number;
      }>;
      switchWorkspace: (workspaceId: string) => Promise<{
        workspace: {
          id: string;
          name: string;
          path: string;
          createdAtMs: number;
          updatedAtMs: number;
        };
        requiresRestart: boolean;
      }>;
      deleteWorkspace: (workspaceId: string) => Promise<{
        activeWorkspaceId: string;
        workspaces: Array<{
          id: string;
          name: string;
          path: string;
          createdAtMs: number;
          updatedAtMs: number;
        }>;
      }>;
    };
  }
}
