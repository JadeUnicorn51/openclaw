import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

type DesktopGatewayConfig = {
  agents?: {
    defaults?: {
      workspace?: string;
    };
  };
  gateway?: {
    mode?: string;
    auth?: {
      mode?: string;
      token?: unknown;
    };
  };
};

export type DesktopBootstrapState = {
  configPath: string;
  gatewayToken: string;
  stateDir: string;
  workspaceDir: string;
};

const DESKTOP_STATE_DIR_NAME = ".purchaseai-desktop";

function resolveDesktopStateDir(): string {
  const explicit = process.env.OPENCLAW_ELECTRON_STATE_DIR?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(os.homedir(), DESKTOP_STATE_DIR_NAME);
}

function resolveDesktopConfigPath(stateDir: string): string {
  return path.join(stateDir, "openclaw.json");
}

function resolveDesktopWorkspaceDir(stateDir: string): string {
  return path.join(stateDir, "workspace");
}

function readDesktopConfig(configPath: string): DesktopGatewayConfig {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as DesktopGatewayConfig;
  } catch {
    return {};
  }
}

function normalizeGatewayToken(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type EnsureDesktopBootstrapConfigOptions = {
  configPath: string;
  workspaceDir: string;
  explicitGatewayToken?: string | null;
};

function ensureDesktopBootstrapConfig(options: EnsureDesktopBootstrapConfigOptions): string {
  const { configPath, workspaceDir, explicitGatewayToken } = options;
  const parsed = readDesktopConfig(configPath);
  const existingToken = normalizeGatewayToken(parsed.gateway?.auth?.token);
  const gatewayToken = explicitGatewayToken ?? existingToken ?? randomBytes(24).toString("hex");
  const nextConfig: DesktopGatewayConfig = {
    ...parsed,
    agents: {
      ...parsed.agents,
      defaults: {
        ...parsed.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...parsed.gateway,
      mode: parsed.gateway?.mode ?? "local",
      auth: {
        ...parsed.gateway?.auth,
        mode: "token",
        token: gatewayToken,
      },
    },
  };

  const configChanged = JSON.stringify(parsed) !== JSON.stringify(nextConfig);
  if (configChanged) {
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  }

  return gatewayToken;
}

export function syncDesktopWorkspaceConfig(configPath: string, workspaceDir: string): string {
  return ensureDesktopBootstrapConfig({
    configPath,
    workspaceDir,
  });
}

export function prepareDesktopBootstrapState(): DesktopBootstrapState {
  const stateDir = resolveDesktopStateDir();
  const configPath = resolveDesktopConfigPath(stateDir);
  const workspaceDir = resolveDesktopWorkspaceDir(stateDir);

  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });

  const gatewayToken = ensureDesktopBootstrapConfig({
    configPath,
    workspaceDir,
  });

  process.env.OPENCLAW_STATE_DIR = stateDir;
  process.env.OPENCLAW_CONFIG_PATH = configPath;
  process.env.OPENCLAW_GATEWAY_TOKEN = gatewayToken;
  process.env.OPENCLAW_WORKSPACE = workspaceDir;

  return {
    configPath,
    gatewayToken,
    stateDir,
    workspaceDir,
  };
}
